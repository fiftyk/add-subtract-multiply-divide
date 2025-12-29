import type { MissingFunction } from '../../planner/types.js';
import type { MockGenerationResult, ReturnFieldRef } from '../types.js';

/**
 * Interface for orchestrating mock generation workflow
 * Responsibility: Coordinate code generation, file writing, loading, and registration
 * This is a Facade that coordinates multiple services
 */
export interface IMockOrchestrator {
  /**
   * Generate and register mock functions for missing functions
   * @param missingFunctions - List of missing functions to generate
   * @param referencedFields - Map of function name to referenced return fields
   * @returns Result of the generation operation
   */
  generateAndRegisterMocks(
    missingFunctions: MissingFunction[],
    referencedFields?: Record<string, ReturnFieldRef[]>
  ): Promise<MockGenerationResult>;
}
