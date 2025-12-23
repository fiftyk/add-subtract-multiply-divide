import type { FunctionDefinition } from '../../registry/types.js';
import type { FunctionRegistry } from '../../registry/index.js';

/**
 * Interface for loading and registering mock functions
 * Responsibility: Dynamically load TypeScript files and register functions
 */
export interface IMockFunctionLoader {
  /**
   * Dynamically load function definitions from a file
   * @param filePath - Absolute path to the function file
   * @returns Array of loaded function definitions
   */
  load(filePath: string): Promise<FunctionDefinition[]>;

  /**
   * Register loaded functions to the registry
   * @param registry - Function registry instance
   * @param functions - Functions to register
   */
  register(registry: FunctionRegistry, functions: FunctionDefinition[]): void;
}
