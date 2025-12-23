import type { AppConfig, PartialAppConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';
import * as path from 'path';

/**
 * Load configuration from environment variables
 */
function loadFromEnv(): PartialAppConfig {
  const config: PartialAppConfig = {};

  // API Configuration
  if (process.env.ANTHROPIC_API_KEY) {
    config.api = {
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }
  if (process.env.ANTHROPIC_BASE_URL) {
    config.api = {
      ...config.api,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    };
  }

  // LLM Configuration
  if (process.env.LLM_MODEL) {
    config.llm = { model: process.env.LLM_MODEL };
  }
  if (process.env.LLM_MAX_TOKENS) {
    config.llm = {
      ...config.llm,
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10),
    };
  }

  // Executor Configuration
  if (process.env.EXECUTOR_STEP_TIMEOUT) {
    config.executor = {
      stepTimeout: parseInt(process.env.EXECUTOR_STEP_TIMEOUT, 10),
    };
  }

  // Storage Configuration
  if (process.env.STORAGE_DATA_DIR) {
    config.storage = {
      dataDir: path.resolve(process.env.STORAGE_DATA_DIR),
    };
  }

  // Mock Configuration
  if (process.env.MOCK_OUTPUT_DIR) {
    config.mock = {
      outputDir: path.resolve(process.env.MOCK_OUTPUT_DIR),
    };
  }

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
    mock: { ...base.mock, ...override.mock },
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
 * 1. Provided overrides
 * 2. Environment variables
 * 3. Default values
 */
export function loadConfig(overrides?: PartialAppConfig): AppConfig {
  // Load from environment
  const envConfig = loadFromEnv();

  // Merge: defaults <- env <- overrides
  const baseConfig = mergeConfig(DEFAULT_CONFIG, envConfig);
  const finalBaseConfig = mergeConfig(baseConfig, overrides);

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
