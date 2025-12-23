/**
 * 参数值 - 可以是字面量或引用前一步的结果
 */
export interface ParameterValue {
  type: 'literal' | 'reference';
  value: unknown; // 字面量值或引用路径如 "step.1.result"
}

/**
 * 执行计划中的一个步骤
 */
export interface PlanStep {
  stepId: number;
  functionName: string;
  description: string;
  parameters: Record<string, ParameterValue>;
  dependsOn?: number[]; // 预留：依赖的步骤 ID
}

/**
 * 缺失的函数定义
 */
export interface MissingFunction {
  name: string;
  description: string;
  suggestedParameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  suggestedReturns: {
    type: string;
    description: string;
  };
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  id: string;
  userRequest: string;
  steps: PlanStep[];
  missingFunctions?: MissingFunction[];
  createdAt: string;
  status: 'pending' | 'executable' | 'incomplete';
}

/**
 * Planner 的规划结果
 */
export interface PlanResult {
  success: boolean;
  plan?: ExecutionPlan;
  error?: string;
}
