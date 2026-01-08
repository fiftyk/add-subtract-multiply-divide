/**
 * 参数值 - 可以是字面量或引用前一步的结果
 */
export interface ParameterValue {
  type: 'literal' | 'reference';
  value: unknown; // 字面量值或引用路径如 "step.1.result"
}

/**
 * 步骤类型枚举
 */
export enum StepType {
  /** 函数调用(原有类型) */
  FUNCTION_CALL = 'function_call',

  /** 用户输入(新增) */
  USER_INPUT = 'user_input',

  /** 条件分支 */
  CONDITION = 'condition',
}

/**
 * 基础步骤接口
 */
export interface BasePlanStep {
  stepId: number;
  type: StepType;
  description: string;
}

/**
 * 函数调用步骤(原有)
 */
export interface FunctionCallStep extends BasePlanStep {
  type: StepType.FUNCTION_CALL;
  functionName: string;
  parameters: Record<string, ParameterValue>;
  dependsOn?: number[]; // 预留：依赖的步骤 ID
}

/**
 * 用户输入步骤(新增)
 */
export interface UserInputStep extends BasePlanStep {
  type: StepType.USER_INPUT;

  /** A2UI Schema */
  schema: import('../a2ui/types.js').A2UISchema;

  /**
   * 输入结果的存储名称(可选)
   * 后续步骤可通过 ${step.N.result} 或 ${step.N.fieldId} 引用
   */
  outputName?: string;
}

/**
 * 条件分支步骤
 */
export interface ConditionalStep extends BasePlanStep {
  type: StepType.CONDITION;

  /**
   * 条件表达式 (JavaScript 表达式)
   * 可以引用之前步骤的结果: step.1.result, step.2.value.nestedField
   * 示例: "step.1.result > 10", "step.2.status === 'error'"
   */
  condition: string;

  /**
   * 条件为真时执行的步骤 ID 列表
   * 这些步骤会在条件判断后执行
   */
  onTrue: number[];

  /**
   * 条件为假时执行的步骤 ID 列表
   * 这些步骤会在条件判断后执行
   */
  onFalse: number[];

  /**
   * 条件结果变量名 (可选)
   * 如果设置，会将条件结果存储到上下文
   */
  outputVariable?: string;
}

/**
 * 执行计划中的一个步骤
 * 使用判别联合类型支持多种步骤类型
 */
export type PlanStep = FunctionCallStep | UserInputStep | ConditionalStep;

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
  /** 计划中引用了这个函数的哪些返回值字段，用于生成匹配的 mock 数据 */
  referencedFields?: Array<{
    path: string;  // 如 "inventor" 或 "patents.0.patentNumber"
    description: string;
  }>;
}

/**
 * Mock 函数引用 - 记录 Plan 使用的 mock 函数详细信息
 */
export interface MockFunctionReference {
  name: string;
  version: number;
  filePath: string; // 相对于 Plan 目录的路径，如 "mocks/power-v1.js"
  generatedAt: string;
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
  metadata?: {
    usesMocks?: boolean;
    mockFunctions?: MockFunctionReference[]; // 改为对象数组，记录版本和路径
  };
}

/**
 * Planner 的规划结果
 */
export interface PlanResult {
  success: boolean;
  plan?: ExecutionPlan;
  error?: string;
}
