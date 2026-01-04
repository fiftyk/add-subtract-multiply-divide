/**
 * WebSocket Server
 *
 * 提供实时双向通信,支持交互式会话
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import type { SessionEvent, SessionInfo } from '../core/services/interfaces/InteractiveSession.js';
import type { InteractiveSessionService } from '../core/services/InteractiveSessionService.js';
import { LoggerFactory } from '../logger/index.js';

const logger = LoggerFactory.create();

interface ClientInfo {
  ws: WebSocket;
  sessionId?: string;
  subscriptions: Set<string>;
  authenticated: boolean;
}

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  planId?: string;
  request?: string;
  value?: boolean | string | number;
  token?: string;
}

export class WebSocketServerImpl {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private eventUnsubscribe: (() => void) | null = null;
  private authToken: string | null;

  constructor(
    private sessionService: InteractiveSessionService,
    private port: number = 3001,
    authToken?: string
  ) {
    // Use provided token or environment variable
    this.authToken = authToken || process.env.WS_AUTH_TOKEN || null;

    if (!this.authToken) {
      logger.warn('WebSocket authentication is disabled. Set WS_AUTH_TOKEN environment variable to enable.');
    }
  }

  /**
   * Extract token from URL query parameters
   */
  private extractTokenFromUrl(request: IncomingMessage): string | null {
    const url = request.url;
    if (!url) return null;

    try {
      const params = new URL(url, `http://${request.headers.host}`).searchParams;
      return params.get('token');
    } catch {
      return null;
    }
  }

  /**
   * Validate authentication token
   */
  private validateToken(token: string | null | undefined): boolean {
    // If no auth token is configured, allow all connections
    if (!this.authToken) {
      return true;
    }

    return token === this.authToken;
  }

  start(): void {
    try {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('error', (error: Error) => {
        if ((error as any).code === 'EADDRINUSE') {
          logger.warn('WebSocket port already in use, skipping', { port: this.port });
        } else {
          logger.warn('WebSocket server error', { error: error.message });
        }
      });

      this.wss.on('listening', () => {
        logger.info('WebSocket server started', { port: this.port, url: `ws://localhost:${this.port}` });
      });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();

      // Extract and validate token from URL
      const urlToken = this.extractTokenFromUrl(request);
      const authenticated = this.validateToken(urlToken);

      // If authentication is required and token is invalid, reject connection
      if (this.authToken && !authenticated) {
        logger.warn('WebSocket connection rejected: invalid or missing token', { clientId });
        this.sendError(ws, 'Authentication required. Provide valid token in URL query parameter: ?token=YOUR_TOKEN');
        ws.close(1008, 'Authentication required');
        return;
      }

      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        authenticated,
      });

      logger.debug('WebSocket client connected', { clientId, authenticated });

      // 发送欢迎消息
      this.sendToClient(ws, {
        type: 'connected',
        clientId,
        authenticated,
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data: RawData) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', error as Error, { clientId });
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        logger.debug('WebSocket client disconnected', { clientId });
        this.clients.delete(clientId);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', error, { clientId });
      });
    });
    } catch (error) {
      logger.warn('WebSocket server failed to start', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
    }
    this.clients.clear();
  }

  private handleMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Allow 'auth' messages even if not authenticated
    if (message.type === 'auth') {
      this.handleAuth(clientId, message);
      return;
    }

    // Check authentication for all other message types
    if (this.authToken && !client.authenticated) {
      this.sendError(client.ws, 'Authentication required. Send auth message with valid token first.');
      return;
    }

    switch (message.type) {
      case 'start':
        this.handleStart(clientId, message);
        break;

      case 'confirm':
        this.handleConfirm(clientId, message);
        break;

      case 'input':
        this.handleInput(clientId, message);
        break;

      case 'cancel':
        this.handleCancel(clientId, message);
        break;

      case 'subscribe':
        if (message.sessionId) {
          client.subscriptions.add(message.sessionId);
        }
        break;

      case 'unsubscribe':
        if (message.sessionId) {
          client.subscriptions.delete(message.sessionId);
        }
        break;

      default:
        this.sendError(client.ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleStart(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const session = await this.sessionService.start(message.request || '', message.planId);
      client.sessionId = session.id;
      client.subscriptions.add(session.id);

      // 发送计划详情
      this.sendToClient(client.ws, {
        type: 'session_created',
        sessionId: session.id,
        planId: session.planId,
        steps: session.steps,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendError(client.ws, String(error));
    }
  }

  private async handleConfirm(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (!client.sessionId) {
      this.sendError(client.ws, 'No active session');
      return;
    }

    try {
      await this.sessionService.confirm(client.sessionId, Boolean(message.value));
    } catch (error) {
      this.sendError(client.ws, String(error));
    }
  }

  private async handleInput(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (!client.sessionId) {
      this.sendError(client.ws, 'No active session');
      return;
    }

    try {
      await this.sessionService.sendInput(client.sessionId, { value: message.value });
    } catch (error) {
      this.sendError(client.ws, String(error));
    }
  }

  private async handleCancel(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (!client.sessionId) {
      this.sendError(client.ws, 'No active session');
      return;
    }

    try {
      await this.sessionService.cancel(client.sessionId);
    } catch (error) {
      this.sendError(client.ws, String(error));
    }
  }

  /**
   * Handle authentication message
   * Allows clients to authenticate after connection if they didn't provide token in URL
   */
  private handleAuth(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // If already authenticated, no need to authenticate again
    if (client.authenticated) {
      this.sendToClient(client.ws, {
        type: 'auth_success',
        message: 'Already authenticated',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate token from message
    const valid = this.validateToken(message.token);

    if (valid) {
      client.authenticated = true;
      logger.debug('WebSocket client authenticated via message', { clientId });
      this.sendToClient(client.ws, {
        type: 'auth_success',
        message: 'Authentication successful',
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.warn('WebSocket authentication failed', { clientId });
      this.sendError(client.ws, 'Authentication failed: invalid token');
      // Close connection after failed authentication
      client.ws.close(1008, 'Authentication failed');
    }
  }

  private sendToClient(ws: WebSocket, data: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendToClient(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const WebSocketServer$ = Symbol('WebSocketServer');
