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
 * Mock Code Generator Configuration
 */
export interface MockCodeGeneratorConfig {
  /** Command to invoke for code generation (e.g., 'claude-switcher', 'gemini') */
  command: string;
  /** Command arguments (e.g., 'MINMAX -- -p', '-p') */
  args: string;
}

/**
 * Planner Code Generator Configuration
 */
export interface PlannerGeneratorConfig {
  /** Command to invoke for plan generation (e.g., 'claude-switcher', 'gemini') */
  command: string;
  /** Command arguments (e.g., 'MINMAX -- -p', '-p') */
  args: string;
}

/**
 * LLM Configuration
 */
export interface LLMConfig {
  /** Model name to use */
  model: string;
  /** Maximum tokens for completion */
  maxTokens: number;
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
  mockCodeGenerator: MockCodeGeneratorConfig;
  plannerGenerator: PlannerGeneratorConfig;
  mcp: MCPConfig;
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
  mockCodeGenerator?: Partial<MockCodeGeneratorConfig>;
  plannerGenerator?: Partial<PlannerGeneratorConfig>;
  mcp?: Partial<MCPConfig>;
};

/**
 * MCP Server Configuration - Stdio Transport
 */
export interface MCPStdioServerConfig {
  /** Server name */
  name: string;
  /** Transport type */
  type: 'stdio';
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * MCP Server Configuration - HTTP Transport
 */
export interface MCPHttpServerConfig {
  /** Server name */
  name: string;
  /** Transport type */
  type: 'http';
  /** MCP Server URL */
  url: string;
  /** Access token for authentication */
  accessToken?: string;
}

/**
 * Union type for MCP server configurations
 */
export type MCPServerConfig = MCPStdioServerConfig | MCPHttpServerConfig;

/**
 * MCP Configuration
 */
export interface MCPConfig {
  /** Enable/disable MCP support */
  enabled: boolean;
  /** List of MCP servers */
  servers: MCPServerConfig[];
}
