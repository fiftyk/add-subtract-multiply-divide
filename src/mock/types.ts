/**
 * Mock function specification used for code generation
 */
export interface MockFunctionSpec {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns: {
    type: string;
    description: string;
  };
}

/**
 * Metadata for a generated mock function
 */
export interface MockMetadata {
  functionName: string;
  filePath: string;
  generatedAt: string;
  isMock: true;
}

/**
 * Result of mock generation operation
 */
export interface MockGenerationResult {
  success: boolean;
  generatedFunctions: MockMetadata[];
  errors?: Array<{
    functionName: string;
    error: string;
  }>;
}

/**
 * Extended plan metadata to track mock usage
 */
export interface PlanMetadata {
  usesMocks?: boolean;
  mockFunctions?: string[];
}

/**
 * Configuration for mock generation behavior
 * Separates configuration from orchestration logic (SRP)
 */
export interface MockGenerationConfig {
  /** Maximum iterations for regenerating plan with new mocks */
  maxIterations: number;
}
