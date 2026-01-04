/**
 * A2UI 会话实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import type {
  A2UISession,
  A2UISessionOptions,
  SurfaceManager,
  MessageSender,
  UserActionMessage,
  SurfaceUpdateMessage,
  DataModelUpdateMessage,
  BeginRenderingMessage,
  DeleteSurfaceMessage,
} from '../interfaces/index.js';

@injectable()
export class A2UISessionImpl implements A2UISession {
  readonly sessionId: string;
  readonly createdAt: Date;

  private surfaceManager: SurfaceManager;
  private messageSender: MessageSender;
  private subscribers: Map<string, (message: string) => void> = new Map();
  private actionHandlers: Map<string, (action: UserActionMessage) => void> = new Map();

  constructor(
    surfaceManager: SurfaceManager,
    messageSender: MessageSender
  ) {
    this.sessionId = `a2ui-${uuidv4().slice(0, 8)}`;
    this.createdAt = new Date();
    this.surfaceManager = surfaceManager;
    this.messageSender = messageSender;
  }

  createSurface(surfaceId: string): void {
    this.surfaceManager.createSurface(surfaceId);
  }

  sendSurfaceUpdate(surfaceId: string, components: import('../interfaces/Component.js').Component[]): void {
    const message: SurfaceUpdateMessage = {
      surfaceUpdate: { surfaceId, components },
    };
    this.publish(message);
  }

  sendDataModelUpdate(surfaceId: string, data: Record<string, unknown>, path?: string): void {
    const contents = this.flattenData(data);
    const message: DataModelUpdateMessage = {
      dataModelUpdate: { surfaceId, path, contents },
    };
    this.publish(message);
  }

  beginRendering(surfaceId: string, catalogId: string, rootComponentId: string): void {
    const message: BeginRenderingMessage = {
      beginRendering: { surfaceId, catalogId, root: rootComponentId },
    };
    this.publish(message);
  }

  deleteSurface(surfaceId: string): void {
    const message: DeleteSurfaceMessage = {
      deleteSurface: { surfaceId },
    };
    this.publish(message);
    this.surfaceManager.deleteSurface(surfaceId);
  }

  handleUserAction(action: UserActionMessage): void {
    const handler = this.actionHandlers.get(action.userAction.name);
    if (handler) {
      handler(action);
    }
  }

  onAction(actionName: string, handler: (action: UserActionMessage) => void): void {
    this.actionHandlers.set(actionName, handler);
  }

  subscribe(subscriberId: string, callback: (message: string) => void): void {
    this.subscribers.set(subscriberId, callback);
  }

  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }

  private publish(message: object): void {
    const encoded = JSON.stringify(message);
    this.messageSender.send(this.sessionId, encoded);
  }

  private flattenData(
    data: Record<string, unknown>
  ): Array<{ key: string; valueString?: string; valueNumber?: number; valueBoolean?: boolean }> {
    const entries: Array<{ key: string; valueString?: string; valueNumber?: number; valueBoolean?: boolean }> = [];

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        entries.push({ key, valueString: value });
      } else if (typeof value === 'number') {
        entries.push({ key, valueNumber: value });
      } else if (typeof value === 'boolean') {
        entries.push({ key, valueBoolean: value });
      }
    }

    return entries;
  }
}
