/**
 * 步骤执行结果
 */
export interface StepResult {
  stepId: number;
  functionName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  executedAt: string;
}

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
