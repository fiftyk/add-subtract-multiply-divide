/**
 * A2UI Interactive Session Integration
 *
 * 将 InteractiveSession 与 A2UI 协议集成
 * 当会话需要用户输入时，通过 A2UI 渲染表单并通过 SSE 推送
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { A2UISession } from '../interfaces/index.js';
import type { FormInputSchema } from '../../user-input/interfaces/FormInputSchema.js';
import { A2UIFormRenderer } from './A2UIFormRenderer.js';
import { LoggerFactory } from '../../logger/index.js';
import type { UserActionMessage } from '../interfaces/A2UIMessage.js';
import { InteractiveSession, type SessionEvent, type UserInputRequest } from '../../core/services/interfaces/InteractiveSession.js';
import { A2UISessionFactory } from '../interfaces/index.js';

export interface A2UIInteractiveConfig {
  /** 默认 surface ID */
  defaultSurfaceId?: string;
  /** 表单提交动作前缀 */
  submitActionPrefix?: string;
}

@injectable()
export class A2UIInteractiveSession {
  private logger = LoggerFactory.create();
  private formRenderer = new A2UIFormRenderer();

  /** 活跃的交互会话 */
  private activeSessions: Map<string, {
    a2uiSession: A2UISession;
    surfaceId: string;
    eventUnsubscribe: () => void;
  }> = new Map();

  constructor(
    @inject(InteractiveSession) private interactiveSession: InteractiveSession,
    @inject(A2UISessionFactory) private a2uiSessionFactory: A2UISessionFactory
  ) {}

  /**
   * 启动交互式会话并关联 A2UI
   *
   * @param request 用户请求或计划 ID
   * @param planId 可选的计划 ID
   * @param config A2UI 配置
   * @returns 会话信息
   */
  async startInteractiveSession(
    request: string,
    planId?: string,
    config?: A2UIInteractiveConfig
  ): Promise<{ sessionId: string; a2uiSessionId: string; surfaceId: string }> {
    // 启动交互式会话
    const session = await this.interactiveSession.start(request, planId);

    // 创建 A2UI 会话
    const a2uiSession = this.a2uiSessionFactory.create();
    const surfaceId = config?.defaultSurfaceId || `interactive-${session.id}`;
    a2uiSession.createSurface(surfaceId);

    // 订阅会话事件
    const eventUnsubscribe = this.interactiveSession.onEvent(
      session.id,
      (event) => this.handleSessionEvent(session.id, surfaceId, a2uiSession, event)
    );

    // 存储活跃会话
    this.activeSessions.set(session.id, {
      a2uiSession,
      surfaceId,
      eventUnsubscribe,
    });

    this.logger.info('A2UI interactive session started', {
      sessionId: session.id,
      a2uiSessionId: a2uiSession.sessionId,
      surfaceId,
    });

    return {
      sessionId: session.id,
      a2uiSessionId: a2uiSession.sessionId,
      surfaceId,
    };
  }

  /**
   * 确认并开始执行会话
   */
  async confirmAndExecute(sessionId: string, confirmed: boolean = true): Promise<void> {
    await this.interactiveSession.confirm(sessionId, confirmed);
  }

  /**
   * 提交用户输入
   */
  async submitInput(sessionId: string, stepId: number, values: Record<string, unknown>): Promise<boolean> {
    const result = await this.interactiveSession.submitInput(sessionId, stepId, values);
    return result;
  }

  /**
   * 获取会话信息
   */
  async getSession(sessionId: string) {
    return this.interactiveSession.getSession(sessionId);
  }

  /**
   * 获取会话的 A2UI Session
   */
  getA2UISession(sessionId: string): A2UISession | undefined {
    return this.activeSessions.get(sessionId)?.a2uiSession;
  }

  /**
   * 获取待处理的输入请求
   */
  async getPendingInputs(sessionId: string): Promise<UserInputRequest[]> {
    return this.interactiveSession.getPendingInputs(sessionId);
  }

