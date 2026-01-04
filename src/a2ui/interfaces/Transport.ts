/**
 * 传输层接口
 */

export const Transport = Symbol('Transport');

/**
 * 传输层接口
 */
export interface Transport {
  /** 传输类型 */
  readonly type: 'sse' | 'websocket' | 'http';

  /**
   * 启动传输服务
   */
  start(): Promise<void>;

  /**
   * 停止传输服务
   */
  stop(): Promise<void>;

  /**
   * 检查是否运行中
   */
  isRunning(): boolean;
}

/**
 * SSE 传输配置
 */
export interface SSEServerConfig {
  port: number;
  path: string;
  heartbeatInterval?: number;
}

/**
 * WebSocket 传输配置
 */
export interface WebSocketConfig {
  port: number;
  path: string;
  heartbeatInterval?: number;
  maxConnections?: number;
}
