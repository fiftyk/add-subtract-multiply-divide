/**
 * 条件求值器接口
 * 支持不同的条件求值实现（如 JS 表达式、安全沙箱等）
 */

export interface ConditionEvaluator {
  /**
   * 求值条件表达式
   * @param condition 条件表达式
   * @param context 上下文（包含步骤结果）
   * @returns 条件求值结果
   */
  evaluate(condition: string, context: ConditionContext): boolean;

  /**
   * 检查是否支持该条件表达式
   */
  supports(condition: string): boolean;
}

/**
 * 条件求值上下文
 */
export interface ConditionContext {
  /**
   * 步骤结果映射
   * key: 步骤 ID, value: 步骤执行结果
   */
  stepResults: Map<number, unknown>;

  /**
   * 变量映射
   * 存储自定义变量供条件引用
   */
  variables: Map<string, unknown>;

  /**
   * 获取步骤结果
   */
  getStepResult(stepId: number): unknown;

  /**
   * 获取变量值
   */
  getVariable(name: string): unknown;
}
