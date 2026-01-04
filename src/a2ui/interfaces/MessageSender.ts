/**
 * 消息发送者接口
 */

export const MessageSender = Symbol('MessageSender');

/**
 * SSE 响应写入器接口
 */
export interface SSEResponseWriter {
  write(data: string): void;
  end(): void;
}

/**
 * 消息发送者接口
 */
export interface MessageSender {
  /**
   * 发送消息到特定会话
   */
  send(sessionId: string, message: string): void;

  /**
   * 广播消息到多个会话
   */
  broadcast(sessionIds: string[], message: string): void;

  /**
   * 发送消息到特定 Surface
   */
  sendToSurface(sessionId: string, surfaceId: string, message: string): void;

  /**
   * 注册会话回调
   */
  registerSession(
    sessionId: string,
    surfaceId: string,
    callback: (message: string) => void
  ): void;

  /**
   * 注销会话回调
   */
  unregisterSession(sessionId: string): void;

  /**
   * 注册 SSE 订阅
   */
  registerSSESubscription(
    sessionId: string,
    sseId: string,
    writer: SSEResponseWriter
  ): void;

  /**
   * 注销 SSE 订阅
   */
  unregisterSSESubscription(sessionId: string, sseId: string): void;
}
