import type {
  PlanRefinementRequest,
  PlanRefinementResponse,
} from '../types.js';

/**
 * Plan 改进的 LLM 客户端接口
 *
 * 职责：
 * - 接收当前 plan 和用户的修改指令
 * - 调用 LLM 生成改进后的 plan
 * - 返回改进结果和改动说明
 *
 * 实现：
 * - AnthropicPlanRefinementLLMClient: 使用 Claude API
 * - 可扩展支持其他 LLM 提供商
 */
export interface IPlanRefinementLLMClient {
  /**
   * 根据用户指令改进 plan
   *
   * @param request - 包含当前 plan、修改指令、对话历史等
   * @returns 改进后的 plan 和改动说明
   */
  refinePlan(request: PlanRefinementRequest): Promise<PlanRefinementResponse>;
}
