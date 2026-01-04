/**
 * 交互式会话服务实现
 *
 * 管理执行过程中的用户交互会话
 * 支持：计划确认、执行步骤展示、输入等待
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import {
  type InteractiveSession,
  type SessionInfo,
  type SessionEvent,
  type InteractiveStep,
} from './interfaces/InteractiveSession.js';
import { OrchestrationService } from '../interfaces/OrchestrationService.js';
import { Storage } from '../../storage/interfaces/Storage.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Executor } from '../../executor/interfaces/Executor.js';
import { Planner } from '../../planner/interfaces/IPlanner.js';
import { UserInputProvider, type UserInputRequest } from '../../user-input/interfaces/UserInputProvider.js';
import { ConsoleLogger } from '../../logger/implementations.js';
import { LoggerFactory } from '../../logger/index.js';
import type {
  ExecutionPlan,
  PlanStep,
  FunctionCallStep,
  UserInputStep,
  ConditionalStep,
  StepType,
} from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';
import type { FormInputField } from '../../user-input/interfaces/FormInputSchema.js';

/**
 * Type guard for FunctionCallStep
 */
function isFunctionCallStep(step: PlanStep): step is FunctionCallStep {
  return step.type === 'function_call';
}

/**
 * Type guard for UserInputStep
 */
function isUserInputStep(step: PlanStep): step is UserInputStep {
  return step.type === 'user_input';
}

/**
 * Type guard for ConditionalStep
 */
function isConditionalStep(step: PlanStep): step is ConditionalStep {
  return step.type === 'condition';
}

@injectable()
export class InteractiveSessionService implements InteractiveSession {
  private logger: ConsoleLogger;
  private sessions: Map<string, SessionInfo> = new Map();
  private eventSubscribers: Map<string, ((event: SessionEvent) => void)[]> = new Map();

  constructor(
    @inject(OrchestrationService) private orchestrationService: OrchestrationService,
    @inject(Storage) private storage: Storage,
    @inject(FunctionProvider) private functionProvider: FunctionProvider,
    @inject(Executor) private executor: Executor,
    @inject(Planner) private planner: Planner,
    @inject(UserInputProvider) private userInputProvider: UserInputProvider
  ) {
    this.logger = LoggerFactory.create() as ConsoleLogger;
  }

