/**
 * MCP Client 实现
 * 使用官方 @modelcontextprotocol/sdk
 *
 * 注意：此模块不再实现 RemoteFunctionRegistry 接口
 * MCPFunctionProvider 负责封装此客户端并提供统一的 FunctionProvider 接口
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CallToolResultSchema,
  type ListToolsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';
import type { MCPServerConfig, MCPStdioServerConfig, MCPHttpServerConfig } from '../../config/types.js';

/**
 * 远程函数信息
 * 从 MCP Server 的 tools/list 响应映射而来
 */
export interface RemoteFunctionInfo {
  /** 函数唯一标识符 (MCP tool name) */
  name: string;
  /** 函数描述 */
  description: string;
  /** 输入模式 (JSON Schema) */
  inputSchema: {
    type: 'object';
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: unknown[];
    }>;
    required?: string[];
  };
  /** 输出模式 (JSON Schema) - 用于描述返回值结构 */
  outputSchema?: {
    type: 'object';
    properties?: Record<string, {
      type: string;
      description?: string;
    }>;
    required?: string[];
  };
}

/**
 * 远程函数调用结果
 */
export interface RemoteFunctionResult {
  /** 调用是否成功 */
  success: boolean;
  /** 返回值内容 */
  content?: unknown;
  /** 错误信息（如果失败） */
  error?: string;
  /** 是否为结构化内容 */
  isStructure?: boolean;
}

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  /** 服务器名称 */
  name: string;
  /** 传输类型 */
  transportType: 'stdio' | 'http';
  /** 传输配置 */
  transportConfig: MCPStdioServerConfig | MCPHttpServerConfig | Record<string, unknown>;
}

/**
 * MCP 客户端实现
 * 管理与 MCP Server 的连接，提供工具发现和调用能力
 *
 * 注意：此类不再实现 RemoteFunctionRegistry 接口
 * MCPFunctionProvider 负责封装此客户端并提供统一的 FunctionProvider 接口
 */
