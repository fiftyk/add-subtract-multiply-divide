import 'reflect-metadata';
import { injectable } from 'inversify';
import type { ToolDefinition } from './types.js';
import type { ToolFormatter as IToolFormatter } from './interfaces/ToolFormatter.js';

/**
 * 标准工具格式化器实现
 * 负责将工具定义格式化为适合 LLM 的文本描述
 *
 * 职责：
 * - 将 ToolDefinition[] 格式化为 LLM prompt 字符串
 * - 支持对工具子集进行格式化
 * - 提供统一的格式化规则
 *
 * 遵循 SRP：专注于格式化逻辑，不负责工具的获取或管理
 */
@injectable()
export class StandardToolFormatter implements IToolFormatter {
  /**
   * 将工具列表格式化为 LLM prompt 字符串
   *
   * @param tools - 要格式化的工具列表
   * @returns 格式化后的字符串，适合作为 LLM prompt
   *
   * @example
   * const formatter = new ToolFormatter();
   * const tools = toolProvider.searchTools();
   * const prompt = formatter.formatForLLM(tools);
   */
  formatForLLM(tools: ToolDefinition[]): string {
    if (tools.length === 0) {
      return '当前没有可用的函数。';
    }

    return tools
      .map((tool) => this.formatSingleTool(tool))
      .join('\n\n');
  }

  /**
   * 格式化单个工具
   */
  private formatSingleTool(tool: ToolDefinition): string {
    const params = this.formatParameters(tool.parameters);

    return `- ${tool.name}: ${tool.description}
  使用场景: ${tool.scenario}
  参数:
${params || '    (无参数)'}
  返回值: ${tool.returns.type} - ${tool.returns.description}`;
  }

  /**
   * 格式化参数列表
   */
  private formatParameters(parameters: ToolDefinition['parameters']): string {
    if (!parameters || parameters.length === 0) {
      return '';
    }

    return parameters
      .map((p) => `    - ${p.name} (${p.type}): ${p.description}`)
      .join('\n');
  }

  /**
   * 格式化工具子集（可以基于条件过滤）
   *
   * @param tools - 要格式化的工具列表
   * @param filter - 过滤条件函数
   * @returns 格式化后的字符串
   *
   * @example
   * // 只格式化本地工具
   * const localToolsPrompt = formatter.formatForLLM(
   *   tools,
   *   (tool) => tool.type === 'local'
   * );
   */
  formatFiltered(
    tools: ToolDefinition[],
    filter: (tool: ToolDefinition) => boolean
  ): string {
    const filteredTools = tools.filter(filter);
    return this.formatForLLM(filteredTools);
  }
}
