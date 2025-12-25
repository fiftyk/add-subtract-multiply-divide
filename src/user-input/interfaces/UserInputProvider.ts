/**
 * 用户输入提供者接口
 *
 * 适配不同的交互环境 (CLI, Web, etc.)
 * 通过适配器模式支持多种用户输入方式
 */

import type { A2UISchema, A2UIResult } from './A2UISchema.js';

/**
 * UserInputProvider 的 DI Symbol
 */
export const UserInputProvider = Symbol('UserInputProvider');

/**
 * 用户输入提供者接口
 */
export interface UserInputProvider {
  /**
   * 请求用户输入
   *
   * @param schema A2UI Schema 定义
   * @param context 执行上下文(可用于动态选项生成)
   * @returns 用户输入结果
   * @throws {UserInputTimeoutError} 超时
   * @throws {UserInputCancelledError} 用户取消
   * @throws {Error} 验证失败或其他错误
   */
  requestInput(schema: A2UISchema, context?: Record<string, unknown>): Promise<A2UIResult>;

  /**
   * 检查是否支持特定字段类型
   *
   * @param type 字段类型
   * @returns 是否支持
   */
  supportsFieldType(type: string): boolean;
}
