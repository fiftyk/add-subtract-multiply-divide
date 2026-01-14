import type { PlanRefinementSession } from '../../types.js';

export interface PlanRefinementSessionStorage {
  saveSession(session: PlanRefinementSession): Promise<void>;
  loadSession(sessionId: string): Promise<PlanRefinementSession | null>;
  updateSession(sessionId: string, updates: Partial<PlanRefinementSession>): Promise<void>;
  listSessions(): Promise<PlanRefinementSession[]>;
  deleteSession(sessionId: string): Promise<void>;
}

export const PlanRefinementSessionStorage = Symbol('PlanRefinementSessionStorage');
