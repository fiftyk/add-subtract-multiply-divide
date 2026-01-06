/**
 * Execution Session Store Interface
 *
 * Defines the contract for persisting and retrieving execution sessions.
 * Implementations can use memory (CLI), files (Web), or databases.
 */

import type { ExecutionSession } from '../types.js';

export const ExecutionSessionStore = Symbol('ExecutionSessionStore');

/**
 * Session Store Interface
 *
 * Provides methods for managing execution session state persistence.
 * Sessions can be stored in memory, files, or databases depending on the implementation.
 */
export interface ExecutionSessionStore {
  /**
   * Save a session to storage
   */
  saveSession(session: ExecutionSession): Promise<void>;

  /**
   * Load a session by ID
   * Returns undefined if session not found
   */
  loadSession(id: string): Promise<ExecutionSession | undefined>;

  /**
   * Update specific fields of a session
   */
  updateSession(
    id: string,
    updates: Partial<ExecutionSession>
  ): Promise<void>;

  /**
   * Delete a session from storage
   */
  deleteSession(id: string): Promise<void>;

  /**
   * List all sessions
   */
  listSessions(): Promise<ExecutionSession[]>;
}
