import type { FunctionRegistry } from '../registry/index.js';
import type { ExecutionPlan } from '../planner/types.js';
import type { ExecutionResult, StepResult } from './types.js';
import { ExecutionContext } from './context.js';

/**
 * 执行引擎 - 按照计划顺序执行 functions
 */
export class Executor {
  private registry: FunctionRegistry;

  constructor(registry: FunctionRegistry) {
    this.registry = registry;
  }

  /**
   * 执行计划
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const context = new ExecutionContext();
    const stepResults: StepResult[] = [];
    const startedAt = new Date().toISOString();

    let finalResult: unknown = undefined;
    let overallSuccess = true;
    let overallError: string | undefined;

    for (const step of plan.steps) {
      const stepResult = await this.executeStep(step, context);
      stepResults.push(stepResult);

      if (!stepResult.success) {
        overallSuccess = false;
        overallError = `步骤 ${step.stepId} 执行失败: ${stepResult.error}`;
        break;
      }

      // 存储结果供后续步骤引用
      context.setStepResult(step.stepId, stepResult.result);
      finalResult = stepResult.result;
    }

    return {
      planId: plan.id,
      steps: stepResults,
      finalResult,
      success: overallSuccess,
      error: overallError,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    const executedAt = new Date().toISOString();

    try {
      // 解析参数
      const resolvedParams = context.resolveParameters(step.parameters);

      // 执行函数
      const result = this.registry.execute(step.functionName, resolvedParams);

      return {
        stepId: step.stepId,
        functionName: step.functionName,
        parameters: resolvedParams,
        result,
        success: true,
        executedAt,
      };
    } catch (error) {
      return {
        stepId: step.stepId,
        functionName: step.functionName,
        parameters: {},
        result: undefined,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executedAt,
      };
    }
  }

  /**
   * 格式化执行结果用于显示
   */
  formatResultForDisplay(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push(`执行结果 - 计划 #${result.planId}`);
    lines.push('');

    for (const step of result.steps) {
      const icon = step.success ? '✅' : '❌';
      const params = Object.entries(step.parameters)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');

      lines.push(`${icon} Step ${step.stepId}: ${step.functionName}(${params})`);

      if (step.success) {
        lines.push(`   → 结果: ${JSON.stringify(step.result)}`);
      } else {
        lines.push(`   → 错误: ${step.error}`);
      }
    }

    lines.push('');

    if (result.success) {
      lines.push(`📦 最终结果: ${JSON.stringify(result.finalResult)}`);
    } else {
      lines.push(`❌ 执行失败: ${result.error}`);
    }

    return lines.join('\n');
  }
}
