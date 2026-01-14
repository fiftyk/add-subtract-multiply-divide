/**
 * No Timeout Strategy (Default)
 *
 * Provides infinite timeout for all steps, allowing user input steps
 * to wait indefinitely for user response.
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { TimeoutStrategy } from '../interfaces/TimeoutStrategy.js';
import type { ExecutionPlan } from '../../planner/types.js';

/**
 * Default timeout strategy - no timeout for any step
 *
 * This is the recommended default as:
 * - User input steps should never timeout (user can take their time)
 * - Function calls should be allowed to complete naturally
 * - If specific timeout is needed, use ConfigurableTimeoutStrategy instead
 */
@injectable()
export class NoTimeoutStrategy implements TimeoutStrategy {
  getTimeout(_step: ExecutionPlan['steps'][0]): number | undefined {
    // Return undefined for infinite timeout
    return undefined;
  }
}
