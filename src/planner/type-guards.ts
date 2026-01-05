/**
 * 步骤类型守卫函数
 *
 * 提供类型安全的运行时步骤类型检查
 * 使 TypeScript 能够正确收窄类型
 */

import type { PlanStep, FunctionCallStep, UserInputStep, ConditionalStep } from './types.js';
import { StepType } from './types.js';

/**
 * 检查是否为函数调用步骤
 *
 * 为了向后兼容，如果 type 字段不存在，并且有 functionName 字段，
 * 则认为是函数调用步骤
 */
export function isFunctionCallStep(step: PlanStep): step is FunctionCallStep {
  if (!step.type) {
    // 向后兼容：如果没有 type 字段但有 functionName，认为是函数调用步骤
    return 'functionName' in step;
  }
  return step.type === StepType.FUNCTION_CALL;
}

/**
 * 检查是否为用户输入步骤
 */
export function isUserInputStep(step: PlanStep): step is UserInputStep {
  return step.type === StepType.USER_INPUT;
}

/**
 * 检查是否为条件分支步骤
 */
export function isConditionalStep(step: PlanStep): step is ConditionalStep {
  return step.type === StepType.CONDITION;
}
