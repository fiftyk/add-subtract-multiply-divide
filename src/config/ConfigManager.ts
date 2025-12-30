import type { AppConfig, PartialAppConfig } from './types.js';
import { loadConfig } from './loader.js';

/**
 * CLI options that can affect configuration
 * These will be mapped to config overrides with highest priority
 */
export interface CLIOptions {
  /** Enable automatic function completion (from --auto-complete / --no-auto-complete) */
  autoComplete?: boolean;

  /** Maximum retries for function completion (from --max-retries) */
  maxRetries?: number;

  // Future extensibility for other CLI options
  [key: string]: unknown;
}

/**
 * Centralized configuration manager with singleton pattern
 *
 * Responsibilities:
 * - Initialize once at CLI startup with all configuration sources
 * - Merge configuration: CLI args > Env vars > .env file > Defaults
 * - Centralize validation and warnings
 * - Provide readonly access to business logic
 *
 * Usage:
 * 1. Call ConfigManager.initialize(cliOptions) once at CLI startup
 * 2. Call ConfigManager.get() in business logic to access config
 * 3. Call ConfigManager.reset() in tests to reset singleton state
 */
export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private config: AppConfig | null = null;

  private constructor() {}

  /**
   * Initialize the global configuration with CLI options
   * Must be called once at CLI startup before any get() calls
   *
   * @param cliOptions - CLI arguments that override environment/file config
   * @throws Error if called more than once
   */
  static initialize(cliOptions?: CLIOptions): void {
    if (ConfigManager.instance) {
      throw new Error('ConfigManager already initialized');
    }

    const instance = new ConfigManager();

    // Build override config from CLI options
    const overrides: PartialAppConfig = {};

    if (cliOptions?.autoComplete !== undefined || cliOptions?.maxRetries !== undefined) {
      overrides.functionCompletion = {};

      if (cliOptions.autoComplete !== undefined) {
        overrides.functionCompletion.enabled = cliOptions.autoComplete;
      }

      if (cliOptions.maxRetries !== undefined) {
        overrides.functionCompletion.maxRetries = cliOptions.maxRetries;
      }
    }

    // Load and validate config through existing loader
    // Priority: CLI options (overrides) > Environment variables > .env file > Defaults
    instance.config = loadConfig(overrides);

    // Centralized validation warnings
    instance.validateConfig(cliOptions);

    ConfigManager.instance = instance;
  }

  /**
   * Get the global configuration instance
   *
   * @returns The merged and validated configuration
   * @throws Error if initialize() was not called first
   */
  static get(): AppConfig {
    if (!ConfigManager.instance || !ConfigManager.instance.config) {
      throw new Error('ConfigManager not initialized. Call initialize() first.');
    }
    return ConfigManager.instance.config;
  }

  /**
   * Check if ConfigManager has been initialized
   * Useful for conditional initialization in tests
   */
  static isInitialized(): boolean {
    return ConfigManager.instance !== null && ConfigManager.instance.config !== null;
  }

  /**
   * Reset the singleton (useful for testing)
   * Allows tests to reinitialize with different configurations
   */
  static reset(): void {
    ConfigManager.instance = null;
  }

  /**
   * Centralized validation and warnings
   * All edge case detection and user feedback happens here
   */
  private validateConfig(cliOptions?: CLIOptions): void {
    // Warning: --max-retries without --auto-complete
    if (
      cliOptions?.maxRetries !== undefined &&
      cliOptions?.autoComplete !== true &&
      !this.config?.functionCompletion.enabled
    ) {
      console.warn(
        'Warning: --max-retries specified but function completion is disabled. ' +
        'Use --auto-complete to enable function completion.'
      );
    }

    // Future: Add more centralized validations here
    // - Warn if baseURL is custom but apiKey looks like a demo key
    // - Warn if maxTokens is unreasonably low/high
    // - etc.
  }
}
