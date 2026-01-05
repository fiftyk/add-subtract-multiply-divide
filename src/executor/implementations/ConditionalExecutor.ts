/**
 * ConditionalExecutor - 支持条件分支的执行引擎
 *
 * 职责：
 * - 继承 ExecutorImpl 的所有功能
 * - 支持条件分支步骤的条件求值和分支执行
 * - 使用 ConditionEvaluator 进行条件表达式求值
 * - 处理 onTrue/onFalse 步骤分支
 */

import 'reflect-metadata';
import { injectable, inject, unmanaged } from 'inversify';
import type { ExecutionPlan, ConditionalStep } from '../../planner/types.js';
import { StepType } from '../../planner/types.js';
import { isConditionalStep } from '../../planner/type-guards.js';
import type {
  ExecutionResult,
  StepResult,
  ConditionalResult,
} from '../types.js';
import type { Executor } from '../interfaces/Executor.js';
import { ExecutorImpl } from './ExecutorImpl.js';
import { ExecutionContext } from '../context.js';
import type { ConditionEvaluator, ConditionContext } from '../interfaces/ConditionEvaluator.js';
import { JSConditionEvaluator } from './JSConditionEvaluator.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { A2UIRenderer } from '../../a2ui/A2UIRenderer.js';

export interface ConditionalExecutorConfig {
  /**
   * 单个步骤执行超时时间（毫秒）
   */
  stepTimeout?: number;

  /**
   * Logger 实例
   */
  logger?: ILogger;

  /**
   * 条件求值器实例（可选，默认使用 JSConditionEvaluator）
   */
  conditionEvaluator?: ConditionEvaluator;
}

/**
 * 条件执行上下文
 * 实现 ConditionEvaluator 所需的 ConditionContext 接口
 */
class ConditionExecutionContext implements ConditionContext {
  stepResults: Map<number, unknown>;
  variables: Map<string, unknown>;

  constructor(private context: ExecutionContext) {
    this.stepResults = context.getResults() as Map<number, unknown>;
    this.variables = new Map();
  }

  getStepResult(stepId: number): unknown {
    return this.context.getStepResult(stepId);
  }

  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }
}

/**
 * 支持条件分支的执行引擎
 *
 * 使用示例：
 * ```typescript
 * const executor = new ConditionalExecutor(functionProvider);
 * const result = await executor.execute(plan);
 * ```
 */
@injectable()
export class ConditionalExecutor extends ExecutorImpl implements Executor {
  private conditionEvaluator: ConditionEvaluator;

  constructor(
    @inject(FunctionProvider) functionProvider: FunctionProvider,
    @unmanaged() config?: ConditionalExecutorConfig,
    @inject(A2UIRenderer) a2uiRenderer?: A2UIRenderer
  ) {
    super(functionProvider, config, a2uiRenderer);

    // 初始化条件求值器
    this.conditionEvaluator = config?.conditionEvaluator ?? new JSConditionEvaluator();
  }

