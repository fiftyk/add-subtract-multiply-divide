import { pathToFileURL } from 'url';
import type { IMockFunctionLoader } from '../interfaces/IMockFunctionLoader.js';
import type { FunctionDefinition } from '../../registry/types.js';
import type { FunctionRegistry } from '../../registry/index.js';

/**
 * Dynamically loads and registers mock functions from TypeScript files
 * Follows SRP: Only responsible for loading and registration
 */
export class DynamicMockFunctionLoader implements IMockFunctionLoader {
  /**
   * Dynamically import and extract function definitions from a file
   */
  async load(filePath: string): Promise<FunctionDefinition[]> {
    try {
      // Convert absolute path to file:// URL for dynamic import
      const fileUrl = pathToFileURL(filePath).href;

      // Add cache busting to ensure fresh import
      const moduleUrl = `${fileUrl}?t=${Date.now()}`;

      const module = await import(moduleUrl);

      // Extract all exported function definitions
      const functions: FunctionDefinition[] = [];
      for (const key of Object.keys(module)) {
        const exported = module[key];
        // Check if it's a function definition object
        if (
          exported &&
          typeof exported === 'object' &&
          'name' in exported &&
          'implementation' in exported
        ) {
          functions.push(exported as FunctionDefinition);
        }
      }

      return functions;
    } catch (error) {
      throw new Error(
        `Failed to load mock function from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Register loaded functions to the registry
   */
  register(registry: FunctionRegistry, functions: FunctionDefinition[]): void {
    for (const fn of functions) {
      registry.register(fn);
    }
  }
}