  async start(request: string, planId?: string): Promise<SessionInfo> {
    const sessionId = `session-${uuidv4().slice(0, 8)}`;

    // 创建计划
    let plan: ExecutionPlan;
    if (planId) {
      const existingPlan = await this.orchestrationService.getPlan(planId);
      if (!existingPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }
      plan = existingPlan;
    } else {
      const result = await this.orchestrationService.createPlan(request);
      if (!result.success || !result.plan) {
        throw new Error(result.error || 'Failed to create plan');
      }
      plan = result.plan;
    }

    const session: SessionInfo = {
      id: sessionId,
      planId: plan.id,
      status: 'pending',
      steps: this.convertStepsToInteractive(plan.steps),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    // 发送开始事件
    this.emitEvent({
      type: 'started',
      sessionId,
      timestamp: new Date().toISOString(),
      data: { request, planId: plan.id },
    });

    return session;
  }

  async confirm(sessionId: string, confirmed: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'pending') {
      throw new Error(`Session is not in pending status: ${session.status}`);
    }

    if (!confirmed) {
      session.status = 'cancelled';
      session.updatedAt = new Date().toISOString();
      this.emitEvent({
        type: 'cancelled',
        sessionId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    session.status = 'running';
    session.updatedAt = new Date().toISOString();

    // 异步执行计划
    this.executePlan(sessionId, session).catch((error) => {
      this.logger.error('Session execution error', error as Error, { sessionId });
      session.status = 'error';
      session.updatedAt = new Date().toISOString();
      this.emitEvent({
        type: 'error',
        sessionId,
        timestamp: new Date().toISOString(),
        data: { error: String(error) },
      });
    });
  }

  async sendInput(sessionId: string, input: Record<string, unknown>): Promise<void> {
    // 这里我们不直接处理输入，而是让 submitInput 方法处理
    // 保持接口兼容性
    this.logger.info('sendInput called', { sessionId, input });
  }

  async submitInput(sessionId: string, stepId: number, values: Record<string, unknown>): Promise<boolean> {
    // 使用类型守卫检查 HTTP 特定方法
    if ('submitInput' in this.userInputProvider && typeof this.userInputProvider.submitInput === 'function') {
      const result = this.userInputProvider.submitInput(sessionId, stepId, values);
      if (result) {
        this.emitEvent({
          type: 'input_received',
          sessionId,
          timestamp: new Date().toISOString(),
          data: { stepId, values },
        });
      }
      return result;
    }
    return false;
  }

  async cancel(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();

    // 取消所有待处理的输入
    if ('clearPendingInputs' in this.userInputProvider && typeof this.userInputProvider.clearPendingInputs === 'function') {
      this.userInputProvider.clearPendingInputs();
    }

    const executor = this.executionPromises?.get(sessionId);
    if (executor) {
      executor.reject(new Error('Session cancelled'));
    }

    this.emitEvent({
      type: 'cancelled',
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  getSession(sessionId: string): Promise<SessionInfo | undefined> {
    return Promise.resolve(this.sessions.get(sessionId));
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPendingInputs(sessionId: string): Promise<UserInputRequest[]> {
    if ('getPendingInputs' in this.userInputProvider && typeof this.userInputProvider.getPendingInputs === 'function') {
      return this.userInputProvider.getPendingInputs(sessionId);
    }
    return [];
  }

  /**
   * 订阅会话事件
   */
  onEvent(sessionId: string, callback: (event: SessionEvent) => void): () => void {
    if (!this.eventSubscribers.has(sessionId)) {
      this.eventSubscribers.set(sessionId, []);
    }
    this.eventSubscribers.get(sessionId)!.push(callback);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.eventSubscribers.get(sessionId);
      if (subscribers) {
        const index = subscribers.indexOf(callback);
        if (index !== -1) {
          subscribers.splice(index, 1);
        }
      }
    };
  }

  private convertStepsToInteractive(steps: PlanStep[]): InteractiveStep[] {
    return steps.map((step, index) => {
      const interactiveStep: InteractiveStep = {
        stepId: step.stepId || index + 1,
        type: step.type as 'function_call' | 'condition' | 'input',
      };

      if (isFunctionCallStep(step)) {
        interactiveStep.functionName = step.functionName;
        interactiveStep.description = step.description || `调用 ${step.functionName}`;
      } else if (isConditionalStep(step)) {
        interactiveStep.condition = step.condition;
        interactiveStep.description = step.description || `条件判断: ${step.condition}`;
      } else if (isUserInputStep(step)) {
        const schema = step.schema;
        if (schema?.fields?.length > 0) {
          interactiveStep.description = schema.fields[0].label || '请输入信息';
        } else {
          interactiveStep.description = step.description || '请输入信息';
        }
      }

      return interactiveStep;
    });
  }

  private emitEvent(event: SessionEvent): void {
    const subscribers = this.eventSubscribers.get(event.sessionId);
    if (subscribers) {
      subscribers.forEach((callback) => callback(event));
    }
  }

  private executionPromises: Map<string, { resolve: () => void; reject: (e: Error) => void }> = new Map();

  private async executePlan(sessionId: string, session: SessionInfo): Promise<void> {
    try {
      const plan = await this.orchestrationService.getPlan(session.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${session.planId}`);
      }

      // 发送计划接收事件
      this.emitEvent({
        type: 'plan_received',
        sessionId,
        timestamp: new Date().toISOString(),
        data: {
          plan: {
            id: plan.id,
            userRequest: plan.userRequest,
            steps: session.steps,
          },
        },
      });

      // 加载 mock 函数（如果需要）
      if (plan.metadata?.usesMocks) {
        try {
          const mocks = await this.storage.loadPlanMocks(plan.id);
          for (const mock of mocks) {
            this.functionProvider.register?.(mock as any);
          }
        } catch (error) {
          this.logger.warn('加载 mock 函数失败', { error: String(error) });
        }
      }

      // 执行计划
      const result = await this.executeWithInputAwait(sessionId, plan);

      session.status = 'completed';
      session.updatedAt = new Date().toISOString();

      this.emitEvent({
        type: 'completed',
        sessionId,
        timestamp: new Date().toISOString(),
        data: { result },
      });
    } catch (error) {
      session.status = 'error';
      session.updatedAt = new Date().toISOString();
      throw error;
    }
  }

  /**
   * 可暂停的执行流程
   * 使用 HTTP UserInputProvider 来处理用户输入
   */
  private async executeWithInputAwait(sessionId: string, plan: ExecutionPlan): Promise<ExecutionResult> {
    const context: Record<string, unknown> = { sessionId };
    const stepResults: any[] = [];
    let cancelled = false;

    // 为每个步骤设置上下文并执行
    for (const step of plan.steps) {
      if (cancelled) {
        break;
      }

      const stepId = step.stepId || 0;

      if (step.type === 'user_input') {
        // 通知前端等待输入
        this.emitEvent({
          type: 'awaiting_input',
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            stepId,
            description: (step as any).description,
            schema: (step as any).schema,
          },
        });

        // 设置上下文
        context.sessionId = sessionId;
        context.stepId = stepId;

        // 添加待处理输入
        const schema = (step as any).schema;
        if ('addPendingInput' in this.userInputProvider && typeof this.userInputProvider.addPendingInput === 'function') {
          this.userInputProvider.addPendingInput(sessionId, stepId, schema);
        }

        // 等待用户输入（阻塞）
        try {
          const result = await this.userInputProvider.requestInput(schema, context);
          stepResults.push({
            stepId,
            type: 'user_input',
            values: result.values,
            success: true,
            executedAt: new Date().toISOString(),
          });
        } catch (error) {
          stepResults.push({
            stepId,
            type: 'user_input',
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executedAt: new Date().toISOString(),
          });
          return {
            planId: plan.id,
            steps: stepResults,
            finalResult: undefined,
            success: false,
            error: 'User input failed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
      } else if (step.type === 'function_call') {
        // 函数调用步骤跳过，由普通执行器处理
        // 这里只记录占位结果
        stepResults.push({
          stepId,
          type: 'function_call',
          functionName: (step as any).functionName,
          success: true,
          skipped: true,
          executedAt: new Date().toISOString(),
        });
      }
    }

    // 发送步骤完成事件
    this.emitEvent({
      type: 'step_completed',
      sessionId,
      timestamp: new Date().toISOString(),
      data: { completedSteps: plan.steps.length },
    });

    return {
      planId: plan.id,
      steps: stepResults,
      finalResult: { message: 'Interactive session completed' },
      success: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}
