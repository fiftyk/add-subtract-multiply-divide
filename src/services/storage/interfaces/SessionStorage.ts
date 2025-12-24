import type { InteractionSession } from '../../types.js';

export interface SessionStorage {
  saveSession(session: InteractionSession): Promise<void>;
  loadSession(sessionId: string): Promise<InteractionSession | null>;
  updateSession(sessionId: string, updates: Partial<InteractionSession>): Promise<void>;
  listSessions(): Promise<InteractionSession[]>;
  deleteSession(sessionId: string): Promise<void>;
}

export const SessionStorage = Symbol('SessionStorage');
