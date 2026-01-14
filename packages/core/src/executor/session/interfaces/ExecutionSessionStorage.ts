/**
 * Execution Session Storage Interface
 *
 * Provides persistent storage for ExecutionSession objects.
 * This is separate from SessionStore which is for temporary in-memory or file-based storage.
 * ExecutionSessionStorage is specifically for managing execution history and statistics.
 */

import type { ExecutionSession } from '../types.js';
import type { ExecutionStatus } from '../../../a2ui/types.js';

/**
 * Query options for listing sessions
 */
export interface ListSessionsOptions {
  /** Filter by exact plan ID (e.g., "plan-abc" or "plan-abc-v2") */
  planId?: string;
  /** Filter by base plan ID without version (e.g., "plan-abc") */
  basePlanId?: string;
  /** Filter by execution status */
  status?: ExecutionStatus;
  /** Filter by platform */
  platform?: 'cli' | 'web';
  /** Maximum number of results */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Execution statistics for a plan
 */
export interface ExecutionStats {
  /** Total number of executions */
  totalExecutions: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Average execution duration in milliseconds */
  averageDuration: number;
}

/**
 * Execution Session Storage Interface
 *
 * Manages persistent storage and querying of execution sessions.
 */
export interface ExecutionSessionStorage {
  // ============================================
  // Basic CRUD Operations
  // ============================================

  /**
   * Save a session
   * @param session - The session to save
   */
  saveSession(session: ExecutionSession): Promise<void>;

  /**
   * Load a session by ID
   * @param sessionId - The session ID to load
   * @returns The session, or undefined if not found
   */
  loadSession(sessionId: string): Promise<ExecutionSession | undefined>;

  /**
   * Update an existing session
   * @param sessionId - The session ID to update
   * @param updates - Partial updates to apply
   */
  updateSession(
    sessionId: string,
    updates: Partial<ExecutionSession>
  ): Promise<void>;

  /**
   * Delete a session
   * @param sessionId - The session ID to delete
   */
  deleteSession(sessionId: string): Promise<void>;

  // ============================================
  // Query Operations
  // ============================================

  /**
   * List sessions with optional filtering
   * @param options - Query options
   * @returns Array of matching sessions, sorted by creation time (newest first)
   */
  listSessions(options?: ListSessionsOptions): Promise<ExecutionSession[]>;

  /**
   * List all sessions for a specific plan ID
   * @param planId - The plan ID (e.g., "plan-abc" or "plan-abc-v2")
   * @returns Array of sessions, sorted by creation time (newest first)
   */
  listSessionsByPlan(planId: string): Promise<ExecutionSession[]>;

  /**
   * List all sessions for a base plan (all versions)
   * @param basePlanId - The base plan ID without version (e.g., "plan-abc")
   * @returns Array of sessions, sorted by creation time (newest first)
   */
  listSessionsByBasePlan(basePlanId: string): Promise<ExecutionSession[]>;

  /**
   * Get the N most recent sessions
   * @param limit - Maximum number of sessions to return
   * @returns Array of sessions, sorted by creation time (newest first)
   */
  getRecentSessions(limit: number): Promise<ExecutionSession[]>;

  // ============================================
  // Statistics Operations
  // ============================================

  /**
   * Get execution statistics for a plan
   * @param planId - The plan ID (can be base ID or versioned ID)
   * @returns Execution statistics
   */
  getExecutionStats(planId: string): Promise<ExecutionStats>;
}

/**
 * Symbol for dependency injection
 */
export const ExecutionSessionStorage = Symbol('ExecutionSessionStorage');
