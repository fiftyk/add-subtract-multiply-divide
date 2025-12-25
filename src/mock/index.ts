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
export type { IMockCodeGenerator } from './interfaces/IMockCodeGenerator.js';
export type { IMockFileWriter } from './interfaces/IMockFileWriter.js';
export type { IMockFunctionLoader } from './interfaces/IMockFunctionLoader.js';
export type { IMockMetadataProvider } from './interfaces/IMockMetadataProvider.js';
export type { IMockOrchestrator } from './interfaces/IMockOrchestrator.js';
export { LLMAdapter } from './interfaces/LLMAdapter.js';
export type {
  IMockCodeValidator,
  ValidationResult,
  TestResult,
} from './interfaces/IMockCodeValidator.js';

// Types
export type {
  MockFunctionSpec,
  MockMetadata,
  MockGenerationResult,
  PlanMetadata,
  MockGenerationConfig,
} from './types.js';

// Implementations (for advanced usage)
export { LLMMockCodeGenerator } from './implementations/LLMMockCodeGenerator.js';
export { FileSystemMockFileWriter } from './implementations/FileSystemMockFileWriter.js';
export { DynamicMockFunctionLoader } from './implementations/DynamicMockFunctionLoader.js';
export { InMemoryMockMetadataProvider } from './implementations/InMemoryMockMetadataProvider.js';
export { DynamicMockCodeValidator } from './implementations/DynamicMockCodeValidator.js';
export { MockOrchestrator } from './implementations/MockOrchestrator.js';

// Adapters
export { AnthropicLLMAdapter } from './adapters/AnthropicLLMAdapter.js';
export { ClaudeCodeLLMAdapter } from './adapters/ClaudeCodeLLMAdapter.js';
