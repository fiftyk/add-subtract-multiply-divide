/**
 * Web A2UI Renderer
 *
 * Renders A2UI components using Server-Sent Events (SSE).
 * Implements the A2UIRenderer interface for web-based UI.
 */

import { inject, injectable } from 'inversify';
import type { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
import type { A2UIComponent, A2UIUserAction, Surface } from '../a2ui/types.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

interface SSEClient {
  id: string;
  request: IncomingMessage;
  response: ServerResponse;
  surfaces: Map<string, Surface>;
}

export const WebA2UIRenderer = Symbol('WebA2UIRenderer');

interface PendingInputRequest {
  resolve: (action: A2UIUserAction) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

@injectable()
export class WebRendererImpl implements A2UIRenderer {
  private clients = new Map<string, SSEClient>();
  private surfaces = new Map<string, Surface>();
  private actionHandler?: (action: A2UIUserAction) => void;
  private pendingInputs = new Map<string, PendingInputRequest>();
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes

  /**
   * Get all active client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Register a new SSE client
   * Headers are set by the server before calling this method
   */
  registerClient(request: IncomingMessage, response: ServerResponse): string {
    const clientId = randomUUID().slice(0, 8);

    const client: SSEClient = {
      id: clientId,
      request,
      response,
      surfaces: new Map(),
    };

    this.clients.set(clientId, client);

    // Send initial connection event
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
    } as any);

    // Start heartbeat
    this.startHeartbeat(clientId);

    return clientId;
  }

  /**
   * Unregister an SSE client
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.response.end();
      this.clients.delete(clientId);

      // Clean up surfaces
      for (const surfaceId of client.surfaces.keys()) {
        this.surfaces.delete(surfaceId);
      }
    }
  }

  /**
   * Begin rendering a new surface
   */
  begin(surfaceId: string, rootId: string): void {
    const surface: Surface = {
      id: surfaceId,
      rootId,
      components: new Map(),
      order: [],
    };

    this.surfaces.set(surfaceId, surface);

    // Broadcast to all clients
    this.broadcast({
      type: 'beginRendering',
      surfaceId,
      root: rootId,
    });
  }

  /**
   * Update components on a surface
   */
  update(surfaceId: string, components: A2UIComponent[]): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    for (const comp of components) {
      surface.components.set(comp.id, comp);
      // Add to order if not already present
      if (!surface.order.includes(comp.id)) {
        surface.order.push(comp.id);
      }
    }

    // Broadcast to all clients
    this.broadcast({
      type: 'surfaceUpdate',
      surfaceId,
      components,
    });
  }

  /**
   * Remove components from a surface
   */
  remove(surfaceId: string, componentIds: string[]): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    for (const id of componentIds) {
      surface.components.delete(id);
      // Remove from order
      surface.order = surface.order.filter(orderId => orderId !== id);
    }

    // Broadcast to all clients
    this.broadcast({
      type: 'surfaceUpdate',
      surfaceId,
      removeComponentIds: componentIds,
      components: [],
    });
  }

  /**
   * End rendering and cleanup
   */
  end(surfaceId: string): void {
    this.surfaces.delete(surfaceId);

    // Broadcast to all clients
    this.broadcast({
      type: 'endRendering',
      surfaceId,
    });
  }

  /**
   * Register handler for user actions
   */
  onUserAction(handler: (action: A2UIUserAction) => void): void {
    this.actionHandler = handler;
  }

  /**
   * Handle user action from web client
   * Also resolves pending input requests if any
   */
  handleUserAction(action: A2UIUserAction): void {
    // Check if there's a pending input request for this surface/component
    const requestId = `${action.surfaceId}:${action.componentId}`;
    const pending = this.pendingInputs.get(requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(action);
      this.pendingInputs.delete(requestId);
      return;
    }

    // Also handle actions with surfaceId in payload (for button actions)
    const payloadRequestId = action.payload?.surfaceId
      ? `${action.payload.surfaceId}:${action.componentId}`
      : null;

    if (payloadRequestId) {
      const payloadPending = this.pendingInputs.get(payloadRequestId);
      if (payloadPending) {
        clearTimeout(payloadPending.timeout);
        payloadPending.resolve(action);
        this.pendingInputs.delete(payloadRequestId);
        return;
      }
    }

    // Call the registered action handler
    if (this.actionHandler) {
      this.actionHandler(action);
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(clientId: string, message: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const data = JSON.stringify(message);
      client.response.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Failed to send to client:', error);
      this.unregisterClient(clientId);
    }
  }

  /**
   * Broadcast message to all clients
   */
  private broadcast(message: Record<string, unknown>): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Start heartbeat for a client
   */
  private startHeartbeat(clientId: string): void {
    const interval = setInterval(() => {
      const client = this.clients.get(clientId);
      if (!client || client.response.writableEnded) {
        clearInterval(interval);
        return;
      }

      try {
        client.response.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(interval);
        this.unregisterClient(clientId);
      }
    }, 30000);

    // Clean up on close
    this.clients.get(clientId)?.response.on('close', () => {
      clearInterval(interval);
      this.unregisterClient(clientId);
    });
  }

  /**
   * Request user input in web mode
   * Creates a pending request and waits for user action via HTTP endpoint
   *
   * @param surfaceId - The surface ID requesting input
   * @param componentId - The component ID requesting input
   * @param timeoutMs - Optional timeout in milliseconds (default: 5 minutes)
   * @returns Promise resolving to user action with input values
   */
  async requestInput(
    surfaceId: string,
    componentId: string,
    timeoutMs?: number
  ): Promise<A2UIUserAction> {
    const requestId = `${surfaceId}:${componentId}`;
    const timeout = timeoutMs || this.DEFAULT_TIMEOUT;

    // Check if there's already a pending request
    if (this.pendingInputs.has(requestId)) {
      throw new Error(`Input request already pending for ${requestId}`);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingInputs.delete(requestId);
        reject(new Error(`Input request timed out after ${timeout}ms`));
      }, timeout);

      this.pendingInputs.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // Notify clients that input is requested
      this.broadcast({
        type: 'inputRequested',
        surfaceId,
        componentId,
        requestId,
      });
    });
  }
}
