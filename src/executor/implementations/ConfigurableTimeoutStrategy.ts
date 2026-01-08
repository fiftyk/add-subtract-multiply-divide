/**
 * Configurable Timeout Strategy
 *
 * Allows custom timeout configuration per step type.
 * User input steps have no timeout by default.
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { TimeoutStrategy } from '../interfaces/TimeoutStrategy.js';
import type { ExecutionPlan } from '../../planner/types.js';
import { isUserInputStep, isFunctionCallStep } from '../../planner/type-guards.js';

export interface TimeoutConfig {
  /** Timeout for function_call steps (ms). undefined = no timeout */
  functionCall?: number;
  /** Timeout for user_input steps (ms). undefined = no timeout (recommended) */
  userInput?: number;
  /** Default timeout for unknown step types (ms). undefined = no timeout */
  default?: number;
}

/**
 * Configurable timeout strategy
 *
 * Allows setting different timeouts for different step types.
 * Recommended configuration:
 * - userInput: undefined (no timeout)
 * - functionCall: 30000 (30 seconds) or undefined (no timeout)
 */
@injectable()
export class ConfigurableTimeoutStrategy implements TimeoutStrategy {
  constructor(private config: TimeoutConfig = {}) {}

  getTimeout(step: ExecutionPlan['steps'][0]): number | undefined {
    if (isUserInputStep(step)) {
      return this.config.userInput; // undefined by default
    }

    if (isFunctionCallStep(step)) {
      return this.config.functionCall;
    }

    return this.config.default;
  }
}
