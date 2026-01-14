import type { CompletionMetadataProvider } from '../interfaces/CompletionMetadataProvider.js';
import type { CompletionMetadata } from '../types.js';

/**
 * In-memory storage for mock function metadata
 * Follows SRP: Only responsible for managing metadata
 */
export class InMemoryCompletionMetadataProviderImpl implements CompletionMetadataProvider {
  private metadata: Map<string, CompletionMetadata> = new Map();

  /**
   * Mark a function as mock with metadata
   */
  markAsMock(functionName: string, metadata: CompletionMetadata): void {
    this.metadata.set(functionName, metadata);
  }

  /**
   * Check if a function is a mock
   */
  isMock(functionName: string): boolean {
    return this.metadata.has(functionName);
  }

  /**
   * Get metadata for a mock function
   */
  getMetadata(functionName: string): CompletionMetadata | undefined {
    return this.metadata.get(functionName);
  }
}
