import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { MockServiceFactory } from './MockServiceFactory.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import { FunctionRegistry } from '../../registry/index.js';
import { LLMAdapter } from '../interfaces/LLMAdapter.js';
import { Storage } from '../../storage/index.js';
import { LLMMockCodeGenerator } from '../implementations/LLMMockCodeGenerator.js';
import { FileSystemMockFileWriter } from '../implementations/FileSystemMockFileWriter.js';
import { DynamicMockFunctionLoader } from '../implementations/DynamicMockFunctionLoader.js';
import { InMemoryMockMetadataProvider } from '../implementations/InMemoryMockMetadataProvider.js';
import { DynamicMockCodeValidator } from '../implementations/DynamicMockCodeValidator.js';
import { MockOrchestrator } from '../implementations/MockOrchestrator.js';
import { LoggerFactory } from '../../logger/index.js';

@injectable()
export class MockServiceFactoryImpl implements MockServiceFactory {
  private llmAdapter: LLMAdapter;
  private storage: Storage;
  private registry: FunctionRegistry;

  constructor(
    @inject(LLMAdapter) llmAdapter: LLMAdapter,
    @inject(Storage) storage: Storage,
    @inject(FunctionRegistry) registry: FunctionRegistry
  ) {
    this.llmAdapter = llmAdapter;
    this.storage = storage;
    this.registry = registry;
  }

  createOrchestrator(planId: string): IMockOrchestrator {
    const logger = LoggerFactory.create();
    const mockDir = this.storage.getPlanMocksDir(planId);
    const importPath = '../../../../dist/src/registry/index.js';

    const codeGenerator = new LLMMockCodeGenerator(this.llmAdapter, importPath);
    const fileWriter = new FileSystemMockFileWriter(mockDir);
    const functionLoader = new DynamicMockFunctionLoader();
    const metadataProvider = new InMemoryMockMetadataProvider();
    const validator = new DynamicMockCodeValidator();

    return new MockOrchestrator(
      planId,
      this.storage,
      codeGenerator,
      fileWriter,
      functionLoader,
      metadataProvider,
      this.registry,
      validator,
      logger
    );
  }
}
