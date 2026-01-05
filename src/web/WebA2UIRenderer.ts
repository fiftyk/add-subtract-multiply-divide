/**
 * Web A2UI Renderer
 *
 * Renders A2UI components using Server-Sent Events (SSE).
 * Implements the A2UIRenderer interface for web-based UI.
 */

import { inject, injectable } from 'inversify';
import type { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
import type { A2UIComponent, A2UIUserAction } from '../a2ui/types.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

interface Surface {
  id: string;
  rootId: string;
  components: Map<string, A2UIComponent>;
}

interface SSEClient {
  id: string;
  request: IncomingMessage;
  response: ServerResponse;
  surfaces: Map<string, Surface>;
}

export const WebA2UIRenderer = Symbol('WebA2UIRenderer');

@injectable()
export class WebRendererImpl implements A2UIRenderer {
  private clients = new Map<string, SSEClient>();
  private surfaces = new Map<string, Surface>();
  private actionHandler?: (action: A2UIUserAction) => void;

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
   */
  handleUserAction(action: A2UIUserAction): void {
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
   * Request user input - not used in web mode, actions come via HTTP
   */
  async requestInput(surfaceId: string, componentId: string): Promise<A2UIUserAction> {
    // In web mode, inputs are handled via SSE + HTTP action endpoint
    // This method is only for CLI blocking input
    throw new Error('requestInput not supported in web mode. Use SSE events and /api/action endpoint.');
  }
}
