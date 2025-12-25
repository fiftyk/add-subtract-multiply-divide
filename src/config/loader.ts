import type { AppConfig, PartialAppConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';

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

  // API Configuration
  // Priority: ANTHROPIC_API_KEY > ANTHROPIC_AUTH_TOKEN (Claude Code compatibility)
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (apiKey) {
    config.api = {
      apiKey,
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
  if (
    process.env.MOCK_OUTPUT_DIR ||
    process.env.AUTO_GENERATE_MOCK !== undefined ||
    process.env.MOCK_MAX_ITERATIONS !== undefined
  ) {
    config.mock = {};

    if (process.env.MOCK_OUTPUT_DIR) {
      config.mock.outputDir = path.resolve(process.env.MOCK_OUTPUT_DIR);
    }

    // AUTO_GENERATE_MOCK: 支持多种布尔格式
    // Accepts: "true", "1", "yes", "on" (case-insensitive) → true
    //          "false", "0", "no", "off" (case-insensitive) → false
    if (process.env.AUTO_GENERATE_MOCK !== undefined) {
      const value = process.env.AUTO_GENERATE_MOCK.toLowerCase();
      config.mock.autoGenerate = ['true', '1', 'yes', 'on'].includes(value);
    }

    if (process.env.MOCK_MAX_ITERATIONS !== undefined) {
      const parsed = parseInt(process.env.MOCK_MAX_ITERATIONS, 10);
      if (!isNaN(parsed) && parsed > 0) {
        config.mock.maxIterations = parsed;
      } else {
        // Log warning but don't throw - graceful degradation
        console.warn(
          `Warning: Invalid MOCK_MAX_ITERATIONS value "${process.env.MOCK_MAX_ITERATIONS}". ` +
          `Using default value.`
        );
      }
    }
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
  // This fixes the --no-auto-mock being overridden by AUTO_GENERATE_MOCK=true
  if (overrides?.mock?.autoGenerate !== undefined) {
    finalBaseConfig.mock.autoGenerate = overrides.mock.autoGenerate;
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
