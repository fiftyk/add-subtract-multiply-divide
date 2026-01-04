/**
 * A2UI 会话接口
 *
 * 管理一个完整的 A2UI 交互会话
 */

import type { UserActionMessage } from './A2UIMessage.js';
import type { Component } from './Component.js';

export const A2UISession = Symbol('A2UISession');

/**
 * A2UI 会话接口
 */
export interface A2UISession {
  /** 会话 ID */
  readonly sessionId: string;

  /** 创建时间 */
  readonly createdAt: Date;

  /**
   * 创建 Surface
   */
  createSurface(surfaceId: string): void;

  /**
   * 发送 Surface Update 消息
   */
  sendSurfaceUpdate(surfaceId: string, components: Component[]): void;

  /**
   * 发送 Data Model Update 消息
   */
  sendDataModelUpdate(surfaceId: string, data: Record<string, unknown>, path?: string): void;

  /**
   * 发送 Begin Rendering 消息
   */
  beginRendering(surfaceId: string, catalogId: string, rootComponentId: string): void;

  /**
   * 删除 Surface
   */
  deleteSurface(surfaceId: string): void;

  /**
   * 处理用户动作
   */
  handleUserAction(action: UserActionMessage): void;

  /**
   * 注册动作处理器
   */
  onAction(actionName: string, handler: (action: UserActionMessage) => void): void;

  /**
   * 订阅消息
   */
  subscribe(subscriberId: string, callback: (message: string) => void): void;

  /**
   * 取消订阅
   */
  unsubscribe(subscriberId: string): void;
}

/**
 * 会话选项
 */
export interface A2UISessionOptions {
  sessionId?: string;
  userId?: string;
  initialSurfaceId?: string;
}
