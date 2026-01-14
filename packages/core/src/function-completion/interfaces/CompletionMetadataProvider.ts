import type { CompletionMetadata } from '../types.js';

/**
 * Interface for managing function completion metadata
 * Responsibility: Track which functions are auto-generated and their metadata
 */
export interface CompletionMetadataProvider {
  /**
   * Mark a function as auto-generated with metadata
   * @param functionName - Name of the function
   * @param metadata - Completion metadata
   */
  markAsMock(functionName: string, metadata: CompletionMetadata): void;

  /**
   * Check if a function is auto-generated
   * @param functionName - Name of the function
   * @returns True if the function is auto-generated
   */
  isMock(functionName: string): boolean;

  /**
   * Get metadata for an auto-generated function
   * @param functionName - Name of the function
   * @returns Completion metadata if found
   */
  getMetadata(functionName: string): CompletionMetadata | undefined;
}

export const CompletionMetadataProvider = Symbol('CompletionMetadataProvider');
