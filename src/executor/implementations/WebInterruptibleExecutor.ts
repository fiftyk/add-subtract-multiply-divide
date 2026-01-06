/**
 * Web Interruptible Executor
 *
 * Executes plans with pause/resume capability for user input.
 * Uses callbacks to communicate with the web UI via SSE.
 */

import { inject, injectable } from 'inversify';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import type { ExecutionPlan, FunctionCallStep, UserInputStep } from '../../planner/types.js';
import { StepType } from '../../planner/types.js';
import { isFunctionCallStep, isUserInputStep } from '../../planner/type-guards.js';
import type { ExecutionResult, StepResult, FunctionCallResult, UserInputResult } from '../types.js';
import { InterruptibleExecutor, ExecutorCallbacks } from '../interfaces/InterruptibleExecutor.js';
import type { ExecutionSession } from '../session/types.js';
import type { A2UIComponent, A2UISchema } from '../../a2ui/types.js';
import { ConfigManager } from '../../config/index.js';
import { LoggerFactory } from '../../logger/index.js';
import type { ILogger } from '../../logger/index.js';

/**
 * Web Interruptible Executor Implementation
 *
 * Executes plans step by step. When a user_input step is encountered,
 * it calls the onInputRequired callback and waits for user input.
 */
@injectable()
export class WebInterruptibleExecutor implements InterruptibleExecutor {
  private logger: ILogger;
  private stepTimeout: number;

  constructor(
    @inject(FunctionProvider) private functionProvider: FunctionProvider
  ) {
    this.logger = LoggerFactory.create(undefined, 'WebInterruptibleExecutor');
    this.stepTimeout = ConfigManager.get().executor.stepTimeout;
  }

  async execute(
    session: ExecutionSession,
    callbacks?: ExecutorCallbacks
  ): Promise<ExecutionResult> {
    const { plan } = session;
    const stepResults: StepResult[] = [];
    const startedAt = new Date().toISOString();
    let overallSuccess = true;
    let overallError: string | undefined;

    this.logger.debug('Starting execution', { planId: plan.id, stepsCount: plan.steps.length });

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepDesc = isFunctionCallStep(step)
        ? `function: ${step.functionName}`
        : 'user input';

      // Skip already completed steps (when resuming)
      if (step.stepId < session.currentStepId) {
        const existingResult = session.stepResults.find((r) => r.stepId === step.stepId);
        if (existingResult) {
          stepResults.push(existingResult);
          continue;
        }
      }

      this.logger.debug('Executing step', { stepId: step.stepId, type: stepDesc });

      let stepResult: StepResult;

      if (isFunctionCallStep(step)) {
        stepResult = await this.executeFunctionCall(step);
      } else if (isUserInputStep(step)) {
        stepResult = await this.executeUserInput(step, callbacks?.onInputRequired);
      } else {
        throw new Error(`Unknown step type: ${(step as any).type}`);
      }

      stepResults.push(stepResult);

      // Notify callback
      if (callbacks?.onStepComplete) {
        await callbacks.onStepComplete(stepResult);
      }

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

      this.logger.debug('Step completed', {
        stepId: step.stepId,
        type: stepResult.type,
      });
    }

    const result: ExecutionResult = {
      planId: plan.id,
      steps: stepResults,
      finalResult: stepResults.length > 0 ? this.getFinalResult(stepResults) : undefined,
      success: overallSuccess,
      error: overallError,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    this.logger.debug('Execution completed', {
      planId: plan.id,
      success: overallSuccess,
      stepsCompleted: stepResults.length,
    });

    return result;
  }

  private async executeFunctionCall(
    step: FunctionCallStep
  ): Promise<FunctionCallResult> {
    const executedAt = new Date().toISOString();

    try {
      // Resolve parameters
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(step.parameters || {})) {
        params[key] = value;
      }

      // Execute function
      const execResult = await this.functionProvider.execute(step.functionName, params);

      if (execResult.success) {
        return {
          stepId: step.stepId,
          type: StepType.FUNCTION_CALL,
          functionName: step.functionName,
          parameters: params,
          result: execResult.result,
          success: true,
          executedAt,
        };
      } else {
        throw new Error(execResult.error || 'Function execution failed');
      }
    } catch (error) {
      return {
        stepId: step.stepId,
        type: StepType.FUNCTION_CALL,
        functionName: step.functionName,
        parameters: {},
        result: undefined,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executedAt,
      };
    }
  }

  private async executeUserInput(
    step: UserInputStep,
    onInputRequired?: (surfaceId: string, schema: A2UISchema) => Promise<Record<string, unknown>>
  ): Promise<UserInputResult> {
    const executedAt = new Date().toISOString();

    if (!onInputRequired) {
      return {
        stepId: step.stepId,
        type: StepType.USER_INPUT,
        values: {},
        success: false,
        error: 'User input required but no callback provided',
        executedAt,
      };
    }

    // Convert step schema to A2UI schema
    const schema: A2UISchema = {
      version: '1.0',
      fields: step.schema.fields.map((field) => ({
        id: field.id,
        type: field.type as any,
        label: field.label,
        description: field.description,
        required: field.required,
        defaultValue: field.defaultValue,
        config: field.config,
      })),
    };

    const surfaceId = `user-input-${step.stepId}`;

    try {
      const values = await onInputRequired(surfaceId, schema);

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
      return {
        stepId: step.stepId,
        type: StepType.USER_INPUT,
        values: {},
        success: false,
        error: error instanceof Error ? error.message : 'Input cancelled',
        executedAt,
      };
    }
  }

  private getFinalResult(stepResults: StepResult[]): unknown {
    const lastResult = stepResults[stepResults.length - 1];
    if (!lastResult) return undefined;

    if (lastResult.type === StepType.FUNCTION_CALL) {
      return lastResult.result;
    } else if (lastResult.type === StepType.USER_INPUT) {
      return lastResult.values;
    }
    return undefined;
  }
}
