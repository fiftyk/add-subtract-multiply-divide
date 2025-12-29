import 'reflect-metadata';
import { injectable } from 'inversify';
import type { FunctionMetadata } from '../function-provider/types.js';
import type { ToolFormatter } from './interfaces/ToolFormatter.js';

/**
 * 标准工具格式化器实现
 * 负责将函数元数据格式化为适合 LLM 的文本描述
 *
 * 职责：
 * - 将 FunctionMetadata[] 格式化为 LLM prompt 字符串
 * - 支持对工具子集进行格式化
 * - 提供统一的格式化规则
 *
 * 遵循 SRP：专注于格式化逻辑，不负责工具的获取或管理
 */
@injectable()
export class StandardToolFormatter implements ToolFormatter {
  /**
   * 将函数列表格式化为 LLM prompt 字符串
   *
   * @param functions - 要格式化的函数列表
   * @returns 格式化后的字符串，适合作为 LLM prompt
   *
   * @example
   * const formatter = new ToolFormatter();
   * const functions = functionProvider.list();
   * const prompt = formatter.formatForLLM(functions);
   */
  formatForLLM(functions: FunctionMetadata[]): string {
    if (functions.length === 0) {
      return '当前没有可用的函数。';
    }

    return functions
      .map((fn) => this.formatSingleFunction(fn))
      .join('\n\n');
  }

  /**
   * 格式化单个函数
   */
  private formatSingleFunction(fn: FunctionMetadata): string {
    const params = this.formatParameters(fn.parameters);

    return `- ${fn.name}: ${fn.description}
  使用场景: ${fn.scenario}
  参数:
${params || '    (无参数)'}
  返回值: ${fn.returns.type} - ${fn.returns.description}`;
  }

  /**
   * 格式化参数列表
   */
  private formatParameters(parameters: FunctionMetadata['parameters']): string {
    if (!parameters || parameters.length === 0) {
      return '';
    }

    return parameters
      .map((p) => `    - ${p.name} (${p.type}): ${p.description}`)
      .join('\n');
  }

  /**
   * 格式化函数子集（可以基于条件过滤）
   *
   * @param functions - 要格式化的函数列表
   * @param filter - 过滤条件函数
   * @returns 格式化后的字符串
   *
   * @example
   * // 只格式化本地函数
   * const localFunctionsPrompt = formatter.formatForLLM(
   *   functions,
   *   (fn) => fn.type === 'local'
   * );
   */
  formatFiltered(
    functions: FunctionMetadata[],
    filter: (fn: FunctionMetadata) => boolean
  ): string {
    const filteredFunctions = functions.filter(filter);
    return this.formatForLLM(filteredFunctions);
  }
}
