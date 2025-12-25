import type { ParameterValue } from '../planner/types.js';
import {
  ParameterResolutionError,
  StepResultNotFoundError,
} from '../errors/index.js';

/**
 * 执行上下文 - 存储步骤间的中间结果
 */
export class ExecutionContext {
  private results: Map<number, unknown> = new Map();

  /**
   * 存储步骤结果
   */
  setStepResult(stepId: number, result: unknown): void {
    this.results.set(stepId, result);
  }

  /**
   * 获取步骤结果
   */
  getStepResult(stepId: number): unknown {
    return this.results.get(stepId);
  }

  /**
   * 解析参数值 - 处理字面量和引用
   *
   * 支持的引用格式:
   * - "step.{stepId}.result" - 获取整个步骤结果
   * - "step.{stepId}.{fieldName}" - 从用户输入结果中获取指定字段
   */
  resolveParameterValue(param: ParameterValue): unknown {
    if (param.type === 'literal') {
      return param.value;
    }

    // 解析引用，格式: "step.{stepId}.{path}"
    const refStr = param.value as string;
    const match = refStr.match(/^step\.(\d+)\.(.+)$/);

    if (!match) {
      throw new ParameterResolutionError(
        refStr,
        'step.{stepId}.result or step.{stepId}.{fieldName}'
      );
    }

    const stepId = parseInt(match[1], 10);
    const path = match[2];
    const result = this.results.get(stepId);

    if (result === undefined) {
      const availableSteps = Array.from(this.results.keys());
      throw new StepResultNotFoundError(stepId, availableSteps);
    }

    // 如果路径是 "result"，返回整个结果（向后兼容）
    if (path === 'result') {
      return result;
    }

    // 否则，从结果对象中提取字段（用于用户输入步骤）
    if (typeof result === 'object' && result !== null) {
      const value = (result as Record<string, unknown>)[path];
      if (value === undefined) {
        throw new ParameterResolutionError(
          refStr,
          `Field "${path}" not found in step ${stepId} result`
        );
      }
      return value;
    }

    throw new ParameterResolutionError(
      refStr,
      `Step ${stepId} result is not an object, cannot access field "${path}"`
    );
  }

  /**
   * 解析所有参数
   */
  resolveParameters(
    params: Record<string, ParameterValue>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [name, param] of Object.entries(params)) {
      resolved[name] = this.resolveParameterValue(param);
    }
    return resolved;
  }

  /**
   * 清空上下文
   */
  clear(): void {
    this.results.clear();
  }
}
