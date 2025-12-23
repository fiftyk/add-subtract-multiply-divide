import type { MockMetadata } from '../types.js';

/**
 * Interface for managing mock function metadata
 * Responsibility: Track which functions are mocks and their metadata
 */
export interface IMockMetadataProvider {
  /**
   * Mark a function as mock with metadata
   * @param functionName - Name of the function
   * @param metadata - Mock metadata
   */
  markAsMock(functionName: string, metadata: MockMetadata): void;

  /**
   * Check if a function is a mock
   * @param functionName - Name of the function
   * @returns True if the function is a mock
   */
  isMock(functionName: string): boolean;

  /**
   * Get metadata for a mock function
   * @param functionName - Name of the function
   * @returns Mock metadata if found
   */
  getMetadata(functionName: string): MockMetadata | undefined;
}
