import type { FunctionRegistry } from '../../registry/index.js';
import type { ILLMClient } from '../interfaces/ILLMClient.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { ILogger } from '../../logger/types.js';
import type { Storage } from '../../storage/index.js';
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
  planId: string; // NEW: Plan ID for storing mocks
  storage: Storage; // NEW: Storage instance for managing plan mocks
  apiKey?: string;
  baseURL?: string;
  outputDir: string; // 保留用于向后兼容，但优先使用 storage.getPlanMocksDir(planId)
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
      llmClient = new AnthropicLLMClient(
        config.apiKey,
        config.baseURL,
        config.logger
      );
    }

    // 2. 使用 Storage 获取正确的 mock 目录路径
    const mockDir = config.storage.getPlanMocksDir(config.planId);

    // 3. 计算从 mockDir 到 dist/src/registry/index.js 的相对路径
    // mockDir: .data/plans/{planId}/mocks/
    // target: dist/src/registry/index.js
    // 相对路径: ../../../../dist/src/registry/index.js
    const importPath = '../../../../dist/src/registry/index.js';

    // 4. Create all service implementations
    const codeGenerator = new LLMMockCodeGenerator(llmClient, importPath);
    const fileWriter = new FileSystemMockFileWriter(mockDir);
    const functionLoader = new DynamicMockFunctionLoader();
    const metadataProvider = new InMemoryMockMetadataProvider();

    // 5. Create validator if validation is enabled (default: true)
    const validator =
      config.enableValidation !== false
        ? new DynamicMockCodeValidator()
        : undefined;

    // 6. Wire everything together in the orchestrator
    return new MockOrchestrator(
      config.planId, // NEW: Pass plan ID
      config.storage, // NEW: Pass storage instance
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
