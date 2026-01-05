import 'reflect-metadata';
import { injectable, inject, optional, unmanaged } from 'inversify';
import type { ExecutionPlan, FunctionCallStep, UserInputStep } from '../../planner/types.js';
import { StepType } from '../../planner/types.js';
import { isFunctionCallStep, isUserInputStep, isConditionalStep } from '../../planner/type-guards.js';
import type {
  ExecutionResult,
  StepResult,
  FunctionCallResult,
  UserInputResult,
} from '../types.js';
import type { Executor } from '../interfaces/Executor.js';
import { ExecutionContext } from '../context.js';
import {
  FunctionExecutionError,
  ExecutionTimeoutError,
  getUserFriendlyMessage,
  UnsupportedFieldTypeError,
} from '../../errors/index.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';
import { PlanValidator } from '../../validation/index.js';
import { ConfigManager } from '../../config/index.js';
import { A2UIRenderer } from '../../a2ui/A2UIRenderer.js';
import type { A2UIRenderer as A2UIRendererType } from '../../a2ui/A2UIRenderer.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';

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

  /**
   * Logger instance (optional)
   */
  logger?: ILogger;
}

/**
 * 执行引擎 - 按照计划顺序执行 functions
 * 使用统一的 FunctionProvider 接口，支持本地和远程函数
 */
@injectable()
export class ExecutorImpl implements Executor {
  protected functionProvider: FunctionProvider;
  protected a2uiRenderer?: A2UIRendererType;
  protected config: Required<ExecutorConfig>;
  protected logger: ILogger;

  constructor(
    @inject(FunctionProvider) functionProvider: FunctionProvider,
    @unmanaged() config?: ExecutorConfig,
    @inject(A2UIRenderer) @optional() a2uiRenderer?: A2UIRendererType
  ) {
    this.functionProvider = functionProvider;
    this.a2uiRenderer = a2uiRenderer;
    const appConfig = ConfigManager.get();
    this.config = {
      stepTimeout: config?.stepTimeout ?? appConfig.executor.stepTimeout,
      logger: config?.logger ?? LoggerFactory.create(),
    };
    this.logger = this.config.logger;
  }