  /**
   * 执行计划（覆盖父类方法，支持条件分支）
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    // 验证计划
    this.validatePlan(plan);

    this.logger.debug('ConditionalExecutor: 执行计划', { planId: plan.id, stepsCount: plan.steps.length });

    const context = new ExecutionContext();
    const stepResults: StepResult[] = [];
    const startedAt = new Date().toISOString();

    // 执行状态（用于在分支递归中共享）
    const state = {
      finalResult: undefined as unknown,
      overallSuccess: true,
      overallError: undefined as string | undefined,
    };

    // 创建条件执行上下文
    const conditionContext = new ConditionExecutionContext(context);

    // 获取执行顺序
    const executionOrder = this.calculateExecutionOrder(plan);

    // 跟踪已执行的条件步骤结果
    const executedConditions = new Map<number, boolean>();
    // 跟踪在分支循环中已执行的条件步骤（避免在主循环中重复执行）
    const executedInBranch = new Set<number>();

    for (const stepId of executionOrder) {
      // 找到对应的步骤
      const step = plan.steps.find(s => s.stepId === stepId);
      if (!step) {
        this.logger.warn('步骤不存在', { stepId });
        continue;
      }

      // 如果步骤已在分支循环中执行过，跳过
      if (executedInBranch.has(stepId)) {
        this.logger.debug('跳过已执行的步骤（在分支循环中）', { stepId });
        continue;
      }

      // 检查步骤是否应该被跳过（在非执行分支中）
      if (this.shouldSkipStep(stepId, executedConditions, plan)) {
        this.logger.debug('跳过步骤（在其父条件的非执行分支中）', { stepId });
        continue;
      }

      const stepDesc = this.getStepDescription(step);
      this.logger.debug('执行步骤', { stepId, type: stepDesc });

      const stepResult = await this.executeStepWithTimeout(step, context);

      // 如果是条件步骤，需要处理分支
      if (isConditionalStep(step)) {
        // 记录条件结果供后续步骤判断是否跳过
        executedConditions.set(stepId, stepResult.success && (stepResult as ConditionalResult).evaluatedResult);

        const conditionalResult = stepResult as ConditionalResult;

        // 根据条件结果，执行相应的分支
        const branchToExecute = conditionalResult.evaluatedResult ? step.onTrue : step.onFalse;
        const skippedBranch = conditionalResult.evaluatedResult ? step.onFalse : step.onTrue;

        conditionalResult.skippedSteps = skippedBranch;

        // 记录分支执行日志
        this.logger.info('条件分支执行', {
          stepId: step.stepId,
          condition: step.condition,
          result: conditionalResult.evaluatedResult,
          executedBranch: conditionalResult.executedBranch,
          executedSteps: branchToExecute,
          skippedSteps: skippedBranch,
        });

        // 执行分支步骤（递归处理嵌套条件）
        await this.executeBranchSteps(
          branchToExecute,
          context,
          stepResults,
          executedConditions,
          executedInBranch,
          plan,
          state
        );

        // 如果分支执行失败，跳出循环
        if (!state.overallSuccess) {
          break;
        }
      }

      stepResults.push(stepResult);

      if (!stepResult.success) {
        state.overallSuccess = false;
        state.overallError = `步骤 ${step.stepId} 执行失败: ${stepResult.error}`;
        this.logger.error('步骤执行失败', undefined, {
          stepId: step.stepId,
          type: stepResult.type,
          error: stepResult.error,
        });
        break;
      }

      // 存储结果供后续步骤引用
      // 注意：对于条件步骤，不调用 processStepResult，因为分支步骤的结果已经在分支循环中设置
      if (!isConditionalStep(step)) {
        this.processStepResult(step, stepResult, context, stepResults);

        // 仅当步骤有实际结果时才更新 finalResult
        const stepFinalResult = this.getFinalResult(step, stepResult);
        if (stepFinalResult !== undefined) {
          state.finalResult = stepFinalResult;
        }
      }

      this.logger.debug('步骤执行成功', { stepId: step.stepId, type: stepResult.type });
    }

    const result: ExecutionResult = {
      planId: plan.id,
      steps: stepResults,
      finalResult: state.finalResult,
      success: state.overallSuccess,
      error: state.overallError,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    this.logger.debug('计划执行完成', {
      planId: plan.id,
      success: state.overallSuccess,
      stepsCompleted: stepResults.length,
    });

    return result;
  }

  /**
   * 递归执行分支步骤（处理嵌套条件）
   */
  private async executeBranchSteps(
    stepIds: number[],
    context: ExecutionContext,
    stepResults: StepResult[],
    executedConditions: Map<number, boolean>,
    executedInBranch: Set<number>,
    plan: ExecutionPlan,
    state: { overallSuccess: boolean; overallError: string | undefined; finalResult: unknown }
  ): Promise<void> {
    for (const branchStepId of stepIds) {
      const branchStep = plan.steps.find(s => s.stepId === branchStepId);
      if (!branchStep) continue;

      // 如果分支步骤是条件步骤，标记为已执行（在分支循环中）
      if (isConditionalStep(branchStep)) {
        executedInBranch.add(branchStepId);
      }

      const branchResult = await this.executeStepWithTimeout(branchStep, context);
      stepResults.push(branchResult);

      if (!branchResult.success) {
        state.overallSuccess = false;
        state.overallError = `步骤 ${branchStepId} 执行失败: ${branchResult.error}`;
        return;
      }

      // 如果是条件步骤，递归执行其分支
      if (isConditionalStep(branchStep)) {
        const conditionalResult = branchResult as ConditionalResult;
        executedConditions.set(branchStepId, conditionalResult.evaluatedResult);

        const subBranchToExecute = conditionalResult.evaluatedResult ? branchStep.onTrue : branchStep.onFalse;
        const subSkippedBranch = conditionalResult.evaluatedResult ? branchStep.onFalse : branchStep.onTrue;
        conditionalResult.skippedSteps = subSkippedBranch;

        // 递归执行子分支
        await this.executeBranchSteps(subBranchToExecute, context, stepResults, executedConditions, executedInBranch, plan, state);
      }

      // 存储分支步骤结果
      context.setStepResult(branchStepId, this.getFinalResult(branchStep, branchResult));
      state.finalResult = this.getFinalResult(branchStep, branchResult);
    }
  }

