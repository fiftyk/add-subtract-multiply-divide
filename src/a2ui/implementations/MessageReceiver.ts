/**
 * 消息接收者实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { MessageReceiver } from '../interfaces/index.js';
import type { UserActionMessage, A2UIErrorMessage } from '../interfaces/A2UIMessage.js';

@injectable()
export class MessageReceiverImpl implements MessageReceiver {
  private errorHandler: ((sessionId: string, error: A2UIErrorMessage) => void) | null = null;
  private actionHandlers: Map<string, (sessionId: string, action: UserActionMessage) => void> = new Map();

  receiveUserAction(sessionId: string, action: UserActionMessage): void {
    const handler = this.actionHandlers.get(action.userAction.name);
    if (handler) {
      handler(sessionId, action);
    }
  }

  receiveError(sessionId: string, error: A2UIErrorMessage): void {
    if (this.errorHandler) {
      this.errorHandler(sessionId, error);
    }
  }

  onError(handler: (sessionId: string, error: A2UIErrorMessage) => void): void {
    this.errorHandler = handler;
  }

  /**
   * 注册动作处理器
   */
  onAction(actionName: string, handler: (sessionId: string, action: UserActionMessage) => void): void {
    this.actionHandlers.set(actionName, handler);
  }
}