  /**
   * 取消会话
   */
  async cancel(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      activeSession.eventUnsubscribe();
      activeSession.a2uiSession.deleteSurface(activeSession.surfaceId);
      this.activeSessions.delete(sessionId);
    }
    await this.interactiveSession.cancel(sessionId);
  }

  /**
   * 处理会话事件并发送 A2UI 消息
   */
  private async handleSessionEvent(
    sessionId: string,
    surfaceId: string,
    a2uiSession: A2UISession,
    event: SessionEvent
  ): Promise<void> {
    this.logger.debug('Handling session event', { sessionId, eventType: event.type });

    switch (event.type) {
      case 'started':
        // 会话开始，发送欢迎消息
        a2uiSession.sendSurfaceUpdate(surfaceId, [
          {
            id: 'welcome',
            component: {
              Text: {
                text: { literalString: '交互式会话已启动' },
              },
            },
          },
        ]);
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'started',
          sessionId,
        });
        a2uiSession.beginRendering(surfaceId, 'standard', 'root');
        break;

      case 'plan_received':
        // 收到计划
        const planData = event.data?.plan as { userRequest?: string; steps?: Array<{ description?: string }> };
        const stepCount = planData?.steps?.length || 0;
        a2uiSession.sendSurfaceUpdate(surfaceId, [
          {
            id: 'plan-info',
            component: {
              Column: {
                children: [
                  {
                    id: 'plan-title',
                    component: {
                      Text: {
                        text: { literalString: `计划已创建 (${stepCount} 个步骤)` },
                      },
                    },
                  },
                  {
                    id: 'plan-request',
                    component: {
                      Text: {
                        text: { literalString: planData?.userRequest || '' },
                      },
                    },
                  },
                ],
              },
            },
          },
        ]);
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'plan_received',
          stepCount,
        });
        a2uiSession.beginRendering(surfaceId, 'standard', 'root');
        break;

      case 'awaiting_input':
        // 等待用户输入，渲染表单
        const schema = event.data?.schema as FormInputSchema;
        const stepId = event.data?.stepId as number;

        if (schema) {
          // 渲染表单
          const formId = `input-${stepId}`;
          const components = this.formRenderer.render(schema, formId, `submit-input-${stepId}`);

          a2uiSession.sendSurfaceUpdate(surfaceId, components);
          a2uiSession.sendDataModelUpdate(surfaceId, {
            sessionStatus: 'awaiting_input',
            stepId,
            formId,
            fieldCount: schema.fields.length,
          });

          // 注册表单提交动作处理
          a2uiSession.onAction(`submit-input-${stepId}`, async (action) => {
            await this.handleFormSubmit(sessionId, stepId, action);
          });

          a2uiSession.beginRendering(surfaceId, 'standard', 'root');
        }
        break;

      case 'input_received':
        // 输入已接收
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'input_received',
          stepId: event.data?.stepId,
        });
        break;

      case 'completed':
        // 会话完成
        a2uiSession.sendSurfaceUpdate(surfaceId, [
          {
            id: 'completed',
            component: {
              Text: {
                text: { literalString: '会话已完成' },
              },
            },
          },
        ]);
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'completed',
        });
        a2uiSession.beginRendering(surfaceId, 'standard', 'root');

        // 清理会话
        setTimeout(() => {
          this.activeSessions.delete(sessionId);
        }, 5000);
        break;

      case 'error':
        // 错误
        a2uiSession.sendSurfaceUpdate(surfaceId, [
          {
            id: 'error',
            component: {
              Text: {
                text: { literalString: `错误: ${event.data?.error || '未知错误'}` },
              },
            },
          },
        ]);
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'error',
          error: event.data?.error,
        });
        a2uiSession.beginRendering(surfaceId, 'standard', 'root');
        break;

      case 'cancelled':
        // 取消
        a2uiSession.sendSurfaceUpdate(surfaceId, [
          {
            id: 'cancelled',
            component: {
              Text: {
                text: { literalString: '会话已取消' },
              },
            },
          },
        ]);
        a2uiSession.sendDataModelUpdate(surfaceId, {
          sessionStatus: 'cancelled',
        });
        a2uiSession.beginRendering(surfaceId, 'standard', 'root');
        break;
    }
  }

  /**
   * 处理表单提交
   */
  private async handleFormSubmit(
    sessionId: string,
    stepId: number,
    action: UserActionMessage
  ): Promise<void> {
    // 从上下文中提取输入值
    const values: Record<string, unknown> = {};

    // 从 action.context 中获取输入值
    if (action.userAction.context && typeof action.userAction.context === 'object') {
      const context = action.userAction.context as Record<string, unknown>;
      for (const [key, value] of Object.entries(context)) {
        if (key.startsWith('field_')) {
          const fieldName = key.replace('field_', '');
          values[fieldName] = value;
        }
      }
    }

    // 提交输入
    const success = await this.submitInput(sessionId, stepId, values);

    this.logger.info('Form submitted', { sessionId, stepId, success, values });
  }
}