@injectable()
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
  private readonly serverName: string;
  private readonly logger: ILogger;
  private tools: Map<string, RemoteFunctionInfo> = new Map();
  private connected: boolean = false;
  private readonly config: MCPClientConfig;

  get type(): 'remote' {
    return 'remote';
  }

  constructor(
    config: MCPClientConfig,
    logger?: ILogger
  ) {
    this.serverName = config.name;
    this.config = config;
    this.logger = logger ?? LoggerFactory.create();

    // 创建 MCP Client (使用默认配置)
    this.client = new Client(
      { name: 'fn-orchestrator', version: '1.0.0' }
    );
  }

  getType(): 'remote' {
    return 'remote';
  }

  getServerName(): string {
    return this.serverName;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.logger.info(`Connecting to MCP server: ${this.serverName}`);

    // 根据配置类型创建传输层
    const transportConfig = this.config.transportConfig;

    if (this.config.transportType === 'http') {
      // HTTP 类型使用 Streamable HTTP 传输
      const httpConfig = transportConfig as unknown as MCPHttpServerConfig;
      this.logger.info(`Using HTTP transport: ${httpConfig.url}`);
      this.transport = new StreamableHTTPClientTransport(new URL(httpConfig.url));
    } else {
      // Stdio 传输
      const stdioConfig = transportConfig as unknown as MCPStdioServerConfig;
      this.transport = new StdioClientTransport({
        command: stdioConfig.command,
        args: stdioConfig.args || [],
        env: stdioConfig.env,
        cwd: stdioConfig.cwd,
        stderr: 'inherit',
      });
    }

    // 连接
    await this.client.connect(this.transport);

    // 获取工具列表
    await this.fetchTools();

    this.connected = true;
    this.logger.info(`Connected to MCP server: ${this.serverName}, ${this.tools.size} tools available`);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.logger.info(`Disconnecting from MCP server: ${this.serverName}`);

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.tools.clear();
    this.connected = false;

    this.logger.info(`Disconnected from MCP server: ${this.serverName}`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async has(name: string): Promise<boolean> {
    // 懒连接
    if (!this.connected) {
      await this.connect();
    }
    return this.tools.has(name);
  }

  async list(): Promise<RemoteFunctionInfo[]> {
    // 懒连接：首次使用时自动连接
    if (!this.connected) {
      await this.connect();
    }
    return Array.from(this.tools.values());
  }

  async get(name: string): Promise<RemoteFunctionInfo | undefined> {
    return this.tools.get(name);
  }

  async execute(name: string, params: Record<string, unknown>): Promise<RemoteFunctionResult> {
    if (!this.connected) {
      throw new Error(`Not connected to MCP server: ${this.serverName}`);
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.logger.debug(`Executing MCP tool: ${name}`, { params });

    try {
      const result = await this.client.callTool(
        {
          name,
          arguments: params,
        },
        CallToolResultSchema
      );

      // 解析结果
      const parsedResult = this.parseToolResult(result);

      this.logger.debug(`MCP tool result: ${name}`, { result: parsedResult });

      return {
        success: true,
        content: parsedResult.content,
        isStructure: parsedResult.isStructure,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`MCP tool execution failed: ${name}`, error as Error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 获取客户端配置
   */
  private getClientConfig(): MCPClientConfig {
    return this.config;
  }

  /**
   * 获取工具列表
   */
  private async fetchTools(): Promise<void> {
    try {
      this.logger.debug('Fetching tools from MCP server...');
      const result = await this.client.listTools();
      this.logger.debug(`Received tools response: ${JSON.stringify(result)}`);

      this.tools.clear();

      for (const tool of result.tools) {
        this.tools.set(tool.name, {
          name: tool.name,
          description: tool.description || '',
          inputSchema: {
            type: 'object',
            properties: this.convertParametersSchema(tool.inputSchema?.properties),
            required: tool.inputSchema?.required || [],
          },
          outputSchema: tool.outputSchema ? {
            type: 'object',
            properties: this.convertOutputSchema(tool.outputSchema.properties),
            required: tool.outputSchema.required || [],
          } : undefined,
        });
      }
      this.logger.info(`Fetched ${this.tools.size} tools from MCP server: ${this.serverName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.warn('Failed to fetch tools from MCP server', { error: errorMessage, stack });
      throw error;
    }
  }

  /**
   * 转换输出模式
   */
  private convertOutputSchema(
    properties?: Record<string, { type?: string; description?: string }>
  ): Record<string, { type: string; description?: string }> | undefined {
    if (!properties) {
      return undefined;
    }

    const result: Record<string, { type: string; description?: string }> = {};

    for (const [name, prop] of Object.entries(properties)) {
      result[name] = {
        type: prop.type || 'string',
        description: prop.description,
      };
    }

    return result;
  }

  /**
   * 转换参数模式
   */
  private convertParametersSchema(
    properties?: Record<string, { type?: string; description?: string; enum?: unknown[] }>
  ): Record<string, { type: string; description?: string; enum?: unknown[] }> | undefined {
    if (!properties) {
      return undefined;
    }

    const result: Record<string, { type: string; description?: string; enum?: unknown[] }> = {};

    for (const [name, prop] of Object.entries(properties)) {
      result[name] = {
        type: prop.type || 'string',
        description: prop.description,
        enum: prop.enum,
      };
    }

    return result;
  }

  /**
   * 解析工具调用结果
   */
  private parseToolResult(result: any): { content: unknown; isStructure: boolean } {
    if (!result || !result.content) {
      return { content: null, isStructure: false };
    }

    // 检查 content 类型
    const content = result.content;

    if (Array.isArray(content)) {
      // 多种内容类型
      const textContent = content
        .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
        .map((item) => item.text)
        .join('\n');

      const isStructure = content.some(
        (item) => item.type !== 'text'
      );

      return {
        content: isStructure ? content : textContent,
        isStructure,
      };
    }

    return {
      content,
      isStructure: true,
    };
  }
}