  /**
   * 执行计划
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    // Validate plan before execution
    PlanValidator.validatePlan(plan);

    this.logger.debug('📝 执行计划', { planId: plan.id, stepsCount: plan.steps.length });

    const context = new ExecutionContext();
    const stepResults: StepResult[] = [];
    const startedAt = new Date().toISOString();

    let finalResult: unknown = undefined;
    let overallSuccess = true;
    let overallError: string | undefined;

    for (const step of plan.steps) {
      const stepDesc = isFunctionCallStep(step)
        ? `function: ${step.functionName}`
        : 'user input';
      this.logger.debug('Executing step', { stepId: step.stepId, type: stepDesc });

      const stepResult = await this.executeStepWithTimeout(step, context);
      stepResults.push(stepResult);

      if (!stepResult.success) {
        overallSuccess = false;
        overallError = `步骤 ${step.stepId} 执行失败: ${stepResult.error}`;
        this.logger.error('Step execution failed', undefined, {
          stepId: step.stepId,
          type: stepResult.type,
          error: stepResult.error,
        });
        break;
      }

      // 存储结果供后续步骤引用
      if (stepResult.type === StepType.FUNCTION_CALL) {
        context.setStepResult(step.stepId, stepResult.result);
        finalResult = stepResult.result;
      } else if (stepResult.type === StepType.USER_INPUT) {
        // 用户输入步骤存储整个 values 对象
        context.setStepResult(step.stepId, stepResult.values);
        finalResult = stepResult.values;
      }

      this.logger.debug('Step completed successfully', {
        stepId: step.stepId,
        type: stepResult.type
      });
    }

    const result: ExecutionResult = {
      planId: plan.id,
      steps: stepResults,
      finalResult,
      success: overallSuccess,
      error: overallError,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    this.logger.debug('📝 计划执行完成', {
      planId: plan.id,
      success: overallSuccess,
      stepsCompleted: stepResults.length,
    });

    return result;
  }

  /**
   * 带超时控制的步骤执行
   */
  protected async executeStepWithTimeout(
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
        this.createTimeoutPromise(step.stepId, this.config.stepTimeout),
      ]);
    } catch (error) {
      // 捕获超时错误并转换为 StepResult 格式
      if (error instanceof ExecutionTimeoutError) {
        if (isFunctionCallStep(step)) {
          // 函数调用步骤超时
          const resolvedParams = context.resolveParameters(step.parameters);
          return {
            stepId: step.stepId,
            type: StepType.FUNCTION_CALL,
            functionName: step.functionName,
            parameters: resolvedParams,
            result: undefined,
            success: false,
            error: error.message,
            executedAt: new Date().toISOString(),
          };
        } else {
          // 用户输入步骤超时
          return {
            stepId: step.stepId,
            type: StepType.USER_INPUT,
            values: {},
            success: false,
            error: error.message,
            executedAt: new Date().toISOString(),
          };
        }
      }
      throw error; // 重新抛出非超时错误
    }
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(
    stepId: number,
    timeout: number
  ): Promise<StepResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ExecutionTimeoutError(stepId, 'step execution', timeout));
      }, timeout);
    });
  }

  /**
   * 执行单个步骤（根据类型分派）
   * 注意：ConditionalStep 由子类 ConditionalExecutor 处理
   */
  protected async executeStep(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    if (isFunctionCallStep(step)) {
      return this.executeFunctionCall(step, context);
    } else if (isUserInputStep(step)) {
      return this.executeUserInput(step, context);
    } else if (isConditionalStep(step)) {
      // ConditionalStep 由子类处理，基类抛出错误
      throw new Error(
        `ConditionalStep (step ${step.stepId}) requires ConditionalExecutor. ` +
        `Please use ConditionalExecutor or a subclass to execute plans with condition steps.`
      );
    } else {
      // 这是一个防御性检查，理论上不应该到达这里
      const exhaustiveCheck: never = step;
      throw new Error(`Unknown step type: ${(exhaustiveCheck as any).type}`);
    }
  }

  /**
   * 执行函数调用步骤
   * 使用统一的 FunctionProvider 接口，无需判断本地/远程
   */
  protected async executeFunctionCall(
    step: FunctionCallStep,
    context: ExecutionContext
  ): Promise<FunctionCallResult> {
    const executedAt = new Date().toISOString();

    try {
      // 解析参数
      const resolvedParams = context.resolveParameters(step.parameters);

      // 使用统一的 FunctionProvider 执行函数
      const result = await this.functionProvider.execute(step.functionName, resolvedParams);

      if (result.success) {
        return {
          stepId: step.stepId,
          type: StepType.FUNCTION_CALL,
          functionName: step.functionName,
          parameters: resolvedParams,
          result: result.result,
          success: true,
          executedAt,
        };
      } else {
        throw new Error(result.error || 'Function execution failed');
      }
    } catch (error) {
      // 包装为 FunctionExecutionError 以保留上下文
      const executionError = new FunctionExecutionError(
        step.functionName,
        context.resolveParameters(step.parameters),
        error
      );

      return {
        stepId: step.stepId,
        type: StepType.FUNCTION_CALL,
        functionName: step.functionName,
        parameters: context.resolveParameters(step.parameters),
        result: undefined,
        success: false,
        error: getUserFriendlyMessage(executionError),
        executedAt,
      };
    }
  }

  /**
   * 执行用户输入步骤
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async executeUserInput(
    step: UserInputStep,
    _context: ExecutionContext
  ): Promise<UserInputResult> {
    const executedAt = new Date().toISOString();

    try {
      // 检查是否有 A2UIRenderer
      if (!this.a2uiRenderer) {
        throw new Error(
          'User input step requires an A2UIRenderer, but none was provided to Executor'
        );
      }

      this.logger.info('Requesting user input', { stepId: step.stepId });

      // TODO: Implement user input via A2UIRenderer
      // For now, create a simple surface with the schema fields
      const surfaceId = `user-input-${step.stepId}`;
      this.a2uiRenderer.begin(surfaceId, 'root');
      
      // Render form fields
      const components = step.schema.fields.map((field, index) => ({
        id: `field-${index}`,
        component: {
          TextField: {
            label: field.label,
            name: field.id,
            placeholder: field.description,
            required: field.required,
          }
        }
      }));
      
      this.a2uiRenderer.update(surfaceId, [{
        id: 'root',
        component: { Column: { children: components.map(c => c.id) } }
      }, ...components]);
      
      // Request input from first field (simplified)
      const result = await this.a2uiRenderer.requestInput(surfaceId, 'field-0');
      
      this.a2uiRenderer.end(surfaceId);

      // Extract values from A2UIUserAction payload
      const values = result.payload || {};

      this.logger.info('User input received', {
        stepId: step.stepId,
        fieldCount: Object.keys(values).length,
      });

      return {
        stepId: step.stepId,
        type: StepType.USER_INPUT,
        values,
        skipped: false,
        timestamp: Date.now(),
        success: true,
        executedAt,
      };
    } catch (error) {
      const err = error instanceof Error ? error : undefined;
      this.logger.error('User input failed', err, { stepId: step.stepId });

      return {
        stepId: step.stepId,
        type: StepType.USER_INPUT,
        values: {},
        success: false,
        error: error instanceof Error ? error.message : String(error),
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

      if (step.type === StepType.FUNCTION_CALL) {
        // 函数调用步骤
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
        // 用户输入步骤
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

  /**
   * 获取执行器的计划规则描述（用于 LLM prompt）
   */
  getPlanRulesForLLM(): string {
    return `执行器支持以下步骤类型：
1. 函数调用 (function_call): 调用注册的函数
   - 参数: functionName (函数名), parameters (参数字典)
   - 引用格式: step.X.result 获取步骤结果

2. 用户输入 (user_input): 收集用户输入
   - 参数: schema (输入字段定义)
   - 引用格式: step.X.result 获取输入值`;
  }
}
