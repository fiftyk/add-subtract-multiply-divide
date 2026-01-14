import type { ExecutionPlan, PlanResult } from '../types.js';

/**
 * Planner Interface
 * 函数编排规划器的抽象接口
 *
 * 职责：
 * - 根据用户需求生成执行计划
 * - 格式化计划用于 CLI 显示
 */
export const Planner = Symbol('Planner');

export interface Planner {
  /**
   * 根据用户需求生成执行计划
   * @param userRequest - 用户的需求描述
   * @returns 规划结果，包含是否成功和计划内容
   */
  plan(userRequest: string): Promise<PlanResult>;

  /**
   * 格式化计划用于 CLI 显示
   * @param plan - 要显示的计划
   * @return 格式化后的字符串
   */
  formatPlanForDisplay(plan: ExecutionPlan): string;
}
