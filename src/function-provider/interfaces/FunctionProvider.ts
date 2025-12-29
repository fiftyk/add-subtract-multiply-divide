/**
 * FunctionProvider 接口
 * 统一的函数发现和执行接口
 */

import type { FunctionMetadata, FunctionExecutionResult, ProviderType } from '../types.js';

/**
 * 函数提供者统一接口
 *
 * 职责：
 * 1. 函数发现（list, has, get）
 * 2. 函数执行（execute）
 * 3. 生命周期管理（initialize, dispose）
 *
 * 实现策略：
 * - LocalFunctionProvider: 本地函数（直接调用 implementation）
 * - RemoteFunctionProvider: 远程函数（抽象基类）
 *   - MCPFunctionProvider: MCP 协议
 *   - HTTPFunctionProvider: HTTP API（未来）
 *   - gRPCFunctionProvider: gRPC（未来）
 * - CompositeFunctionProvider: 组合多个 Provider（优先级调度）
 */
export interface FunctionProvider {
  /**
   * 获取 Provider 类型
   * - 'local': 本地函数
   * - 'remote': 远程函数（单个来源）
   * - 'composite': 组合多个 Provider
   */
  getType(): ProviderType;

  /**
   * 获取来源标识
   *
   * @example
   * - 'local'
   * - 'mcp://server-name'
   * - 'http://api.example.com'
   * - 'grpc://service-name'
   * - 'composite'
   */
  getSource(): string;

  /**
   * 列出所有可用函数
   *
   * @returns 函数元数据列表
   */
  list(): Promise<FunctionMetadata[]>;

  /**
   * 检查函数是否存在
   *
   * @param name 函数名称
   * @returns 是否存在
   */
  has(name: string): Promise<boolean>;

  /**
   * 获取函数元数据
   *
   * @param name 函数名称
   * @returns 函数元数据，不存在时返回 undefined
   */
  get(name: string): Promise<FunctionMetadata | undefined>;

  /**
   * 执行函数
   *
   * @param name 函数名称
   * @param params 参数（键值对）
   * @returns 执行结果
   * @throws {Error} 函数不存在或执行失败时抛出错误
   */
  execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult>;

  /**
   * 初始化 Provider（可选）
   *
   * 用于：
   * - 建立连接（远程 Provider）
   * - 加载资源
   * - 预热缓存
   *
   * @throws {Error} 初始化失败时抛出错误
   */
  initialize?(): Promise<void>;

  /**
   * 清理资源（可选）
   *
   * 用于：
   * - 关闭连接
   * - 释放资源
   * - 清理缓存
   */
  dispose?(): Promise<void>;
}

/**
 * FunctionProvider Symbol（依赖注入）
 */
export const FunctionProvider = Symbol('FunctionProvider');
