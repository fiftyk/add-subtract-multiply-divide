import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../types.js';
import type { ILogger } from '../../logger/index.js';

export const Executor = Symbol('Executor');

export interface ExecutorConfig {
  stepTimeout?: number;
  logger?: ILogger;
}

export interface Executor {
  execute(plan: ExecutionPlan): Promise<ExecutionResult>;
  formatResultForDisplay(result: ExecutionResult): string;
}
