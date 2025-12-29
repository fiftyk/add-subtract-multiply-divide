/**
 * Return field reference - describes a field that the plan references from a function's return value
 */
export interface ReturnFieldRef {
  path: string;  // 如 "inventor" 或 "patents.0.patentNumber"
  description: string;
}

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
  /** 计划中引用的返回值字段，用于生成匹配的 mock 数据 */
  returnFields?: ReturnFieldRef[];
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
  /** Generated function definitions for signature matching */
  generatedDefinitions?: Array<{
    name: string;
    parameters: Array<{
      name: string;
      type: string;
      description: string;
    }>;
    returns: {
      type: string;
      description: string;
    };
  }>;
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
