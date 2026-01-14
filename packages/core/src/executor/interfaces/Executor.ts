import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult, StepResult } from '../types.js';
import type { ILogger } from '../../logger/index.js';

export const Executor = Symbol('Executor');

export interface ExecutorConfig {
  stepTimeout?: number;
  logger?: ILogger;
}

export interface Executor {
  execute(
    plan: ExecutionPlan,
    options?: {
      startFromStep?: number;
      initialContext?: Record<string, unknown>;
      previousStepResults?: StepResult[];
    }
  ): Promise<ExecutionResult>;
  formatResultForDisplay(result: ExecutionResult): string;

  /**
   * 获取执行器的计划规则描述（用于 LLM prompt）
   * 返回纯字符串，描述执行器支持的步骤类型、语法规则等
   */
  getPlanRulesForLLM(): string;
}
