/**
 * RemoteFunctionRegistry 接口
 * 定义远程 MCP Server 函数注册中心的抽象接口
 */

import type { FunctionDefinition } from '../../registry/types.js';

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
 * RemoteFunctionRegistry 接口
 * 抽象远程 MCP Server 的工具发现和调用能力
 */
export interface RemoteFunctionRegistry {
  /**
   * 获取注册表类型
   */
  getType(): 'remote';

  /**
   * 获取连接的服务器名称
   */
  getServerName(): string;

  /**
   * 检查函数是否存在
   * @param name 函数名
   * @returns 是否存在
   */
  has(name: string): Promise<boolean>;

  /**
   * 获取所有可用函数列表
   * @returns 函数信息列表
   */
  list(): Promise<RemoteFunctionInfo[]>;

  /**
   * 获取函数详细信息
   * @param name 函数名
   * @returns 函数信息，如果不存在则返回 undefined
   */
  get(name: string): Promise<RemoteFunctionInfo | undefined>;

  /**
   * 执行远程函数
   * @param name 函数名
   * @param params 参数
   * @returns 执行结果
   * @throws {MCPToolExecutionError} 执行失败时抛出
   */
  execute(name: string, params: Record<string, unknown>): Promise<RemoteFunctionResult>;

  /**
   * 连接并初始化
   * @throws {MCPConnectionError} 连接失败时抛出
   */
  connect(): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): Promise<void>;

  /**
   * 检查连接状态
   * @returns 是否已连接
   */
  isConnected(): boolean;
}

/**
 * RemoteFunctionRegistry Symbol（用于依赖注入）
 */
export const RemoteFunctionRegistry = Symbol('RemoteFunctionRegistry');
