import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { IMockCodeGenerator } from '../interfaces/IMockCodeGenerator.js';
import type { IMockFileWriter } from '../interfaces/IMockFileWriter.js';
import type { IMockFunctionLoader } from '../interfaces/IMockFunctionLoader.js';
import type { IMockMetadataProvider } from '../interfaces/IMockMetadataProvider.js';
import type { MissingFunction } from '../../planner/types.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { MockGenerationResult, MockMetadata } from '../types.js';

/**
 * Orchestrates the mock function generation workflow
 * Follows Facade pattern: Coordinates multiple services
 * Follows SRP: Only responsible for workflow coordination
 */
export class MockOrchestrator implements IMockOrchestrator {
  constructor(
    private codeGenerator: IMockCodeGenerator,
    private fileWriter: IMockFileWriter,
    private functionLoader: IMockFunctionLoader,
    private metadataProvider: IMockMetadataProvider,
    private registry: FunctionRegistry
  ) {}

  /**
   * Generate and register mock functions for missing functions
   */
  async generateAndRegisterMocks(
    missingFunctions: MissingFunction[]
  ): Promise<MockGenerationResult> {
    const results: MockMetadata[] = [];
    const errors: Array<{ functionName: string; error: string }> = [];

    for (const missing of missingFunctions) {
      try {
        // 1. Generate code
        const code = await this.codeGenerator.generate({
          name: missing.name,
          description: missing.description,
          parameters: missing.suggestedParameters,
          returns: missing.suggestedReturns,
        });

        // 2. Write to file (with timestamp to avoid conflicts)
        // Generate .js file directly so it can be dynamically imported
        const fileName = `${missing.name}-${Date.now()}.js`;
        const filePath = await this.fileWriter.write(code, fileName);

        // 3. Load function definitions from file
        const functions = await this.functionLoader.load(filePath);

        // 4. Register functions to registry
        this.functionLoader.register(this.registry, functions);

        // 5. Mark as mock and store metadata
        const metadata: MockMetadata = {
          functionName: missing.name,
          filePath,
          generatedAt: new Date().toISOString(),
          isMock: true,
        };
        this.metadataProvider.markAsMock(missing.name, metadata);

        results.push(metadata);
      } catch (error) {
        errors.push({
          functionName: missing.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      generatedFunctions: results,
      ...(errors.length > 0 && { errors }),
    };
  }
}
