/**
 * Execution Session Manager Implementation
 *
 * Orchestrates session lifecycle: creation, execution, retry, and resumption.
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import type {
  ExecutionSessionManager as IExecutionSessionManager,
} from '../interfaces/ExecutionSessionManager.js';
import type { ExecutionSession } from '../types.js';
import type { ExecutionPlan } from '../../../planner/types.js';
import { StepType } from '../../../planner/types.js';
import type { ExecutionResult, StepResult } from '../../types.js';
import type { ExecutorCallbacks } from '../../interfaces/InterruptibleExecutor.js';
import type { ExecutionStatus } from '../../../a2ui/types.js';
import { ExecutionSessionStorage } from '../interfaces/ExecutionSessionStorage.js';
import { Executor } from '../../interfaces/Executor.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { LoggerFactory } from '../../../logger/index.js';
import type { ILogger } from '../../../logger/index.js';

/**
 * ExecutionSessionManagerImpl
 *
 * Business logic for managing execution sessions.
 */
@injectable()
export class ExecutionSessionManagerImpl implements IExecutionSessionManager {
  private logger: ILogger;

  constructor(
    @inject(ExecutionSessionStorage)
    private sessionStorage: ExecutionSessionStorage,
    @inject(Executor)
    private executor: Executor,
    @inject(Storage)
    private storage: Storage
  ) {
    this.logger = LoggerFactory.create(undefined, 'ExecutionSessionManager');
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Parse plan ID to extract base ID and version
   */
  private parsePlanId(planId: string): {
    basePlanId: string;
    version?: number;
  } {
    return this.storage.parsePlanId(planId);
  }

  // ============================================
  // Public Methods
  // ============================================

  async createSession(
    plan: ExecutionPlan,
    platform: 'cli' | 'web'
  ): Promise<ExecutionSession> {
    const { basePlanId, version } = this.parsePlanId(plan.id);

    const session: ExecutionSession = {
      id: `session-${uuidv4().slice(0, 8)}`,
      planId: plan.id,
      basePlanId,
      planVersion: version,
      plan,
      status: 'pending',
      currentStepId: 0,
      stepResults: [],
      context: {},
      pendingInput: null,
      retryCount: 0,
      platform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionStorage.saveSession(session);
    this.logger.info('Session created', {
      sessionId: session.id,
      planId: plan.id,
      platform,
    });

    return session;
  }

  async executeSession(
    sessionId: string,
    callbacks?: ExecutorCallbacks
  ): Promise<ExecutionResult> {
    this.logger.info('Starting session execution', { sessionId });

    // Load session
    const session = await this.sessionStorage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update status to running
    await this.sessionStorage.updateSession(sessionId, {
      status: 'running',
    });

    try {
      // Execute the plan
      // Note: callbacks are currently not supported by the basic Executor
      // InterruptibleExecutor would be needed for callback support
      const result = await this.executor.execute(session.plan);

      // Determine final status
      const finalStatus: ExecutionStatus = result.success ? 'completed' : 'failed';

      // Update session with result
      await this.sessionStorage.updateSession(sessionId, {
        status: finalStatus,
        result,
        completedAt: new Date().toISOString(),
      });

      this.logger.info('Session execution completed', {
        sessionId,
        success: result.success,
      });

      return result;
    } catch (error) {
      // Update session with error
      const errorResult: ExecutionResult = {
        planId: session.plan.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: [],
        finalResult: undefined,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await this.sessionStorage.updateSession(sessionId, {
        status: 'failed',
        result: errorResult,
        completedAt: new Date().toISOString(),
      });

      this.logger.error('Session execution failed', error as Error, {
        sessionId,
      });

      return errorResult;
    }
  }

  async retrySession(
    failedSessionId: string,
    fromStep?: number
  ): Promise<ExecutionSession> {
    this.logger.info('Retrying session', { failedSessionId, fromStep });

    // Load the failed session
    const failedSession = await this.sessionStorage.loadSession(failedSessionId);
    if (!failedSession) {
      throw new Error(`Session not found: ${failedSessionId}`);
    }

    // Verify the session actually failed
    if (failedSession.status !== 'failed') {
      throw new Error(
        `Cannot retry session with status: ${failedSession.status}. Only failed sessions can be retried.`
      );
    }

    // Create new session with retry metadata
    const retrySession: ExecutionSession = {
      id: `session-${uuidv4().slice(0, 8)}`,
      planId: failedSession.planId,
      basePlanId: failedSession.basePlanId,
      planVersion: failedSession.planVersion,
      plan: failedSession.plan,
      status: 'pending',
      currentStepId: fromStep ?? 0,
      stepResults: [],
      context: {},
      pendingInput: null,
      parentSessionId: failedSessionId,
      retryCount: failedSession.retryCount + 1,
      platform: failedSession.platform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If starting from a specific step, copy successful results and context
    if (fromStep !== undefined && fromStep > 0) {
      retrySession.stepResults = failedSession.stepResults.slice(0, fromStep);
      retrySession.context = { ...failedSession.context };
    }

    await this.sessionStorage.saveSession(retrySession);
    this.logger.info('Retry session created', {
      retrySessionId: retrySession.id,
      originalSessionId: failedSessionId,
      retryCount: retrySession.retryCount,
    });

    return retrySession;
  }

  async resumeSession(
    sessionId: string,
    userInput: Record<string, unknown>
  ): Promise<ExecutionResult> {
    this.logger.info('Resuming session', { sessionId });

    // Load session
    const session = await this.sessionStorage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Verify session is waiting for input
    if (session.status !== 'waiting_input') {
      throw new Error(
        `Cannot resume session with status: ${session.status}. Session must be in 'waiting_input' status.`
      );
    }

    // 创建用户输入步骤的结果
    const userInputStepResult: StepResult = {
      stepId: session.currentStepId,
      type: StepType.USER_INPUT,
      values: userInput,
      success: true,
      executedAt: new Date().toISOString(),
    };

    // 更新session：添加用户输入结果，更新context，清除pendingInput
    const updatedContext = {
      ...session.context,
      ...userInput,
    };

    const updatedStepResults = [...session.stepResults, userInputStepResult];

    await this.sessionStorage.updateSession(sessionId, {
      pendingInput: null,
      context: updatedContext,
      stepResults: updatedStepResults,
      currentStepId: session.currentStepId + 1, // 移动到下一步
      status: 'running',
    });

    this.logger.debug('User input processed, continuing execution', {
      sessionId,
      nextStepId: session.currentStepId + 1,
      userInput,
    });

    try {
      // 从下一步开始继续执行
      const result = await this.executor.execute(session.plan, {
        startFromStep: session.currentStepId + 1, // 从用户输入步骤的下一步开始
        previousStepResults: updatedStepResults,
      });

      // 检查是否需要更多用户输入（最后一个步骤是用户输入类型）
      const lastStep = result.steps[result.steps.length - 1];
      const needsMoreInput = lastStep?.type === StepType.USER_INPUT;

      if (needsMoreInput) {
        // 需要更多用户输入，更新会话状态为 waiting_input
        const nextPendingStepId = lastStep.stepId;

        // 获取下一个用户输入步骤的模式
        const nextStep = session.plan.steps.find(s => s.stepId === nextPendingStepId);
        const pendingInputSchema = nextStep?.type === StepType.USER_INPUT ? nextStep.schema : undefined;

        await this.sessionStorage.updateSession(sessionId, {
          status: 'waiting_input',
          currentStepId: nextPendingStepId,
          pendingInput: {
            stepId: nextPendingStepId,
            schema: pendingInputSchema!,
            surfaceId: `user-input-${nextPendingStepId}`,
          },
          result: undefined, // 清除之前的结果，因为还没有完成
        });

        this.logger.info('Session paused, waiting for more user input', {
          sessionId,
          nextStepId: nextPendingStepId,
        });

        // 返回部分结果，包含 waitingForInput 字段供 CoreBridge 发送 SSE 事件
        return {
          planId: session.plan.id,
          steps: result.steps,
          finalResult: undefined,
          success: true,
          error: undefined,
          startedAt: session.createdAt,
          completedAt: new Date().toISOString(),
          waitingForInput: {
            stepId: nextPendingStepId,
            schema: pendingInputSchema!,
            surfaceId: `user-input-${nextPendingStepId}`,
          },
        };
      }

      // Determine final status
      const finalStatus: ExecutionStatus = result.success ? 'completed' : 'failed';

      // Update session with result
      await this.sessionStorage.updateSession(sessionId, {
        status: finalStatus,
        result,
        completedAt: new Date().toISOString(),
      });

      this.logger.info('Session resumed and completed', {
        sessionId,
        success: result.success,
      });

      return result;
    } catch (error) {
      // Update session with error
      const errorResult: ExecutionResult = {
        planId: session.plan.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: updatedStepResults,
        finalResult: undefined,
        startedAt: session.createdAt,
        completedAt: new Date().toISOString(),
      };

      await this.sessionStorage.updateSession(sessionId, {
        status: 'failed',
        result: errorResult,
        completedAt: new Date().toISOString(),
      });

      this.logger.error('Session resume failed', error as Error, {
        sessionId,
      });

      return errorResult;
    }
  }

  async getSessionStatus(sessionId: string): Promise<ExecutionStatus | undefined> {
    const session = await this.sessionStorage.loadSession(sessionId);
    return session?.status;
  }

  async cancelSession(sessionId: string): Promise<void> {
    this.logger.info('Cancelling session', { sessionId });

    const session = await this.sessionStorage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Only cancel if session is pending, running, or waiting for input
    if (!['pending', 'running', 'waiting_input'].includes(session.status)) {
      throw new Error(
        `Cannot cancel session with status: ${session.status}`
      );
    }

    const errorResult: ExecutionResult = {
      planId: session.plan.id,
      success: false,
      error: 'Session cancelled by user',
      steps: session.stepResults,
      finalResult: undefined,
      startedAt: session.createdAt,
      completedAt: new Date().toISOString(),
    };

    await this.sessionStorage.updateSession(sessionId, {
      status: 'failed',
      result: errorResult,
      completedAt: new Date().toISOString(),
    });

    this.logger.info('Session cancelled', { sessionId });
  }
}
