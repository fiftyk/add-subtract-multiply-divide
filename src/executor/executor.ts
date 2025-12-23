import type { FunctionRegistry } from '../registry/index.js';
import type { ExecutionPlan } from '../planner/types.js';
import type { ExecutionResult, StepResult } from './types.js';
import { ExecutionContext } from './context.js';
import {
  FunctionExecutionError,
  ExecutionTimeoutError,
  getUserFriendlyMessage,
} from '../errors/index.js';

/**
 * Executor 配置选项
 */
export interface ExecutorConfig {
  /**
   * 单个步骤执行超时时间（毫秒）
   * 默认: 30000 (30秒)
   * 设置为 0 表示不限制超时
   */
  stepTimeout?: number;
}

/**
 * 执行引擎 - 按照计划顺序执行 functions
 */
export class Executor {
  private registry: FunctionRegistry;
  private config: Required<ExecutorConfig>;

  constructor(registry: FunctionRegistry, config: ExecutorConfig = {}) {
    this.registry = registry;
    this.config = {
      stepTimeout: config.stepTimeout ?? 30000, // 默认 30 秒
    };
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
      const stepResult = await this.executeStepWithTimeout(step, context);
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
   * 带超时控制的步骤执行
   */
  private async executeStepWithTimeout(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    // 如果超时设置为 0，不限制超时
    if (this.config.stepTimeout === 0) {
      return this.executeStep(step, context);
    }

    try {
      // 使用 Promise.race 实现超时
      return await Promise.race([
        this.executeStep(step, context),
        this.createTimeoutPromise(step.stepId, step.functionName, this.config.stepTimeout),
      ]);
    } catch (error) {
      // 捕获超时错误并转换为 StepResult 格式
      if (error instanceof ExecutionTimeoutError) {
        // 解析参数以包含在错误结果中
        const resolvedParams = context.resolveParameters(step.parameters);
        return {
          stepId: step.stepId,
          functionName: step.functionName,
          parameters: resolvedParams,
          result: undefined,
          success: false,
          error: error.message,
          executedAt: new Date().toISOString(),
        };
      }
      throw error; // 重新抛出非超时错误
    }
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(
    stepId: number,
    functionName: string,
    timeout: number
  ): Promise<StepResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ExecutionTimeoutError(stepId, functionName, timeout));
      }, timeout);
    });
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    const executedAt = new Date().toISOString();
    let resolvedParams: Record<string, unknown> = {};

    try {
      // 解析参数
      resolvedParams = context.resolveParameters(step.parameters);

      // 执行函数（支持异步）
      const result = await this.registry.execute(step.functionName, resolvedParams);

      return {
        stepId: step.stepId,
        functionName: step.functionName,
        parameters: resolvedParams,
        result,
        success: true,
        executedAt,
      };
    } catch (error) {
      // 包装为 FunctionExecutionError 以保留上下文
      const executionError = new FunctionExecutionError(
        step.functionName,
        resolvedParams,
        error
      );

      return {
        stepId: step.stepId,
        functionName: step.functionName,
        parameters: resolvedParams,
        result: undefined,
        success: false,
        error: getUserFriendlyMessage(executionError),
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
