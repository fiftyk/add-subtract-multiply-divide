import type { FunctionMetadata } from '../../function-provider/types.js';

/**
 * 工具格式化器接口
 * 负责将工具定义格式化为特定格式的文本
 */
export interface ToolFormatter {
  /**
   * 将工具列表格式化为 LLM prompt 字符串
   *
   * @param tools - 要格式化的工具列表
   * @returns 格式化后的字符串
   */
  formatForLLM(tools: FunctionMetadata[]): string;

  /**
   * 格式化工具子集（可以基于条件过滤）
   *
   * @param tools - 要格式化的工具列表
   * @param filter - 过滤条件函数
   * @returns 格式化后的字符串
   */
  formatFiltered(
    tools: FunctionMetadata[],
    filter: (tool: FunctionMetadata) => boolean
  ): string;
}

export const ToolFormatter = Symbol('ToolFormatter');
