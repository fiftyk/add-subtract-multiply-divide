import { StepType } from '../planner/types.js';

/**
 * 步骤执行结果基类
 */
export interface BaseStepResult {
  stepId: number;
  type: StepType;
  success: boolean;
  error?: string;
  executedAt: string;
}

/**
 * 函数调用步骤执行结果
 */
export interface FunctionCallResult extends BaseStepResult {
  type: StepType.FUNCTION_CALL;
  functionName: string;
  parameters: Record<string, unknown>;
  result: unknown;
}

/**
 * 用户输入步骤执行结果
 */
export interface UserInputResult extends BaseStepResult {
  type: StepType.USER_INPUT;
  values: Record<string, unknown>;
  skipped?: boolean;
  timestamp?: number;
}

/**
 * 条件分支步骤执行结果
 */
export interface ConditionalResult extends BaseStepResult {
  type: StepType.CONDITION;
  condition: string;
  evaluatedResult: boolean; // 条件求值结果
  executedBranch: 'onTrue' | 'onFalse' | 'none';
  skippedSteps: number[]; // 未执行的分支步骤 ID
}

/**
 * 步骤执行结果（联合类型）
 */
export type StepResult = FunctionCallResult | UserInputResult | ConditionalResult;

/**
 * 执行结果
 */
export interface ExecutionResult {
  planId: string;
  steps: StepResult[];
  finalResult: unknown;
  success: boolean;
  error?: string;
  startedAt: string;
  completedAt: string;
}
