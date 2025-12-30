import type { AppConfig, PartialAppConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';

/**
 * Parse boolean string to boolean value
 * Accepts: "true", "1", "yes", "on" (case-insensitive) → true
 *          "false", "0", "no", "off" (case-insensitive) → false
 */
function parseBoolean(value: string | undefined): boolean {
  if (value === undefined) return false;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Load API configuration from environment variables
 * Priority: ANTHROPIC_API_KEY > ANTHROPIC_AUTH_TOKEN (Claude Code compatibility)
 */
function loadAPIConfig(): PartialAppConfig['api'] {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return undefined;

  return {
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
  };
}

/**
 * Load LLM configuration from environment variables
 */
function loadLLMConfig(): PartialAppConfig['llm'] {
  const model = process.env.LLM_MODEL;
  const maxTokensStr = process.env.LLM_MAX_TOKENS;

  if (!model && !maxTokensStr) return undefined;

  const llm: PartialAppConfig['llm'] = {};
  if (model) llm.model = model;
  if (maxTokensStr) llm.maxTokens = parseInt(maxTokensStr, 10);
  return llm;
}

/**
 * Load generator configuration (for function code generator or planner) from environment variables
 */
function loadGeneratorConfig(
  cmdKey: string,
  argsKey: string
): PartialAppConfig['functionCodeGenerator'] | PartialAppConfig['plannerGenerator'] {
  const cmd = process.env[cmdKey];
  const args = process.env[argsKey];

  if (!cmd && !args) return undefined;
  return { command: cmd || '', args: args || '' };
}

/**
 * Load executor configuration from environment variables
 */
function loadExecutorConfig(): PartialAppConfig['executor'] {
  const timeout = process.env.EXECUTOR_STEP_TIMEOUT;
  if (!timeout) return undefined;
  return { stepTimeout: parseInt(timeout, 10) };
}

/**
 * Load storage configuration from environment variables
 */
function loadStorageConfig(): PartialAppConfig['storage'] {
  const dataDir = process.env.STORAGE_DATA_DIR;
  if (!dataDir) return undefined;
  return { dataDir: path.resolve(dataDir) };
}

/**
 * Load function completion configuration from environment variables
 */
function loadFunctionCompletionConfig(): PartialAppConfig['functionCompletion'] {
  const outputDir = process.env.FUNCTION_COMPLETION_OUTPUT_DIR;
  const enabled = process.env.AUTO_COMPLETE_FUNCTIONS;
  const maxRetries = process.env.FUNCTION_COMPLETION_MAX_RETRIES;

  if (!outputDir && enabled === undefined && !maxRetries) return undefined;

  const functionCompletion: PartialAppConfig['functionCompletion'] = {};

  if (outputDir) functionCompletion.outputDir = path.resolve(outputDir);
  if (enabled !== undefined) functionCompletion.enabled = parseBoolean(enabled);
  if (maxRetries) {
    const parsed = parseInt(maxRetries, 10);
    if (!isNaN(parsed) && parsed > 0) {
      functionCompletion.maxRetries = parsed;
    } else {
      console.warn(
        `Warning: Invalid FUNCTION_COMPLETION_MAX_RETRIES value "${maxRetries}". Using default value.`
      );
    }
  }

  return functionCompletion;
}

/**
 * Load MCP configuration from environment variables
 * Supports stdio and http transport configurations
 */
function loadMCPConfig(): PartialAppConfig['mcp'] {
  const enabled = process.env.MCP_ENABLED;
  const stdioCommand = process.env.MCP_STDIO_COMMAND;
  const stdioArgs = process.env.MCP_STDIO_ARGS;
  const httpUrl = process.env.MCP_HTTP_URL;
  const httpToken = process.env.MCP_HTTP_ACCESS_TOKEN;

  // If no MCP env vars are set, return undefined to use defaults
  if (!enabled && !stdioCommand && !httpUrl) {
    return undefined;
  }

  const mcp: PartialAppConfig['mcp'] = {
    enabled: enabled ? parseBoolean(enabled) : true,
    servers: [],
  };

  // Add stdio server if configured
  if (stdioCommand) {
    const stdioArgsList = stdioArgs
      ? stdioArgs.split(',').map((arg) => arg.trim())
      : [];
    mcp.servers!.push({
      name: 'stdio-server',
      type: 'stdio',
      command: stdioCommand,
      args: stdioArgsList.length > 0 ? stdioArgsList : undefined,
    });
  }

  // Add http server if configured
  if (httpUrl) {
    mcp.servers!.push({
      name: 'http-server',
      type: 'http',
      url: httpUrl,
      ...(httpToken && { accessToken: httpToken }),
    });
  }

  return mcp;
}

/**
 * Load configuration from environment variables
 * Automatically loads .env file from project root
 */
function loadFromEnv(): PartialAppConfig {
  // Load .env file if it exists (skip in test to avoid pollution)
  if (process.env.NODE_ENV !== 'test') {
    dotenvConfig();
  }

  const config: PartialAppConfig = {};

  // Load each configuration section
  const apiConfig = loadAPIConfig();
  const llmConfig = loadLLMConfig();
  const executorConfig = loadExecutorConfig();
  const storageConfig = loadStorageConfig();
  const functionCompletionConfig = loadFunctionCompletionConfig();
  const functionCodeGeneratorConfig = loadGeneratorConfig('FUNCTION_GENERATOR_CMD', 'FUNCTION_GENERATOR_ARGS');
  const plannerGeneratorConfig = loadGeneratorConfig('PLANNER_GENERATOR_CMD', 'PLANNER_GENERATOR_ARGS');
  const mcpConfig = loadMCPConfig();

  // Assign to config object (only if defined)
  if (apiConfig) config.api = apiConfig;
  if (llmConfig) config.llm = llmConfig;
  if (executorConfig) config.executor = executorConfig;
  if (storageConfig) config.storage = storageConfig;
  if (functionCompletionConfig) config.functionCompletion = functionCompletionConfig;
  if (functionCodeGeneratorConfig) config.functionCodeGenerator = functionCodeGeneratorConfig;
  if (plannerGeneratorConfig) config.plannerGenerator = plannerGeneratorConfig;
  if (mcpConfig) config.mcp = mcpConfig;

  return config;
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(
  base: Omit<AppConfig, 'api'>,
  override?: PartialAppConfig
): Omit<AppConfig, 'api'> {
  if (!override) return base;

  return {
    llm: { ...base.llm, ...override.llm },
    executor: { ...base.executor, ...override.executor },
    storage: { ...base.storage, ...override.storage },
    functionCompletion: { ...base.functionCompletion, ...override.functionCompletion },
    functionCodeGenerator: {
      ...base.functionCodeGenerator,
      ...override.functionCodeGenerator,
    },
    plannerGenerator: {
      ...base.plannerGenerator,
      ...override.plannerGenerator,
    },
    mcp: {
      ...base.mcp,
      ...override.mcp,
    },
  };
}

/**
 * Validate API configuration
 */
function validateAPIConfig(api: PartialAppConfig['api']): void {
  if (!api?.apiKey) {
    throw new Error(
      'API key is required. Set ANTHROPIC_API_KEY environment variable or provide it in config.'
    );
  }
}

/**
 * Load and validate complete configuration
 *
 * Priority (highest to lowest):
 * 1. Provided overrides (CLI args)
 * 2. Environment variables
 * 3. Default values
 *
 * Note: CLI args must take highest priority to allow users to override
 * .env settings (e.g., --no-auto-mock should disable even if AUTO_GENERATE_MOCK=true)
 */
export function loadConfig(overrides?: PartialAppConfig): AppConfig {
  // Load from environment
  const envConfig = loadFromEnv();

  // Merge order: defaults <- env <- overrides
  // This ensures CLI args (overrides) have highest priority
  const baseConfig = mergeConfig(DEFAULT_CONFIG, envConfig);
  const finalBaseConfig = mergeConfig(baseConfig, overrides);

  // CRITICAL: Handle explicit CLI boolean overrides
  // When CLI explicitly sets a boolean (true/false), it must override env/default
  // This fixes the --no-auto-complete being overridden by AUTO_COMPLETE_FUNCTIONS=true
  if (overrides?.functionCompletion?.enabled !== undefined) {
    finalBaseConfig.functionCompletion.enabled = overrides.functionCompletion.enabled;
  }

  // Handle API config separately (required)
  const apiConfig = {
    ...envConfig.api,
    ...overrides?.api,
  };

  // Validate required API configuration
  validateAPIConfig(apiConfig);

  return {
    ...finalBaseConfig,
    api: apiConfig as AppConfig['api'],
  };
}

/**
 * Create config with explicit API key
 */
export function createConfig(
  apiKey: string,
  overrides?: Partial<Omit<PartialAppConfig, 'api'>> & { api?: { baseURL?: string } }
): AppConfig {
  return loadConfig({
    ...overrides,
    api: {
      apiKey,
      ...overrides?.api,
    },
  });
}
