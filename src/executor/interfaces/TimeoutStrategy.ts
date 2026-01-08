/**
 * Timeout Strategy Interface
 *
 * Defines how timeout should be applied to different types of execution steps.
 */

import type { ExecutionPlan } from '../../planner/types.js';

/**
 * Strategy for determining timeout duration for different step types
 */
export interface TimeoutStrategy {
  /**
   * Get timeout duration in milliseconds for a given step
   * @param step - The execution step
   * @returns Timeout in milliseconds, or undefined for no timeout
   */
  getTimeout(step: ExecutionPlan['steps'][0]): number | undefined;
}

export const TimeoutStrategy = Symbol('TimeoutStrategy');
