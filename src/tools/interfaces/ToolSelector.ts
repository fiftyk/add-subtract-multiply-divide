import type { ToolDefinition } from '../types.js';
import type { ToolProvider } from './ToolProvider.js';

export const ToolSelector = Symbol('ToolSelector');

/**
 * 工具选择器接口
 * 根据用户需求选择合适的工具子集
 *
 * 策略模式：不同的选择策略可以实现不同的工具过滤逻辑
 * - AllToolsSelector: 返回所有工具（当前默认策略）
 * - RelevantToolsSelector: 根据需求关键词过滤工具
 * - LLMBasedToolSelector: 使用 LLM 预先筛选工具
 */
export interface ToolSelector {
  /**
   * 根据用户需求选择工具
   * @param userRequest - 用户需求描述
   * @param toolProvider - ���具提供者
   * @returns 选择的工具列表
   */
  selectTools(
    userRequest: string,
    toolProvider: ToolProvider
  ): Promise<ToolDefinition[]>;
}
