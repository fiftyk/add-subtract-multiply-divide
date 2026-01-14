/**
 * Mock Function Generation Module
 *
 * This module provides automatic mock function generation for missing functions
 * during plan execution. It follows SOLID principles with clear separation of concerns.
 */

// Main decorator for adding mock support to Planner
export { PlannerWithMockSupport } from './decorators/PlannerWithMockSupport.js';

// Factory for creating mock services
export { MockServiceFactory } from './factory/MockServiceFactory.js';
export { MockServiceFactoryImpl } from './factory/MockServiceFactoryImpl.js';

// Core interfaces (for custom implementations)
export type { FunctionCodeGenerator } from './interfaces/FunctionCodeGenerator.js';
export type { FunctionFileWriter } from './interfaces/FunctionFileWriter.js';
export type { FunctionLoader } from './interfaces/FunctionLoader.js';
export type { CompletionMetadataProvider } from './interfaces/CompletionMetadataProvider.js';
export type { CompletionOrchestrator } from './interfaces/CompletionOrchestrator.js';
export { LLMAdapter } from './interfaces/LLMAdapter.js';
export type {
  FunctionCodeValidator,
  ValidationResult,
  TestResult,
} from './interfaces/FunctionCodeValidator.js';

// Types
export type {
  FunctionCompletionSpec,
  CompletionMetadata,
  FunctionGenerationResult,
  PlanMetadata,
  FunctionCompletionConfig,
} from './types.js';

// Implementations (for advanced usage)
export { LLMFunctionCodeGeneratorImpl } from './implementations/LLMFunctionCodeGenerator.js';
export { FileSystemFunctionFileWriterImpl } from './implementations/FileSystemFunctionFileWriter.js';
export { DynamicFunctionLoaderImpl } from './implementations/DynamicFunctionLoader.js';
export { InMemoryCompletionMetadataProviderImpl } from './implementations/InMemoryCompletionMetadataProvider.js';
export { DynamicFunctionCodeValidatorImpl } from './implementations/DynamicFunctionCodeValidator.js';
export { CompletionOrchestratorImpl } from './implementations/CompletionOrchestrator.js';

// Adapters
export { AnthropicLLMAdapter } from './adapters/AnthropicLLMAdapter.js';
export { CLILLMAdapter } from './adapters/CLILLMAdapter.js';
