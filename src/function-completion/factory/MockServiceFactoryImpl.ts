import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { MockServiceFactory } from './MockServiceFactory.js';
import type { CompletionOrchestrator } from '../interfaces/CompletionOrchestrator.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { LLMAdapter } from '../interfaces/LLMAdapter.js';
import { Storage } from '../../storage/index.js';
import { LLMFunctionCodeGeneratorImpl } from '../implementations/LLMFunctionCodeGenerator.js';
import { FileSystemFunctionFileWriterImpl } from '../implementations/FileSystemFunctionFileWriter.js';
import { DynamicFunctionLoaderImpl } from '../implementations/DynamicFunctionLoader.js';
import { InMemoryCompletionMetadataProviderImpl } from '../implementations/InMemoryCompletionMetadataProvider.js';
import { DynamicFunctionCodeValidatorImpl } from '../implementations/DynamicFunctionCodeValidator.js';
import { CompletionOrchestratorImpl } from '../implementations/CompletionOrchestrator.js';
import { LoggerFactory } from '../../logger/index.js';

@injectable()
export class MockServiceFactoryImpl implements MockServiceFactory {
  private llmAdapter: LLMAdapter;
  private storage: Storage;
  private functionProvider: FunctionProvider;

  constructor(
    @inject(LLMAdapter) llmAdapter: LLMAdapter,
    @inject(Storage) storage: Storage,
    @inject(FunctionProvider) functionProvider: FunctionProvider
  ) {
    this.llmAdapter = llmAdapter;
    this.storage = storage;
    this.functionProvider = functionProvider;
  }

  createOrchestrator(planId: string): CompletionOrchestrator {
    const logger = LoggerFactory.create();
    const mockDir = this.storage.getPlanMocksDir(planId);
    const importPath = '../../../../dist/src/registry/index.js';

    const codeGenerator = new LLMFunctionCodeGeneratorImpl(this.llmAdapter, importPath);
    const fileWriter = new FileSystemFunctionFileWriterImpl(mockDir);
    const functionLoader = new DynamicFunctionLoaderImpl();
    const metadataProvider = new InMemoryCompletionMetadataProviderImpl();
    const validator = new DynamicFunctionCodeValidatorImpl();

    return new CompletionOrchestratorImpl(
      planId,
      this.storage,
      codeGenerator,
      fileWriter,
      functionLoader,
      metadataProvider,
      this.functionProvider,
      validator,
      logger
    );
  }
}
