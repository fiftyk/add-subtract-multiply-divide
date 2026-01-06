/**
 * Interruptible Executor Interface
 *
 * Defines the contract for executing plans that can be paused for user input
 * and resumed later. Used by both CLI and Web platforms.
 */

import type { ExecutionSession } from '../session/types.js';
import type { ExecutionResult, StepResult } from '../types.js';
import type { A2UISchema } from '../../a2ui/types.js';

export const InterruptibleExecutor = Symbol('InterruptibleExecutor');

/**
 * Executor Callbacks
 *
 * Functions called during execution lifecycle.
 */
export interface ExecutorCallbacks {
  /** Called when a step completes successfully */
  onStepComplete?: (stepResult: StepResult) => void;
  /** Called when user input is required - must return the user's input values */
  onInputRequired?: (
    surfaceId: string,
    schema: A2UISchema
  ) => Promise<Record<string, unknown>>;
}

/**
 * Interruptible Executor Interface
 *
 * Extends the basic Executor with pause/resume capabilities for user input.
 * The executor calls callbacks to notify the UI of progress and request input.
 */
export interface InterruptibleExecutor {
  /**
   * Execute a session
   *
   * Executes the plan step by step. When a user_input step is encountered,
   * the executor calls onInputRequired and waits for the returned Promise
   * to resolve before continuing.
   *
   * @param session - The session containing the plan and state
   * @param callbacks - Lifecycle callbacks for UI updates
   * @returns The final execution result
   */
  execute(
    session: ExecutionSession,
    callbacks?: ExecutorCallbacks
  ): Promise<ExecutionResult>;
}
