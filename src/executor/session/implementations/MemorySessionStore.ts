/**
 * Memory Session Store
 *
 * In-memory implementation of ExecutionSessionStore.
 * Used for CLI testing and simple scenarios where persistence is not required.
 */

import { injectable } from 'inversify';
import type { ExecutionSession } from '../types.js';
import { ExecutionSessionStore } from '../interfaces/SessionStore.js';

/**
 * Memory Session Store Implementation
 *
 * Stores sessions in a Map in memory. Sessions are lost when the process exits.
 * Suitable for CLI usage and testing scenarios.
 */
@injectable()
export class MemorySessionStore implements ExecutionSessionStore {
  private sessions = new Map<string, ExecutionSession>();

  async saveSession(session: ExecutionSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async loadSession(id: string): Promise<ExecutionSession | undefined> {
    const session = this.sessions.get(id);
    return session ? { ...session } : undefined;
  }

  async updateSession(
    id: string,
    updates: Partial<ExecutionSession>
  ): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      const updated = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.sessions.set(id, updated);
    }
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async listSessions(): Promise<ExecutionSession[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }
}
