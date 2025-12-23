import type { FunctionRegistry } from '../../registry/index.js';
import type { ILLMClient } from '../interfaces/ILLMClient.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { ILogger } from '../../logger/types.js';
import { LLMMockCodeGenerator } from '../implementations/LLMMockCodeGenerator.js';
import { FileSystemMockFileWriter } from '../implementations/FileSystemMockFileWriter.js';
import { DynamicMockFunctionLoader } from '../implementations/DynamicMockFunctionLoader.js';
import { InMemoryMockMetadataProvider } from '../implementations/InMemoryMockMetadataProvider.js';
import { DynamicMockCodeValidator } from '../implementations/DynamicMockCodeValidator.js';
import { MockOrchestrator } from '../implementations/MockOrchestrator.js';
import { AnthropicLLMClient } from '../adapters/AnthropicLLMClient.js';

/**
 * Factory configuration for mock services
 */
export interface MockServiceFactoryConfig {
  apiKey?: string;
  baseURL?: string;
  outputDir: string;
  registry: FunctionRegistry;
  logger: ILogger; // Required: logger for logging mock generation process
  llmClient?: ILLMClient; // Optional: allow custom LLM client
  enableValidation?: boolean; // Optional: enable code validation (default: true)
}

/**
 * Factory for creating mock generation services
 * Follows Factory Pattern: Encapsulates dependency creation and wiring
 * Follows DIP: Wires dependencies through constructor injection
 */
export class MockServiceFactory {
  /**
   * Create a fully configured MockOrchestrator
   */
  static create(config: MockServiceFactoryConfig): IMockOrchestrator {
    // 1. Create or use provided LLM client
    let llmClient: ILLMClient;
    if (config.llmClient) {
      llmClient = config.llmClient;
    } else {
      if (!config.apiKey) {
        throw new Error(
          'Either apiKey or llmClient must be provided to MockServiceFactory'
        );
      }
      llmClient = new AnthropicLLMClient(config.apiKey, config.baseURL);
    }

    // 2. Create all service implementations
    const codeGenerator = new LLMMockCodeGenerator(llmClient);
    const fileWriter = new FileSystemMockFileWriter(config.outputDir);
    const functionLoader = new DynamicMockFunctionLoader();
    const metadataProvider = new InMemoryMockMetadataProvider();

    // 3. Create validator if validation is enabled (default: true)
    const validator = config.enableValidation !== false
      ? new DynamicMockCodeValidator()
      : undefined;

    // 4. Wire everything together in the orchestrator
    return new MockOrchestrator(
      codeGenerator,
      fileWriter,
      functionLoader,
      metadataProvider,
      config.registry,
      validator,
      config.logger
    );
  }
}
