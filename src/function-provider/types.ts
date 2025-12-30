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
