/**
 * FunctionProvider 类型定义
 * 统一的函数元数据格式
 */

import type { ParameterDef, ReturnDef } from '../registry/types.js';

/**
 * Provider 类型
 */
export type ProviderType = 'local' | 'remote' | 'composite';

/**
 * 函数元数据（统一格式）
 * 用于 Planner 的工具发现和 LLM 提示
 */
export interface FunctionMetadata {
  /** 函数唯一标识 */
  id: string;

  /** 函数名称 */
  name: string;

  /** 函数描述 */
  description: string;

  /** 使用场景说明 */
  scenario: string;

  /** 参数定义 */
  parameters: ParameterDef[];

  /** 返回值定义 */
  returns: ReturnDef;

  /** 工具类型 */
  type: 'local' | 'remote';

  /** 来源标识 */
  source: string;
}

/**
 * 函数执行结果（统一格式）
 */
export interface FunctionExecutionResult {
  /** 执行是否成功 */
  success: boolean;

  /** 执行结果（成功时） */
  result?: unknown;

  /** 错误信息（失败时） */
  error?: string;

  /** 执行元数据 */
  metadata?: {
    /** 执行耗时（毫秒） */
    executionTime?: number;

    /** 提供者标识 */
    provider?: string;

    /** 其他自定义元数据 */
    [key: string]: unknown;
  };
}

/**
 * 函数执行错误
 * 当函数执行失败时抛出此错误
 */
export class FunctionExecutionError extends Error {
  public readonly functionName: string;
  public readonly result: FunctionExecutionResult;

  constructor(functionName: string, result: FunctionExecutionResult) {
    super(result.error || `Function execution failed: ${functionName}`);
    this.name = 'FunctionExecutionError';
    this.functionName = functionName;
    this.result = result;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FunctionExecutionError);
    }
  }

  /**
   * 从 FunctionExecutionResult 创建错误
   */
  static fromResult(name: string, result: FunctionExecutionResult): FunctionExecutionError {
    if (result.success) {
      throw new Error('Cannot create error from successful result');
    }
    return new FunctionExecutionError(name, result);
  }
}
