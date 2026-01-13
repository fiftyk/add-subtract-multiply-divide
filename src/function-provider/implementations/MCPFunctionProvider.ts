/**
 * MCPFunctionProvider 实现
 * 远程 MCP 函数提供者，实现 FunctionProvider 接口
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { FunctionMetadata, FunctionExecutionResult } from '../types.js';
import type { FunctionProvider } from '../interfaces/FunctionProvider.js';
import type { ParameterDef } from '../../registry/types.js';
import {
  MCPFunctionInfo,
  MCPClientInterface,
} from './MCPClientInterface.js';

/**
 * 将 MCP 函数信息转换为 FunctionMetadata
 */
function toMetadata(fn: MCPFunctionInfo, source: string): FunctionMetadata {
  const parameters = convertInputSchema(fn.inputSchema);

  return {
    id: fn.name, // 使用 name 作为 id
    name: fn.name,
    description: fn.description,
    scenario: fn.description, // 使用 description 作为 scenario
    parameters,
    returns: {
      type: 'object',
      description: formatOutputSchema(fn.outputSchema),
    },
    type: 'remote',
    source,
  };
}

/**
 * 将 JSON Schema 转换为 parameters 格式
 */
function convertInputSchema(
  inputSchema: MCPFunctionInfo['inputSchema']
): ParameterDef[] {
  const parameters: ParameterDef[] = [];

  if (!inputSchema.properties) {
    return parameters;
  }

  for (const [name, prop] of Object.entries(inputSchema.properties)) {
    parameters.push({
      name,
      type: mapJsonSchemaType(prop.type || 'string'),
      description: prop.description || '',
      required: inputSchema.required?.includes(name) ?? false,
      enum: prop.enum,
    });
  }

  return parameters;
}

/**
 * 映射 JSON Schema 类型到内部类型
 */
function mapJsonSchemaType(jsonType: string): ParameterDef['type'] {
  const typeMap: Record<string, ParameterDef['type']> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
    null: 'string',
  };

  return typeMap[jsonType] || 'string';
}

/**
 * 格式化输出模式为描述字符串
 */
function formatOutputSchema(outputSchema?: MCPFunctionInfo['outputSchema']): string {
  if (!outputSchema || !outputSchema.properties) {
    return 'object - Function result';
  }

  const props = Object.entries(outputSchema.properties)
    .map(([name, prop]) => {
      const type = prop.type || 'unknown';
      const desc = prop.description ? ` - ${prop.description}` : '';
      return `  - ${name} (${type})${desc}`;
    })
    .join('\n');

  return `object - Function result with properties:\n${props}`;
}

/**
 * MCP 函数提供者
 *
 * 职责：
 * - 包装 MCP 客户端（MCPClient）
 * - 实现 FunctionProvider 接口
 * - 转换 MCP 工具格式为统一格式
 */
@injectable()
export class MCPFunctionProvider implements FunctionProvider {
  constructor(@inject(MCPClientInterface) private client: MCPClientInterface) {}

  /**
   * 获取 Provider 类型
   */
  getType(): 'remote' {
    return 'remote';
  }

  /**
   * 获取来源标识
   */
  getSource(): string {
    return `mcp://${this.client.getServerName()}`;
  }

  /**
   * 列出所有可用函数
   */
  async list(): Promise<FunctionMetadata[]> {
    const functions = await this.client.list();
    return functions.map(fn => toMetadata(fn, this.getSource()));
  }

  /**
   * 检查函数是否存在
   */
  async has(name: string): Promise<boolean> {
    return this.client.has(name);
  }

  /**
   * 获取函数元数据
   */
  async get(name: string): Promise<FunctionMetadata | undefined> {
    const fn = await this.client.get(name);
    return fn ? toMetadata(fn, this.getSource()) : undefined;
  }

  /**
   * 执行函数
   */
  async execute(
    name: string,
    params: Record<string, unknown>
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();

    try {
      const result = await this.client.execute(name, params);

      return {
        success: result.success,
        result: result.content,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
          provider: this.getSource(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime,
          provider: this.getSource(),
        },
      };
    }
  }

  /**
   * 初始化 Provider
   * 建立与 MCP Server 的连接
   */
  async initialize(): Promise<void> {
    await this.client.connect();
  }

  /**
   * 清理资源
   * 断开与 MCP Server 的连接
   */
  async dispose(): Promise<void> {
    await this.client.disconnect();
  }
}
