/**
 * A2UI 会话工厂实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { A2UISession, A2UISessionFactory, A2UISessionOptions, SurfaceManager, MessageSender } from '../interfaces/index.js';

@injectable()
export class A2UISessionFactoryImpl implements A2UISessionFactory {
  constructor(
    private surfaceManager: SurfaceManager,
    private messageSender: MessageSender
  ) {}

  create(options?: A2UISessionOptions): A2UISession {
    return new A2UISessionImpl(this.surfaceManager, this.messageSender);
  }
}

/**
 * A2UI 会话实现（内联，为了避免循环依赖）
 */
class A2UISessionImpl implements A2UISession {
  readonly sessionId: string;
  readonly createdAt: Date;

  private subscribers: Map<string, (message: string) => void> = new Map();
  private actionHandlers: Map<string, (action: any) => void> = new Map();

  constructor(
    private surfaceManager: SurfaceManager,
    private messageSender: MessageSender
  ) {
    this.sessionId = `a2ui-${Date.now().toString(36)}`;
    this.createdAt = new Date();
  }

  createSurface(surfaceId: string): void {
    this.surfaceManager.createSurface(surfaceId);
  }

  sendSurfaceUpdate(surfaceId: string, components: any[]): void {
    const message = JSON.stringify({ surfaceUpdate: { surfaceId, components } });
    this.messageSender.send(this.sessionId, message);
  }

  sendDataModelUpdate(surfaceId: string, data: Record<string, unknown>, path?: string): void {
    const contents = Object.entries(data).map(([key, value]) => {
      if (typeof value === 'string') return { key, valueString: value };
      if (typeof value === 'number') return { key, valueNumber: value };
      if (typeof value === 'boolean') return { key, valueBoolean: value };
      return { key };
    });
    const message = JSON.stringify({ dataModelUpdate: { surfaceId, path, contents } });
    this.messageSender.send(this.sessionId, message);
  }

  beginRendering(surfaceId: string, catalogId: string, rootComponentId: string): void {
    const message = JSON.stringify({ beginRendering: { surfaceId, catalogId, root: rootComponentId } });
    this.messageSender.send(this.sessionId, message);
  }

  deleteSurface(surfaceId: string): void {
    const message = JSON.stringify({ deleteSurface: { surfaceId } });
    this.messageSender.send(this.sessionId, message);
    this.surfaceManager.deleteSurface(surfaceId);
  }

  handleUserAction(action: any): void {
    const handler = this.actionHandlers.get(action.userAction?.name);
    handler?.(action);
  }

  onAction(actionName: string, handler: (action: any) => void): void {
    this.actionHandlers.set(actionName, handler);
  }

  subscribe(subscriberId: string, callback: (message: string) => void): void {
    this.subscribers.set(subscriberId, callback);
  }

  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }
}
