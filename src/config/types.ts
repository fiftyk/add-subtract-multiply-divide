/**
 * API Configuration
 */
export interface APIConfig {
  /** Anthropic API key */
  apiKey: string;
  /** API base URL (optional, for custom endpoints) */
  baseURL?: string;
}

/**
 * LLM Adapter Type
 */
export type LLMAdapterType = 'anthropic' | 'claude-code';

/**
 * LLM Configuration
 */
export interface LLMConfig {
  /** Model name to use */
  model: string;
  /** Maximum tokens for completion */
  maxTokens: number;
  /** LLM adapter type for mock code generation */
  adapter: LLMAdapterType;
}

/**
 * Executor Configuration
 */
export interface ExecutorConfig {
  /** Step execution timeout in milliseconds (0 = no limit) */
  stepTimeout: number;
}

/**
 * Storage Configuration
 */
export interface StorageConfig {
  /** Data directory path */
  dataDir: string;
}

/**
 * Mock Configuration
 */
export interface MockConfig {
  /** Output directory for generated mock functions */
  outputDir: string;

  /**
   * Enable/disable automatic mock generation
   * @default false - Breaking change from previous implicit "always on" behavior
   */
  autoGenerate: boolean;

  /**
   * Maximum iterations for mock generation cycle
   * Prevents infinite loops when LLM keeps generating incomplete plans
   * @default 3
   */
  maxIterations: number;
}

/**
 * Complete Application Configuration
 */
export interface AppConfig {
  api: APIConfig;
  llm: LLMConfig;
  executor: ExecutorConfig;
  storage: StorageConfig;
  mock: MockConfig;
}

/**
 * Partial configuration for overrides
 */
export type PartialAppConfig = {
  api?: Partial<APIConfig>;
  llm?: Partial<LLMConfig>;
  executor?: Partial<ExecutorConfig>;
  storage?: Partial<StorageConfig>;
  mock?: Partial<MockConfig>;
};
