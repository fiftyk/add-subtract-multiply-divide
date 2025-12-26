import 'reflect-metadata';
import { injectable, inject, optional, unmanaged } from 'inversify';
import { FunctionRegistry } from '../registry/interfaces/FunctionRegistry.js';
import type { ExecutionPlan, FunctionCallStep, UserInputStep } from '../planner/types.js';
import { StepType } from '../planner/types.js';
import { isFunctionCallStep, isUserInputStep } from '../planner/type-guards.js';
import type {
  ExecutionResult,
  StepResult,
  FunctionCallResult,
  UserInputResult,
} from './types.js';
import type { Executor } from './interfaces/Executor.js';
import { ExecutionContext } from './context.js';
import {
  FunctionExecutionError,
  ExecutionTimeoutError,
  getUserFriendlyMessage,
  UnsupportedFieldTypeError,
} from '../errors/index.js';
import type { ILogger } from '../logger/index.js';
import { LoggerFactory } from '../logger/index.js';
import { PlanValidator } from '../validation/index.js';
import { ConfigManager } from '../config/index.js';
import { UserInputProvider } from '../user-input/interfaces/UserInputProvider.js';
import type { RemoteFunctionRegistry } from '../mcp/interfaces/RemoteFunctionRegistry.js';
import { RemoteFunctionRegistrySymbol } from '../mcp/interfaces/RemoteFunctionRegistry.js';

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
 */
@injectable()
export class ExecutorImpl implements Executor {
  private registry: FunctionRegistry;
  private remoteRegistry?: RemoteFunctionRegistry;
  private userInputProvider?: UserInputProvider;
  private config: Required<ExecutorConfig>;
  private logger: ILogger;

  constructor(
    @inject(FunctionRegistry) registry: FunctionRegistry,
    @unmanaged() config?: ExecutorConfig,
    @inject(RemoteFunctionRegistrySymbol) @optional() remoteRegistry?: RemoteFunctionRegistry,
    @inject(UserInputProvider) @optional() userInputProvider?: UserInputProvider
  ) {
    this.registry = registry;
    this.remoteRegistry = remoteRegistry;
    this.userInputProvider = userInputProvider;
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
  private async executeStepWithTimeout(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    // 如果超时设置为 0，不限��超时
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
   */
  private async executeStep(
    step: ExecutionPlan['steps'][0],
    context: ExecutionContext
  ): Promise<StepResult> {
    if (isFunctionCallStep(step)) {
      return this.executeFunctionCall(step, context);
    } else if (isUserInputStep(step)) {
      return this.executeUserInput(step, context);
    } else {
      // 类型守卫应该确保永远不会到这里
      const exhaustiveCheck: never = step;
      throw new Error(`Unknown step type: ${(exhaustiveCheck as any).type}`);
    }
  }

  /**
   * 执行函数调用步骤
   */
  private async executeFunctionCall(
    step: FunctionCallStep,
    context: ExecutionContext
  ): Promise<FunctionCallResult> {
    const executedAt = new Date().toISOString();
    let resolvedParams: Record<string, unknown> = {};

    try {
      // 解析参数
      resolvedParams = context.resolveParameters(step.parameters);

      // 优先查找本地函数
      if (this.registry.has(step.functionName)) {
        const result = await this.registry.execute(step.functionName, resolvedParams);
        return {
          stepId: step.stepId,
          type: StepType.FUNCTION_CALL,
          functionName: step.functionName,
          parameters: resolvedParams,
          result,
          success: true,
          executedAt,
        };
      }

      // 检查远程函数（MCP）
      if (this.remoteRegistry && await this.remoteRegistry.has(step.functionName)) {
        // 连接远程注册中心（如果尚未连接）
        if (!this.remoteRegistry.isConnected()) {
          await this.remoteRegistry.connect();
        }

        const remoteResult = await this.remoteRegistry.execute(step.functionName, resolvedParams);

        if (remoteResult.success) {
          return {
            stepId: step.stepId,
            type: StepType.FUNCTION_CALL,
            functionName: step.functionName,
            parameters: resolvedParams,
            result: remoteResult.content,
            success: true,
            executedAt,
          };
        } else {
          throw new Error(remoteResult.error || 'Remote function execution failed');
        }
      }

      // 函数不存在
      throw new Error(`Function not found: ${step.functionName}`);
    } catch (error) {
      // 包装为 FunctionExecutionError 以保留上下文
      const executionError = new FunctionExecutionError(
        step.functionName,
        resolvedParams,
        error
      );

      return {
        stepId: step.stepId,
        type: StepType.FUNCTION_CALL,
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
   * 执行用户输入步骤
   */
  private async executeUserInput(
    step: UserInputStep,
    context: ExecutionContext
  ): Promise<UserInputResult> {
    const executedAt = new Date().toISOString();

    try {
      // 检查是否有 UserInputProvider
      if (!this.userInputProvider) {
        throw new Error(
          'User input step requires a UserInputProvider, but none was provided to Executor'
        );
      }

      this.logger.info('Requesting user input', { stepId: step.stepId });

      // 检查所有字段类型是否支持
      for (const field of step.schema.fields) {
        if (!this.userInputProvider.supportsFieldType(field.type)) {
          throw new UnsupportedFieldTypeError(field.type, 'CLIUserInputProvider');
        }
      }

      // 请求用户输入
      const result = await this.userInputProvider.requestInput(step.schema);

      this.logger.info('User input received', {
        stepId: step.stepId,
        skipped: result.skipped,
        fieldCount: Object.keys(result.values).length,
      });

      return {
        stepId: step.stepId,
        type: StepType.USER_INPUT,
        values: result.values,
        skipped: result.skipped,
        timestamp: result.timestamp,
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
}
