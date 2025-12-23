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
   */
  resolveParameterValue(param: ParameterValue): unknown {
    if (param.type === 'literal') {
      return param.value;
    }

    // 解析引用，格式: "step.{stepId}.result"
    const refStr = param.value as string;
    const match = refStr.match(/^step\.(\d+)\.result$/);

    if (!match) {
      throw new ParameterResolutionError(refStr, 'step.{stepId}.result');
    }

    const stepId = parseInt(match[1], 10);
    const result = this.results.get(stepId);

    if (result === undefined) {
      const availableSteps = Array.from(this.results.keys());
      throw new StepResultNotFoundError(stepId, availableSteps);
    }

    return result;
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
