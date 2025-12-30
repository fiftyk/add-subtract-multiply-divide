import type { MissingFunction } from '../../planner/types.js';
import type { FunctionGenerationResult, ReturnFieldRef } from '../types.js';

/**
 * Interface for orchestrating function completion workflow
 * Responsibility: Coordinate code generation, file writing, loading, and registration
 * This is a Facade that coordinates multiple services
 */
export interface CompletionOrchestrator {
  /**
   * Generate and register functions for missing functions
   * @param missingFunctions - List of missing functions to generate
   * @param referencedFields - Map of function name to referenced return fields
   * @returns Result of the generation operation
   */
  generateAndRegisterMocks(
    missingFunctions: MissingFunction[],
    referencedFields?: Record<string, ReturnFieldRef[]>
  ): Promise<FunctionGenerationResult>;
}

export const CompletionOrchestrator = Symbol('CompletionOrchestrator');
