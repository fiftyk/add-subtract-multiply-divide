import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../ConfigManager.js';
import { DEFAULT_CONFIG } from '../defaults.js';

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and ConfigManager before each test
    process.env = { ...originalEnv };
    // Remove LLM-related env vars that might interfere with tests
    delete process.env.LLM_MODEL;
    delete process.env.LLM_MAX_TOKENS;
    delete process.env.ANTHROPIC_BASE_URL;
    ConfigManager.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
    ConfigManager.reset();
  });

  describe('initialize()', () => {
    it('should initialize with default config when no options provided', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      const config = ConfigManager.get();
      expect(config.api.apiKey).toBe('test-key');
      expect(config.functionCompletion.enabled).toBe(DEFAULT_CONFIG.functionCompletion.enabled);
      expect(config.functionCompletion.maxRetries).toBe(DEFAULT_CONFIG.functionCompletion.maxRetries);
    });

    it('should throw error if called twice', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      expect(() => ConfigManager.initialize()).toThrow('ConfigManager already initialized');
    });

    it('should merge CLI options with environment config', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_COMPLETE_FUNCTIONS = 'false';

      ConfigManager.initialize({
        autoComplete: true, // CLI overrides env
      });

      const config = ConfigManager.get();
      expect(config.functionCompletion.enabled).toBe(true); // CLI wins
    });

    it('should apply CLI options with highest priority', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_COMPLETE_FUNCTIONS = 'true';
      process.env.FUNCTION_COMPLETION_MAX_RETRIES = '5';

      ConfigManager.initialize({
        autoComplete: false,
        maxRetries: 10,
      });

      const config = ConfigManager.get();
      expect(config.functionCompletion.enabled).toBe(false); // CLI overrides env
      expect(config.functionCompletion.maxRetries).toBe(10); // CLI overrides env
    });

    it('should handle partial CLI options', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.FUNCTION_COMPLETION_MAX_RETRIES = '7';

      ConfigManager.initialize({
        autoComplete: true, // Only override autoComplete
      });

      const config = ConfigManager.get();
      expect(config.functionCompletion.enabled).toBe(true);
      expect(config.functionCompletion.maxRetries).toBe(7); // From env
    });

    it('should validate and warn when maxRetries without autoComplete', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        maxRetries: 5,
        // autoComplete not specified, defaults to false
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('--max-retries specified but function completion is disabled')
      );

      warnSpy.mockRestore();
    });

    it('should not warn when maxRetries with autoComplete=true', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        autoComplete: true,
        maxRetries: 5,
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should not warn when maxRetries with AUTO_COMPLETE_FUNCTIONS=true in env', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_COMPLETE_FUNCTIONS = 'true';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        maxRetries: 5,
        // autoComplete not in CLI, but env has AUTO_COMPLETE_FUNCTIONS=true
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('get()', () => {
    it('should throw error if not initialized', () => {
      expect(() => ConfigManager.get()).toThrow('ConfigManager not initialized');
    });

    it('should return initialized config', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      const config = ConfigManager.get();
      expect(config).toBeDefined();
      expect(config.api.apiKey).toBe('test-key');
    });

    it('should return same instance on multiple calls', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      const config1 = ConfigManager.get();
      const config2 = ConfigManager.get();

      expect(config1).toBe(config2); // Same object reference
    });
  });

  describe('isInitialized()', () => {
    it('should return false before initialization', () => {
      expect(ConfigManager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      expect(ConfigManager.isInitialized()).toBe(true);
    });

    it('should return false after reset', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();
      ConfigManager.reset();

      expect(ConfigManager.isInitialized()).toBe(false);
    });
  });

  describe('reset()', () => {
    it('should allow re-initialization after reset', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-1';
      ConfigManager.initialize();

      let config = ConfigManager.get();
      expect(config.api.apiKey).toBe('test-key-1');

      ConfigManager.reset();

      process.env.ANTHROPIC_API_KEY = 'test-key-2';
      ConfigManager.initialize();

      config = ConfigManager.get();
      expect(config.api.apiKey).toBe('test-key-2');
    });

    it('should reset to uninitialized state', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();
      ConfigManager.reset();

      expect(() => ConfigManager.get()).toThrow('ConfigManager not initialized');
    });
  });

  describe('Configuration Priority', () => {
    it('should follow priority: CLI > Env > Defaults', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_COMPLETE_FUNCTIONS = 'true';

      ConfigManager.initialize({
        autoComplete: false, // CLI overrides env
      });

      const config = ConfigManager.get();
      expect(config.functionCompletion.enabled).toBe(false);
    });

    it('should use defaults when no CLI or env config provided', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      ConfigManager.initialize();

      const config = ConfigManager.get();
      expect(config.functionCompletion.enabled).toBe(DEFAULT_CONFIG.functionCompletion.enabled);
      expect(config.functionCompletion.maxRetries).toBe(DEFAULT_CONFIG.functionCompletion.maxRetries);
      expect(config.llm.model).toBe(DEFAULT_CONFIG.llm.model);
    });
  });

  describe('Integration with loadConfig()', () => {
    it('should properly delegate to loadConfig with overrides', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LLM_MODEL = 'claude-3-opus';

      ConfigManager.initialize({
        autoComplete: true,
        maxRetries: 7,
      });

      const config = ConfigManager.get();

      // From env
      expect(config.api.apiKey).toBe('test-key');
      expect(config.llm.model).toBe('claude-3-opus');

      // From CLI
      expect(config.functionCompletion.enabled).toBe(true);
      expect(config.functionCompletion.maxRetries).toBe(7);

      // From defaults
      expect(config.llm.maxTokens).toBe(DEFAULT_CONFIG.llm.maxTokens);
    });

    it('should throw if API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_AUTH_TOKEN;

      expect(() => ConfigManager.initialize()).toThrow('API key is required');
    });
  });
});
