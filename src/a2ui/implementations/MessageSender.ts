/**
 * 消息发送者实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { MessageSender, SSEResponseWriter } from '../interfaces/index.js';

interface SessionInfo {
  sessionId: string;
  surfaceId?: string;
  callback: (message: string) => void;
}

interface SSESubscription {
  sseId: string;
  writer: SSEResponseWriter;
}

@injectable()
export class MessageSenderImpl implements MessageSender {
  private sessions: Map<string, SessionInfo> = new Map();
  private sseSubscriptions: Map<string, Map<string, SSESubscription>> = new Map();

  send(sessionId: string, message: string): void {
    // 发送给普通回调
    const session = this.sessions.get(sessionId);
    if (session) {
      session.callback(message);
    }

    // 发送给 SSE 订阅者
    const sseSubs = this.sseSubscriptions.get(sessionId);
    if (sseSubs) {
      for (const subscription of sseSubs.values()) {
        try {
          subscription.writer.write(`data: ${message}\n\n`);
        } catch (error) {
          // 忽略写入错误
        }
      }
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

    // 清理 SSE 订阅
    const sseSubs = this.sseSubscriptions.get(sessionId);
    if (sseSubs) {
      for (const subscription of sseSubs.values()) {
        try {
          subscription.writer.end();
        } catch {
          // 忽略关闭错误
        }
      }
      this.sseSubscriptions.delete(sessionId);
    }
  }

  /**
   * 注册 SSE 订阅
   */
  registerSSESubscription(sessionId: string, sseId: string, writer: SSEResponseWriter): void {
    if (!this.sseSubscriptions.has(sessionId)) {
      this.sseSubscriptions.set(sessionId, new Map());
    }
    this.sseSubscriptions.get(sessionId)!.set(sseId, { sseId, writer });
  }

  /**
   * 注销 SSE 订阅
   */
  unregisterSSESubscription(sessionId: string, sseId: string): void {
    const sseSubs = this.sseSubscriptions.get(sessionId);
    if (sseSubs) {
      const subscription = sseSubs.get(sseId);
      if (subscription) {
        try {
          subscription.writer.end();
        } catch {
          // 忽略关闭错误
        }
        sseSubs.delete(sseId);
      }
      if (sseSubs.size === 0) {
        this.sseSubscriptions.delete(sessionId);
      }
    }
  }

  /**
   * 获取会话数
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
