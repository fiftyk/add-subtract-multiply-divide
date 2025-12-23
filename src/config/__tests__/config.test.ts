import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, createConfig, DEFAULT_CONFIG } from '../index.js';

describe('Configuration System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to avoid test pollution
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should throw error if no API key is provided', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => loadConfig()).toThrow('API key is required');
    });

    it('should load API key from environment variable', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      const config = loadConfig();

      expect(config.api.apiKey).toBe('test-api-key');
    });

    it('should load base URL from environment variable', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.ANTHROPIC_BASE_URL = 'https://custom.api.com';
      const config = loadConfig();

      expect(config.api.baseURL).toBe('https://custom.api.com');
    });

    it('should load LLM config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.LLM_MODEL = 'claude-3-opus';
      process.env.LLM_MAX_TOKENS = '2048';
      const config = loadConfig();

      expect(config.llm.model).toBe('claude-3-opus');
      expect(config.llm.maxTokens).toBe(2048);
    });

    it('should load executor config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.EXECUTOR_STEP_TIMEOUT = '60000';
      const config = loadConfig();

      expect(config.executor.stepTimeout).toBe(60000);
    });

    it('should load storage config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.STORAGE_DATA_DIR = './custom-data';
      const config = loadConfig();

      expect(config.storage.dataDir).toContain('custom-data');
    });

    it('should load mock config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.MOCK_OUTPUT_DIR = './custom-mocks';
      const config = loadConfig();

      expect(config.mock.outputDir).toContain('custom-mocks');
    });

    it('should use default values when env vars are not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      const config = loadConfig();

      expect(config.llm.model).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.llm.maxTokens).toBe(DEFAULT_CONFIG.llm.maxTokens);
      expect(config.executor.stepTimeout).toBe(DEFAULT_CONFIG.executor.stepTimeout);
    });

    it('should prioritize overrides over environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      process.env.LLM_MODEL = 'env-model';

      const config = loadConfig({
        api: { apiKey: 'override-key' },
        llm: { model: 'override-model' },
      });

      expect(config.api.apiKey).toBe('override-key');
      expect(config.llm.model).toBe('override-model');
    });

    it('should merge partial overrides with defaults', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const config = loadConfig({
        llm: { model: 'custom-model' },
        // maxTokens not provided, should use default
      });

      expect(config.llm.model).toBe('custom-model');
      expect(config.llm.maxTokens).toBe(DEFAULT_CONFIG.llm.maxTokens);
    });
  });

  describe('createConfig', () => {
    it('should create config with explicit API key', () => {
      const config = createConfig('explicit-api-key');

      expect(config.api.apiKey).toBe('explicit-api-key');
    });

    it('should accept overrides', () => {
      const config = createConfig('api-key', {
        llm: { model: 'custom-model' },
        executor: { stepTimeout: 45000 },
      });

      expect(config.api.apiKey).toBe('api-key');
      expect(config.llm.model).toBe('custom-model');
      expect(config.executor.stepTimeout).toBe(45000);
    });

    it('should accept baseURL override', () => {
      const config = createConfig('api-key', {
        api: { baseURL: 'https://custom.com' },
      });

      expect(config.api.apiKey).toBe('api-key');
      expect(config.api.baseURL).toBe('https://custom.com');
    });

    it('should ignore environment API key when explicit key provided', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';

      const config = createConfig('explicit-key');

      expect(config.api.apiKey).toBe('explicit-key');
    });
  });

  describe('Configuration Priority', () => {
    it('should apply priority: overrides > env > defaults', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.EXECUTOR_STEP_TIMEOUT = '20000';

      const config = loadConfig({
        executor: { stepTimeout: 50000 },
        // llm not provided, should use default
      });

      expect(config.executor.stepTimeout).toBe(50000); // override
      expect(config.llm.model).toBe(DEFAULT_CONFIG.llm.model); // default
    });
  });
});
