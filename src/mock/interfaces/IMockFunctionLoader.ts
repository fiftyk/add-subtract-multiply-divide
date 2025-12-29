import type { FunctionDefinition } from '../../registry/types.js';
import type { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';

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
   * Register loaded functions to the function provider
   * @param provider - Function provider instance
   * @param functions - Functions to register
   */
  register(provider: FunctionProvider, functions: FunctionDefinition[]): void;
}
