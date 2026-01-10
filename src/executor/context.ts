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
   * 获取所有步骤结果（只读访问）
   */
  getResults(): ReadonlyMap<number, unknown> {
    return this.results as ReadonlyMap<number, unknown>;
  }

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

    // 防御性检查：确保引用字符串有效
    if (refStr === undefined || refStr === null || typeof refStr !== 'string') {
      throw new ParameterResolutionError(
        String(refStr),
        'Invalid parameter reference: value is undefined or not a string'
      );
    }

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

    // 处理 "result.xxx" 格式的路径（如 step.1.result.inventor）
    // 提取真正的字段名
    const fieldPath = path.startsWith('result.')
      ? path.slice(7)  // 去掉 "result." 前缀
      : path;

    // 否则，从结果对象中提取字段（用于用户输入步骤或函数调用结果）
    if (typeof result === 'object' && result !== null) {
      // 支持嵌套字段访问，如 "patents.0.patentNumber"
      const parts = fieldPath.split('.');
      let value: unknown = result;

      for (const part of parts) {
        if (value === null || typeof value !== 'object') {
          throw new ParameterResolutionError(
            refStr,
            `Cannot access field "${part}" in path "${fieldPath}" of step ${stepId} result`
          );
        }
        value = (value as Record<string, unknown>)[part];
      }

      if (value === undefined) {
        throw new ParameterResolutionError(
          refStr,
          `Field "${fieldPath}" not found in step ${stepId} result`
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
