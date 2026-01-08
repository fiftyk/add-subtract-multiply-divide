/**
 * Execution Session Types
 *
 * Defines the structure for interruptible execution sessions
 * that can be paused and resumed across different UI platforms.
 */

import type { ExecutionPlan } from '../../planner/types.js';
import type { StepResult } from '../types.js';
import type { ExecutionStatus, A2UISchema } from '../../a2ui/types.js';

/**
 * Execution Session
 *
 * Represents an ongoing execution that can be paused for user input
 * and resumed later. The state is persisted via SessionStore.
 */
export interface ExecutionSession {
  /** Unique session identifier */
  id: string;
  /** The execution plan to run */
  plan: ExecutionPlan;
  /** Current execution status */
  status: ExecutionStatus;
  /** The current step being executed (0-based index) */
  currentStepId: number;
  /** Results from completed steps */
  stepResults: StepResult[];
  /** Serializable context data for expression resolution */
  context: Record<string, unknown>;
  /** Pending user input request (null if not waiting) */
  pendingInput: {
    surfaceId: string;
    stepId: number;
    schema: A2UISchema;
  } | null;
  /** Session creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  plan: ExecutionPlan;
  sessionId?: string;
}
