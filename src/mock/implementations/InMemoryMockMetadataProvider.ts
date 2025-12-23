import type { IMockMetadataProvider } from '../interfaces/IMockMetadataProvider.js';
import type { MockMetadata } from '../types.js';

/**
 * In-memory storage for mock function metadata
 * Follows SRP: Only responsible for managing metadata
 */
export class InMemoryMockMetadataProvider implements IMockMetadataProvider {
  private metadata: Map<string, MockMetadata> = new Map();

  /**
   * Mark a function as mock with metadata
   */
  markAsMock(functionName: string, metadata: MockMetadata): void {
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
  getMetadata(functionName: string): MockMetadata | undefined {
    return this.metadata.get(functionName);
  }
}