  /**
   * 计算执行顺序
   * 只添加条件步骤本身，不预先处理分支
   * 分支步骤在运行时根据条件结果动态处理
   */
  private calculateExecutionOrder(plan: ExecutionPlan): number[] {
    const order: number[] = [];

    for (const step of plan.steps) {
      if (isConditionalStep(step)) {
        // 只添加条件步骤本身
        order.push(step.stepId);
      } else {
        // 普通步骤添加
        order.push(step.stepId);
      }
    }

    return order;
  }

  /**
   * 检查步骤是否应该被跳过（在其父条件的非执行分支中）
   */
  private shouldSkipStep(stepId: number, executedConditions: Map<number, boolean>, plan: ExecutionPlan): boolean {
    // 递归检查所有祖先条件
    return this.isInSkippedBranch(stepId, undefined, executedConditions, plan);
  }

  /**
   * 递归检查步骤是否在某个被跳过的分支中
   */
  private isInSkippedBranch(
    stepId: number,
    excludeConditionId: number | undefined,
    executedConditions: Map<number, boolean>,
    plan: ExecutionPlan
  ): boolean {
    // 首先检查步骤是否在任何直接分支中
    let foundInBranch = false;

    for (const step of plan.steps) {
      if (isConditionalStep(step) && step.stepId !== excludeConditionId) {
        // 检查当前步骤是否在这个条件的分支中
        if (step.onTrue.includes(stepId)) {
          foundInBranch = true;
          // 步骤在 onTrue 分支中
          const conditionResult = executedConditions.get(step.stepId);
          if (conditionResult === undefined) {
            // 条件还没执行，递归检查父条件
            return this.isInSkippedBranch(step.stepId, excludeConditionId, executedConditions, plan);
          }
          if (conditionResult === false) {
            // 条件执行了 onFalse，onTrue 分支应该跳过
            return true;
          }
          // 条件执行了 onTrue，当前分支不需要跳过
          return false;
        } else if (step.onFalse.includes(stepId)) {
          foundInBranch = true;
          // 步骤在 onFalse 分支中
          const conditionResult = executedConditions.get(step.stepId);
          if (conditionResult === undefined) {
            // 条件还没执行，递归检查父条件
            return this.isInSkippedBranch(step.stepId, excludeConditionId, executedConditions, plan);
          }
          if (conditionResult === true) {
            // 条件执行了 onTrue，onFalse 分支应该跳过
            return true;
          }
          // 条件执行了 onFalse，当前分支不需要跳过
          return false;
        }
      }
    }

    // 如果步骤不在任何分支中，检查它是否被祖先条件间接跳过
    if (!foundInBranch) {
      for (const [conditionId, conditionResult] of executedConditions) {
        const conditionStep = plan.steps.find(s => s.stepId === conditionId);
        if (conditionStep && isConditionalStep(conditionStep)) {
          const inOnTrue = conditionStep.onTrue.includes(stepId);
          const inOnFalse = conditionStep.onFalse.includes(stepId);

          if (inOnTrue || inOnFalse) {
            if (conditionResult === false && inOnTrue) {
              return true;
            }
            if (conditionResult === true && inOnFalse) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 执行单个步骤
   */
  protected async executeStep(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    if (isConditionalStep(step)) {
      return this.executeConditional(step, context);
    }
    // 调用父类方法处理其他步骤类型
    return super.executeStep(step, context);
  }

  /**
   * 执行条件分支步骤
   */
  private async executeConditional(
    step: ConditionalStep,
    context: ExecutionContext
  ): Promise<ConditionalResult> {
    const executedAt = new Date().toISOString();

    try {
      // 创建条件上下文
      const conditionContext = new ConditionExecutionContext(context);

      // 检查条件求值器是否支持该表达式
      if (!this.conditionEvaluator.supports(step.condition)) {
        return {
          stepId: step.stepId,
          type: StepType.CONDITION,
          condition: step.condition,
          evaluatedResult: false,
          executedBranch: 'none',
          skippedSteps: [],
          success: false,
          error: `不支持的条件表达式: ${step.condition}`,
          executedAt,
        };
      }

      // 求值条件表达式
      const evaluatedResult = this.conditionEvaluator.evaluate(step.condition, conditionContext);

      // 如果设置了 outputVariable，存储结果到变量
      if (step.outputVariable) {
        conditionContext.setVariable(step.outputVariable, evaluatedResult);
      }

      this.logger.debug('条件求值结果', {
        stepId: step.stepId,
        condition: step.condition,
        result: evaluatedResult,
      });

      return {
        stepId: step.stepId,
        type: StepType.CONDITION,
        condition: step.condition,
        evaluatedResult,
        executedBranch: evaluatedResult ? 'onTrue' : 'onFalse',
        skippedSteps: [],
        success: true,
        executedAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('条件求值失败', error as Error, { stepId: step.stepId, condition: step.condition });

      return {
        stepId: step.stepId,
        type: StepType.CONDITION,
        condition: step.condition,
        evaluatedResult: false,
        executedBranch: 'none',
        skippedSteps: [],
        success: false,
        error: errorMessage,
        executedAt,
      };
    }
  }

  /**
   * 处理步骤结果
   */
  private processStepResult(
    step: ExecutionPlan['steps'][0],
    result: StepResult,
    context: ExecutionContext,
    results: StepResult[]
  ): void {
    if (result.type === StepType.FUNCTION_CALL) {
      context.setStepResult(step.stepId, result.result);
    } else if (result.type === StepType.USER_INPUT) {
      context.setStepResult(step.stepId, result.values);
    } else if (result.type === StepType.CONDITION) {
      // 条件步骤不存储结果到上下文，除非指定了 outputVariable
      // 结果已经存储在 variables 中
    }
  }

  /**
   * 获取最终结果
   */
  private getFinalResult(step: ExecutionPlan['steps'][0], result: StepResult): unknown {
    if (result.type === StepType.FUNCTION_CALL) {
      return result.result;
    } else if (result.type === StepType.USER_INPUT) {
      return result.values;
    }
    return undefined;
  }

  /**
   * 获取步骤描述
   */
  private getStepDescription(step: ExecutionPlan['steps'][0]): string {
    if (step.type === StepType.FUNCTION_CALL) {
      return `function: ${step.functionName}`;
    } else if (step.type === StepType.USER_INPUT) {
      return 'user input';
    } else if (step.type === StepType.CONDITION) {
      return `condition: ${step.condition}`;
    }
    return 'unknown';
  }

  /**
   * 验证计划（检查条件步骤的引用是否有效）
   */
  private validatePlan(plan: ExecutionPlan): void {
    const stepIds = new Set(plan.steps.map(s => s.stepId));

    for (const step of plan.steps) {
      if (isConditionalStep(step)) {
        // 检查 onTrue 和 onFalse 中的步骤 ID 是否存在
        for (const id of step.onTrue) {
          if (!stepIds.has(id)) {
            throw new Error(`条件步骤 ${step.stepId} 的 onTrue 引用了不存在的步骤 ${id}`);
          }
        }
        for (const id of step.onFalse) {
          if (!stepIds.has(id)) {
            throw new Error(`条件步骤 ${step.stepId} 的 onFalse 引用了不存在的步骤 ${id}`);
          }
        }
      }
    }
  }

  /**
   * 格式化执行结果用于显示（覆盖父类方法，支持条件步骤）
   */
  formatResultForDisplay(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push(`执行结果 - 计划 #${result.planId}`);
    lines.push('');

    for (const step of result.steps) {
      const icon = step.success ? '✅' : '❌';

      if (step.type === StepType.FUNCTION_CALL) {
        const params = Object.entries(step.parameters)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');

        lines.push(`${icon} Step ${step.stepId}: ${step.functionName}(${params})`);

        if (step.success) {
          lines.push(`   → 结果: ${JSON.stringify(step.result)}`);
        } else {
          lines.push(`   → 错误: ${step.error}`);
        }
      } else if (step.type === StepType.USER_INPUT) {
        lines.push(`${icon} Step ${step.stepId}: [User Input]`);

        if (step.success) {
          if (step.skipped) {
            lines.push(`   → 已跳过`);
          } else {
            const values = Object.entries(step.values)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(', ');
            lines.push(`   → 输入: ${values}`);
          }
        } else {
          lines.push(`   → 错误: ${step.error}`);
        }
      } else if (step.type === StepType.CONDITION) {
        lines.push(`${icon} Step ${step.stepId}: [Condition]`);
        lines.push(`   → 条件: ${step.condition}`);
        lines.push(`   → 结果: ${step.evaluatedResult ? 'true' : 'false'}`);
        lines.push(`   → 执行分支: ${step.executedBranch}`);
        if (step.skippedSteps.length > 0) {
          lines.push(`   → 跳过步骤: ${step.skippedSteps.join(', ')}`);
        }
        if (!step.success) {
          lines.push(`   → 错误: ${step.error}`);
        }
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
