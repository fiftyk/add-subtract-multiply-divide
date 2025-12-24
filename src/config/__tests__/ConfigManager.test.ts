import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../ConfigManager.js';
import { DEFAULT_CONFIG } from '../defaults.js';

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and ConfigManager before each test
    process.env = { ...originalEnv };
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
      expect(config.mock.autoGenerate).toBe(DEFAULT_CONFIG.mock.autoGenerate);
      expect(config.mock.maxIterations).toBe(DEFAULT_CONFIG.mock.maxIterations);
    });

    it('should throw error if called twice', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      ConfigManager.initialize();

      expect(() => ConfigManager.initialize()).toThrow('ConfigManager already initialized');
    });

    it('should merge CLI options with environment config', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_GENERATE_MOCK = 'false';

      ConfigManager.initialize({
        autoMock: true, // CLI overrides env
      });

      const config = ConfigManager.get();
      expect(config.mock.autoGenerate).toBe(true); // CLI wins
    });

    it('should apply CLI options with highest priority', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_GENERATE_MOCK = 'true';
      process.env.MOCK_MAX_ITERATIONS = '5';

      ConfigManager.initialize({
        autoMock: false,
        mockMaxIterations: 10,
      });

      const config = ConfigManager.get();
      expect(config.mock.autoGenerate).toBe(false); // CLI overrides env
      expect(config.mock.maxIterations).toBe(10); // CLI overrides env
    });

    it('should handle partial CLI options', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.MOCK_MAX_ITERATIONS = '7';

      ConfigManager.initialize({
        autoMock: true, // Only override autoMock
      });

      const config = ConfigManager.get();
      expect(config.mock.autoGenerate).toBe(true);
      expect(config.mock.maxIterations).toBe(7); // From env
    });

    it('should validate and warn when mockMaxIterations without autoMock', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        mockMaxIterations: 5,
        // autoMock not specified, defaults to false
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('--mock-max-iterations specified but mock generation is disabled')
      );

      warnSpy.mockRestore();
    });

    it('should not warn when mockMaxIterations with autoMock=true', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        autoMock: true,
        mockMaxIterations: 5,
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should not warn when mockMaxIterations with AUTO_GENERATE_MOCK=true in env', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.AUTO_GENERATE_MOCK = 'true';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ConfigManager.initialize({
        mockMaxIterations: 5,
        // autoMock not in CLI, but env has AUTO_GENERATE_MOCK=true
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
      process.env.AUTO_GENERATE_MOCK = 'true';

      ConfigManager.initialize({
        autoMock: false, // CLI overrides env
      });

      const config = ConfigManager.get();
      expect(config.mock.autoGenerate).toBe(false);
    });

    it('should use defaults when no CLI or env config provided', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      ConfigManager.initialize();

      const config = ConfigManager.get();
      expect(config.mock.autoGenerate).toBe(DEFAULT_CONFIG.mock.autoGenerate);
      expect(config.mock.maxIterations).toBe(DEFAULT_CONFIG.mock.maxIterations);
      expect(config.llm.model).toBe(DEFAULT_CONFIG.llm.model);
    });
  });

  describe('Integration with loadConfig()', () => {
    it('should properly delegate to loadConfig with overrides', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LLM_MODEL = 'claude-3-opus';

      ConfigManager.initialize({
        autoMock: true,
        mockMaxIterations: 7,
      });

      const config = ConfigManager.get();

      // From env
      expect(config.api.apiKey).toBe('test-key');
      expect(config.llm.model).toBe('claude-3-opus');

      // From CLI
      expect(config.mock.autoGenerate).toBe(true);
      expect(config.mock.maxIterations).toBe(7);

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
