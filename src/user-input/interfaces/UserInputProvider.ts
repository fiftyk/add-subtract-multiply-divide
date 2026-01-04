/**
 * 用户输入提供者接口
 *
 * 适配不同的交互环境 (CLI, Web, etc.)
 * 通过适配器模式支持多种用户输入方式
 */

import type { FormInputSchema, FormInputResult } from './FormInputSchema.js';

/**
 * UserInputProvider 的 DI Symbol
 */
export const UserInputProvider = Symbol('UserInputProvider');

/**
 * 用户输入请求（用于 HTTP/WebSocket 交互）
 */
export interface UserInputRequest {
  requestId: string;
  sessionId: string;
  stepId: number;
  fields: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
  createdAt: string;
}

/**
 * 用户输入提供者接口
 */
export interface UserInputProvider {
  /**
   * 请求用户输入
   *
   * @param schema Form Input Schema 定义
   * @param context 执行上下文(可用于动态选项生成)
   * @returns 用户输入结果
   * @throws {UserInputTimeoutError} 超时
   * @throws {UserInputCancelledError} 用户取消
   * @throws {Error} 验证失败或其他错误
   */
  requestInput(schema: FormInputSchema, context?: Record<string, unknown>): Promise<FormInputResult>;

  /**
   * 检查是否支持特定字段类型
   *
   * @param type 字段类型
   * @returns 是否支持
   */
  supportsFieldType(type: string): boolean;

  // ========== HTTP 特定方法（可选）==========
  // 这些方法用于支持 Web/WebSocket 交互模式

  /**
   * 提交用户输入响应
   * （HTTP 实现特有）
   */
  submitInput?(sessionId: string, stepId: number, values: Record<string, unknown>): boolean;

  /**
   * 取消待处理的输入
   * （HTTP 实现特有）
   */
  cancelInput?(sessionId: string, stepId: number): boolean;

  /**
   * 获取待处理的输入请求列表
   * （HTTP 实现特有）
   */
  getPendingInputs?(sessionId?: string): UserInputRequest[];

  /**
   * 添加待处理的输入请求
   * （HTTP 实现特有）
   */
  addPendingInput?(sessionId: string, stepId: number, schema: FormInputSchema): UserInputRequest;

  /**
   * 清空所有待处理的输入
   * （HTTP 实现特有）
   */
  clearPendingInputs?(): void;
}
