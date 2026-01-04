/**
 * SSE 传输层实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { Transport, SSEServerConfig, MessageSender } from '../interfaces/index.js';

interface SSEConnection {
  sessionId: string;
  controller: ReadableStreamDefaultController;
}

@injectable()
export class SSEServerTransport implements Transport {
  readonly type = 'sse' as const;

  private running = false;
  private server: any = null;
  private connections: Map<string, SSEConnection> = new Map();
  private messageSender: MessageSender;
  private config: SSEServerConfig;

  constructor(messageSender: MessageSender, config: SSEServerConfig) {
    this.messageSender = messageSender;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log(`[A2UI SSE] Server started on port ${this.config.port}, path: ${this.config.path}`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // 关闭所有连接
    for (const [sessionId, connection] of this.connections) {
      try {
        connection.controller.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.connections.clear();

    console.log('[A2UI SSE] Server stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * 添加 SSE 连接（供路由层调用）
   */
  addConnection(sessionId: string, controller: ReadableStreamDefaultController): void {
    this.connections.set(sessionId, { sessionId, controller });

    // 消息发送回调
    this.messageSender.registerSession(sessionId, 'main', (message) => {
      this.sendToConnection(sessionId, message);
    });
  }

  /**
   * 移除 SSE 连接
   */
  removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      try {
        connection.controller.close();
      } catch {
        // 忽略关闭错误
      }
      this.connections.delete(sessionId);
    }
    this.messageSender.unregisterSession(sessionId);
  }

  /**
   * 发送消息到连接
   */
  private sendToConnection(sessionId: string, message: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      try {
        connection.controller.enqueue(`data: ${message}\n\n`);
      } catch {
        // 连接已关闭，移除
        this.removeConnection(sessionId);
      }
    }
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
