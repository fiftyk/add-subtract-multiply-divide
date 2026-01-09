import type { ServerResponse } from 'http';
import type { SSEEvent } from '../types/sse.js';

/**
 * SSE Manager
 * Manages Server-Sent Events connections and broadcasting
 */
export class SSEManager {
  private connections: Map<string, Set<ServerResponse>>;
  private eventHistory: Map<string, SSEEvent[]>;
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    this.connections = new Map();
    this.eventHistory = new Map();
  }

  /**
   * Add a new SSE connection for a session
   */
  addConnection(sessionId: string, res: ServerResponse): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    this.connections.get(sessionId)!.add(res);

    console.log(`[SSE] Connection added for session ${sessionId}. Total: ${this.connections.get(sessionId)!.size}`);

    // Send any cached events to the new connection
    this.replayEvents(sessionId, res);
  }

  /**
   * Remove an SSE connection
   */
  removeConnection(sessionId: string, res: ServerResponse): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(res);

      console.log(`[SSE] Connection removed for session ${sessionId}. Remaining: ${sessionConnections.size}`);

      if (sessionConnections.size === 0) {
        this.connections.delete(sessionId);
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

    sessionConnections.forEach(res => {
      try {
        res.write(message);
      } catch (error) {
        console.error(`[SSE] Error writing to connection:`, error);
        this.removeConnection(sessionId, res);
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
   * Close all connections for a session
   */
  closeSession(sessionId: string): void {
    const sessionConnections = this.connections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.forEach(res => {
        try {
          res.end();
        } catch (error) {
          console.error(`[SSE] Error closing connection:`, error);
        }
      });

      this.connections.delete(sessionId);
      console.log(`[SSE] All connections closed for session ${sessionId}`);
    }
  }
}

// Singleton instance
export const sseManager = new SSEManager();
