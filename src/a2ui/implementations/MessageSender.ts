/**
 * 消息发送者实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { MessageSender } from '../interfaces/index.js';

interface SessionInfo {
  sessionId: string;
  surfaceId?: string;
  callback: (message: string) => void;
}

@injectable()
export class MessageSenderImpl implements MessageSender {
  private sessions: Map<string, SessionInfo> = new Map();

  send(sessionId: string, message: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.callback(message);
    }
  }

  broadcast(sessionIds: string[], message: string): void {
    for (const sessionId of sessionIds) {
      this.send(sessionId, message);
    }
  }

  sendToSurface(sessionId: string, surfaceId: string, message: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.surfaceId === surfaceId) {
      session.callback(message);
    }
  }

  /**
   * 注册会话（内部使用）
   */
  registerSession(sessionId: string, surfaceId: string, callback: (message: string) => void): void {
    this.sessions.set(sessionId, { sessionId, surfaceId, callback });
  }

  /**
   * 注销会话（内部使用）
   */
  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 获取会话数
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
