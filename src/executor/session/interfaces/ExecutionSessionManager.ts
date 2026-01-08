/**
 * Execution Session Manager Interface
 *
 * Business logic layer for managing the lifecycle of execution sessions.
 * Orchestrates interactions between ExecutionSessionStorage, Executor, and Storage.
 */

import type { ExecutionPlan } from '../../../planner/types.js';
import type { ExecutionResult } from '../../types.js';
import type { ExecutionSession } from '../types.js';
import type { ExecutorCallbacks } from '../../interfaces/InterruptibleExecutor.js';
import type { ExecutionStatus } from '../../../a2ui/types.js';

/**
 * Execution Session Manager Interface
 *
 * Provides high-level operations for session management.
 */
export interface ExecutionSessionManager {
  /**
   * Create a new execution session
   *
   * @param plan - The execution plan to run
   * @param platform - The platform running the execution ('cli' or 'web')
   * @returns The created session
   */
  createSession(
    plan: ExecutionPlan,
    platform: 'cli' | 'web'
  ): Promise<ExecutionSession>;

  /**
   * Execute a session
   *
   * Loads the plan, executes it step by step, and updates the session
   * with results. The session is persisted at each step.
   *
   * @param sessionId - The session ID to execute
   * @param callbacks - Optional callbacks for step completion and user input
   * @returns The final execution result
   */
  executeSession(
    sessionId: string,
    callbacks?: ExecutorCallbacks
  ): Promise<ExecutionResult>;

  /**
   * Retry a failed session
   *
   * Creates a new session based on a failed session, optionally starting
   * from a specific step to preserve successful step results.
   *
   * @param failedSessionId - The ID of the failed session to retry
   * @param fromStep - Optional step ID to start from (0-based)
   * @returns The new retry session
   */
  retrySession(
    failedSessionId: string,
    fromStep?: number
  ): Promise<ExecutionSession>;

  /**
   * Resume a session waiting for user input
   *
   * Provides user input to a session in 'waiting_input' status and
   * continues execution.
   *
   * @param sessionId - The session ID to resume
   * @param userInput - The user input values
   * @returns The final execution result
   */
  resumeSession(
    sessionId: string,
    userInput: Record<string, unknown>
  ): Promise<ExecutionResult>;

  /**
   * Get the current status of a session
   *
   * @param sessionId - The session ID to check
   * @returns The current execution status, or undefined if not found
   */
  getSessionStatus(sessionId: string): Promise<ExecutionStatus | undefined>;

  /**
   * Cancel a running session
   *
   * Marks a session as failed with a cancellation message.
   * Note: This does not actually stop the execution if it's already running.
   *
   * @param sessionId - The session ID to cancel
   */
  cancelSession(sessionId: string): Promise<void>;
}

/**
 * Symbol for dependency injection
 */
export const ExecutionSessionManager = Symbol('ExecutionSessionManager');
