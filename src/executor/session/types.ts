/**
 * Execution Session Types
 *
 * Defines the structure for interruptible execution sessions
 * that can be paused and resumed across different UI platforms.
 */

import type { ExecutionPlan } from '../../planner/types.js';
import type { StepResult, ExecutionResult } from '../types.js';
import type { ExecutionStatus, A2UISchema } from '../../a2ui/types.js';

/**
 * Execution Session
 *
 * Represents an ongoing execution that can be paused for user input
 * and resumed later. The state is persisted via ExecutionSessionStorage.
 *
 * This unified session structure is used by both CLI and Web platforms.
 */
export interface ExecutionSession {
  // ========== 标识信息 ==========
  /** Unique session identifier: session-{uuid} */
  id: string;
  /** The execution plan ID (may include version, e.g., plan-abc-v2) */
  planId: string;
  /** Base plan ID without version suffix (e.g., plan-abc) */
  basePlanId: string;
  /** Plan version number (if versioned plan) */
  planVersion?: number;
  /** The execution plan to run (for backward compatibility and convenience) */
  plan: ExecutionPlan;

  // ========== 执行状态 ==========
  /** Current execution status */
  status: ExecutionStatus;
  /** The current step being executed (0-based index) */
  currentStepId: number;
  /** Results from completed steps */
  stepResults: StepResult[];
  /** Serializable context data for expression resolution */
  context: Record<string, unknown>;

  // ========== 用户输入管理 ==========
  /** Pending user input request (null if not waiting) */
  pendingInput: {
    surfaceId: string;
    stepId: number;
    schema: A2UISchema;
  } | null;

  // ========== 最终结果 ==========
  /** Final execution result (populated when status is completed/failed) */
  result?: ExecutionResult;

  // ========== 重试管理 ==========
  /** Parent session ID (if this is a retry of a failed session) */
  parentSessionId?: string;
  /** Number of retries (0 for first attempt) */
  retryCount: number;

  // ========== 元数据 ==========
  /** Session creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Completion timestamp (populated when status is completed/failed) */
  completedAt?: string;
  /** Execution platform (CLI or Web) */
  platform: 'cli' | 'web';
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  plan: ExecutionPlan;
  sessionId?: string;
}
