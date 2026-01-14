import type { ServerResponse } from 'http';
import type { SSEEvent } from '../types/sse.js';

export interface SSEManagerConfig {
  /** 心跳间隔（毫秒），0 表示禁用心跳 */
  heartbeatInterval: number;
  /** 连接超时时间（毫秒），0 表示禁用超时检测 */
  connectionTimeout: number;
  /** 是否自动清理无连接的会话历史 */
  autoCleanupHistory: boolean;
  /** 历史自动清理间隔（毫秒），0 表示禁用 */
  historyCleanupInterval: number;
}

export interface ConnectionInfo {
  response: ServerResponse;
  lastActivity: number;
  lastHeartbeat: number;
  heartbeatTimer?: ReturnType<typeof setTimeout>;
}

export interface SSEManager {
  // Interface for compatibility
}

/**
 * SSE Manager
 * Manages Server-Sent Events connections with timeout and cleanup
 */
export class SSEManager {
  private connections: Map<string, Set<ConnectionInfo>>;
  private eventHistory: Map<string, SSEEvent[]>;
  private readonly MAX_HISTORY_SIZE = 100;

  // Configuration
  private config: SSEManagerConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SSEManagerConfig>) {
    this.config = {
      heartbeatInterval: config?.heartbeatInterval ?? 30000, // 30秒心跳
      connectionTimeout: config?.connectionTimeout ?? 300000, // 5分钟超时
      autoCleanupHistory: config?.autoCleanupHistory ?? true,
      historyCleanupInterval: config?.historyCleanupInterval ?? 60000, // 1分钟清理
    };

    this.connections = new Map();
    this.eventHistory = new Map();

    // Start cleanup interval if enabled
    if (this.config.autoCleanupHistory || this.config.connectionTimeout > 0) {
      this.startCleanupInterval();
    }
  }

  /**
   * Add a new SSE connection for a session
   */
  addConnection(sessionId: string, res: ServerResponse): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    const connectionInfo: ConnectionInfo = {
      response: res,
      lastActivity: Date.now(),
      lastHeartbeat: 0
    };

    this.connections.get(sessionId)!.add(connectionInfo);

    console.log(`[SSE] Connection added for session ${sessionId}. Total: ${this.connections.get(sessionId)!.size}`);

    // Send any cached events to the new connection
    this.replayEvents(sessionId, res);

    // Set up close handler
    this.setupCloseHandler(sessionId, connectionInfo);

    // Start heartbeat if enabled
    if (this.config.heartbeatInterval > 0) {
      this.startHeartbeat(sessionId, connectionInfo);
    }
  }

  /**
   * Set up close handler for connection
   */
  private setupCloseHandler(sessionId: string, connectionInfo: ConnectionInfo): void {
    const { response } = connectionInfo;

    // Store original end/destroy methods
    const originalEnd = response.end.bind(response);
    const originalDestroy = response.destroy?.bind(response);

    // Override end to trigger cleanup
    response.end = ((...args: Parameters<typeof response.end>) => {
      this.removeConnection(sessionId, connectionInfo);
      return originalEnd(...args);
    }) as typeof response.end;

    // Override destroy if available
    if (response.destroy) {
      response.destroy = ((...args: Parameters<typeof response.destroy>) => {
        this.removeConnection(sessionId, connectionInfo);
        return originalDestroy?.(...args);
      }) as typeof response.destroy;
    }
  }

  /**
   * Start heartbeat for a connection
   */
  private startHeartbeat(sessionId: string, connectionInfo: ConnectionInfo): void {
    const heartbeat = () => {
      const connections = this.connections.get(sessionId);
      if (!connections || !connections.has(connectionInfo)) {
        return; // Connection already removed
      }

      // Check if connection is still alive
      if (this.config.connectionTimeout > 0) {
        const idleTime = Date.now() - connectionInfo.lastActivity;
        if (idleTime > this.config.connectionTimeout) {
          console.log(`[SSE] Connection timeout for session ${sessionId} (idle: ${idleTime}ms)`);
          this.removeConnection(sessionId, connectionInfo);
          return;
        }
      }

      // Send heartbeat comment
      try {
        connectionInfo.response.write(`: heartbeat\n\n`);
        connectionInfo.lastHeartbeat = Date.now();
      } catch {
        // Connection lost, remove it
        this.removeConnection(sessionId, connectionInfo);
        return;
      }

      // Schedule next heartbeat
      if (this.connections.has(sessionId) && this.connections.get(sessionId)!.has(connectionInfo)) {
        connectionInfo.heartbeatTimer = setTimeout(heartbeat, this.config.heartbeatInterval);
      }
    };

    connectionInfo.heartbeatTimer = setTimeout(heartbeat, this.config.heartbeatInterval);
  }

  /**
   * Remove an SSE connection
   */
  removeConnection(sessionId: string, connectionInfo: ConnectionInfo): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(connectionInfo);

      // Clear heartbeat timer if exists
      if (connectionInfo.heartbeatTimer) {
        clearTimeout(connectionInfo.heartbeatTimer);
      }

      console.log(`[SSE] Connection removed for session ${sessionId}. Remaining: ${sessionConnections.size}`);

      if (sessionConnections.size === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  /**
   * Remove a connection by its response object
   * Useful for cleanup handlers that only have access to the response
   */
  removeConnectionByResponse(sessionId: string, res: ServerResponse): void {
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections) return;

    // Find the connection info with matching response
    for (const connInfo of sessionConnections) {
      if (connInfo.response === res) {
        this.removeConnection(sessionId, connInfo);
        return;
      }
    }
  }

  /**
   * Emit an event to all connections for a session
   */
  emit(sessionId: string, event: SSEEvent): void {
    // Store event in history
    if (!this.eventHistory.has(sessionId)) {
      this.eventHistory.set(sessionId, []);
    }

    const history = this.eventHistory.get(sessionId)!;
    history.push(event);

    // Limit history size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }

    // Broadcast to all connections
    const sessionConnections = this.connections.get(sessionId);
    if (!sessionConnections || sessionConnections.size === 0) {
      console.log(`[SSE] No active connections for session ${sessionId}. Event cached.`);
      return;
    }

    const data = JSON.stringify(event);
    const message = `data: ${data}\n\n`;

    sessionConnections.forEach(connInfo => {
      try {
        connInfo.response.write(message);
        connInfo.lastActivity = Date.now(); // Update activity on successful write
      } catch (error) {
        console.error(`[SSE] Error writing to connection:`, error);
        this.removeConnection(sessionId, connInfo);
      }
    });

    console.log(`[SSE] Event '${event.type}' sent to ${sessionConnections.size} connections`);
  }

  /**
   * Replay cached events to a new connection
   */
  private replayEvents(sessionId: string, res: ServerResponse): void {
    const history = this.eventHistory.get(sessionId);
    if (!history || history.length === 0) {
      return;
    }

    console.log(`[SSE] Replaying ${history.length} events for session ${sessionId}`);

    history.forEach(event => {
      const data = JSON.stringify(event);
      const message = `data: ${data}\n\n`;

      try {
        res.write(message);
      } catch (error) {
        console.error(`[SSE] Error replaying event:`, error);
      }
    });
  }

  /**
   * Clean up history for completed sessions
   */
  clearHistory(sessionId: string): void {
    this.eventHistory.delete(sessionId);
    console.log(`[SSE] History cleared for session ${sessionId}`);
  }

  /**
   * Clean up all stale connections and old histories
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up stale connections (timeout check)
    if (this.config.connectionTimeout > 0) {
      this.connections.forEach((connections, sessionId) => {
        connections.forEach(connInfo => {
          const idleTime = now - connInfo.lastActivity;
          if (idleTime > this.config.connectionTimeout) {
            console.log(`[SSE] Cleaning up stale connection for session ${sessionId} (idle: ${idleTime}ms)`);
            this.removeConnection(sessionId, connInfo);
          }
        });
      });
    }

    // Clean up old histories (sessions with no connections for a long time)
    if (this.config.autoCleanupHistory) {
      const MAX_HISTORY_AGE = 3600000; // 1 hour
      this.eventHistory.forEach((history, sessionId) => {
        const connections = this.connections.get(sessionId);
        if (!connections || connections.size === 0) {
          // Check if history is old enough to clean
          const lastEventTime = history.length > 0 ? now : 0; // We don't track event time, clean on next interval
          if (history.length > 0 && (now - (history[history.length - 1] as unknown as { timestamp?: number }).timestamp!) > MAX_HISTORY_AGE) {
            this.clearHistory(sessionId);
          }
        }
      });
    }
  }

  /**
   * Start periodic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    const interval = Math.max(
      this.config.historyCleanupInterval,
      this.config.connectionTimeout > 0 ? this.config.connectionTimeout / 10 : 60000
    );

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);

    console.log(`[SSE] Cleanup interval started (${interval}ms)`);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log(`[SSE] Cleanup interval stopped`);
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount(sessionId?: string): number {
    if (sessionId) {
      return this.connections.get(sessionId)?.size || 0;
    }

    let total = 0;
    this.connections.forEach(connections => {
      total += connections.size;
    });
    return total;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeSessions: number;
    totalHistoryEvents: number;
  } {
    let totalConnections = 0;
    this.connections.forEach(connections => {
      totalConnections += connections.size;
    });

    let totalHistoryEvents = 0;
    this.eventHistory.forEach(events => {
      totalHistoryEvents += events.length;
    });

    return {
      totalConnections,
      activeSessions: this.connections.size,
      totalHistoryEvents
    };
  }

  /**
   * Close all connections for a session
   */
  closeSession(sessionId: string): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.forEach(connInfo => {
        // Clear heartbeat timer
        if (connInfo.heartbeatTimer) {
          clearTimeout(connInfo.heartbeatTimer);
        }

        try {
          connInfo.response.end();
        } catch (error) {
          console.error(`[SSE] Error closing connection:`, error);
        }
      });

      this.connections.delete(sessionId);
      console.log(`[SSE] All connections closed for session ${sessionId}`);
    }

    // Optionally clear history
    this.clearHistory(sessionId);
  }

  /**
   * Destroy the manager and clean up all resources
   */
  destroy(): void {
    this.stopCleanupInterval();

    // Close all connections
    this.connections.forEach((_, sessionId) => {
      this.closeSession(sessionId);
    });

    // Clear all histories
    this.eventHistory.clear();

    console.log(`[SSE] Manager destroyed`);
  }
}

// Add heartbeatTimer to ConnectionInfo interface (must be after class definition)
// This is a temporary fix for TypeScript - in production, this should be part of the interface
declare module '../types/sse.js' {
  // Extended types would go here
}

// Extend ConnectionInfo type for heartbeat timer
interface ExtendedConnectionInfo extends ConnectionInfo {
  heartbeatTimer?: ReturnType<typeof setTimeout>;
}

// Singleton instance with default config
export const sseManager = new SSEManager();
