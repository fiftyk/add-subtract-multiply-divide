import type { FunctionDefinition } from '../types.js';

/**
 * 函数注册中心 Symbol
 * @deprecated 使用 FunctionProvider 替代
 */
export const FunctionRegistry = Symbol('FunctionRegistry');

/**
 * 函数注册中心接口
 * @deprecated 请使用 FunctionProvider 接口
 */
export interface FunctionRegistry {
  /**
   * 注册一个函数
   * 注意：远程注册中心可能不支持此操作
   */
  register(fn: FunctionDefinition): void;

  /**
   * 检查函数是否存在
   */
  has(name: string): boolean;

  /**
   * 获取函数定义
   */
  get(name: string): FunctionDefinition | undefined;

  /**
   * 获取所有函数定义
   */
  getAll(): FunctionDefinition[];

  /**
   * 执行函数（本地和远程共用）
   */
  execute(name: string, params: Record<string, unknown>): Promise<unknown>;

  /**
   * 清空所有注册的函数
   * 注意：远程注册中心可能不支持此操作
   */
  clear(): void;

  /**
   * 获取注册中心类型标识
   */
  getType(): 'local' | 'remote';
}
