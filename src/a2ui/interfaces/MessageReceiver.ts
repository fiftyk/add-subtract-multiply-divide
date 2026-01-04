/**
 * 消息接收者接口
 */

import type { UserActionMessage, A2UIErrorMessage } from './A2UIMessage.js';

export const MessageReceiver = Symbol('MessageReceiver');

/**
 * 消息接收者接口
 */
export interface MessageReceiver {
  /**
   * 接收用户动作
   */
  receiveUserAction(sessionId: string, action: UserActionMessage): void;

  /**
   * 接收错误报告
   */
  receiveError(sessionId: string, error: A2UIErrorMessage): void;

  /**
   * 设置错误处理程序
   */
  onError(handler: (sessionId: string, error: A2UIErrorMessage) => void): void;
}
