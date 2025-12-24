/**
 * LLM Client interface for generating execution plans
 * Follows DIP: High-level Planner depends on this abstraction
 * Follows ISP: Small, focused interface for planning use case
 */
export const PlannerLLMClient = Symbol('PlannerLLMClient');

export interface IPlannerLLMClient {
  /**
   * Generate a plan from user request and available functions
   * @param prompt - The complete prompt including user request and functions
   * @returns The LLM's response text
   */
  generatePlan(prompt: string): Promise<string>;
}
