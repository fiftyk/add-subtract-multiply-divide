import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, createConfig, DEFAULT_CONFIG } from '../index.js';

describe('Configuration System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to avoid test pollution
    process.env = { ...originalEnv };
    // Remove LLM-related env vars that might interfere with tests
    delete process.env.LLM_MODEL;
    delete process.env.LLM_MAX_TOKENS;
    delete process.env.ANTHROPIC_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should throw error if no API key is provided', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_AUTH_TOKEN;
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
      process.env.FUNCTION_COMPLETION_OUTPUT_DIR = './custom-mocks';
      const config = loadConfig();

      expect(config.functionCompletion.outputDir).toContain('custom-mocks');
    });

    it('should load mock autoGenerate from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.AUTO_COMPLETE_FUNCTIONS = 'true';
      const config = loadConfig();

      expect(config.functionCompletion.enabled).toBe(true);
    });

    it('should parse AUTO_COMPLETE_FUNCTIONS flexibly', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';

      const testCases = [
        { value: 'true', expected: true },
        { value: 'TRUE', expected: true },
        { value: '1', expected: true },
        { value: 'yes', expected: true },
        { value: 'on', expected: true },
        { value: 'false', expected: false },
        { value: 'FALSE', expected: false },
        { value: '0', expected: false },
        { value: 'no', expected: false },
        { value: 'invalid', expected: false },
      ];

      testCases.forEach(({ value, expected }) => {
        process.env.AUTO_COMPLETE_FUNCTIONS = value;
        const config = loadConfig();
        expect(config.functionCompletion.enabled).toBe(expected);
      });
    });

    it('should load mock maxIterations from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.FUNCTION_COMPLETION_MAX_RETRIES = '5';
      const config = loadConfig();

      expect(config.functionCompletion.maxRetries).toBe(5);
    });

    it('should handle invalid FUNCTION_COMPLETION_MAX_RETRIES gracefully', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.FUNCTION_COMPLETION_MAX_RETRIES = 'invalid';
      const config = loadConfig();

      // Should use default value (3) when invalid
      expect(config.functionCompletion.maxRetries).toBe(DEFAULT_CONFIG.functionCompletion.maxRetries);
    });

    it('should handle negative FUNCTION_COMPLETION_MAX_RETRIES gracefully', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.FUNCTION_COMPLETION_MAX_RETRIES = '-1';
      const config = loadConfig();

      // Should use default value when negative
      expect(config.functionCompletion.maxRetries).toBe(DEFAULT_CONFIG.functionCompletion.maxRetries);
    });

    it('should use default mock config when env vars are not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      const config = loadConfig();

      expect(config.functionCompletion.enabled).toBe(DEFAULT_CONFIG.functionCompletion.enabled);
      expect(config.functionCompletion.maxRetries).toBe(DEFAULT_CONFIG.functionCompletion.maxRetries);
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

  describe('API Key Priority', () => {
    it('should use ANTHROPIC_API_KEY when both are set', () => {
      process.env.ANTHROPIC_API_KEY = 'primary-key';
      process.env.ANTHROPIC_AUTH_TOKEN = 'secondary-key';
      const config = loadConfig();

      expect(config.api.apiKey).toBe('primary-key');
    });

    it('should fallback to ANTHROPIC_AUTH_TOKEN when ANTHROPIC_API_KEY not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_AUTH_TOKEN = 'auth-token-key';
      const config = loadConfig();

      expect(config.api.apiKey).toBe('auth-token-key');
    });
  });

  describe('Mock Code Generator Configuration', () => {
    it('should load mock code generator config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.FUNCTION_GENERATOR_CMD = 'claude-switcher';
      process.env.FUNCTION_GENERATOR_ARGS = 'MINMAX -- -p';
      const config = loadConfig();

      expect(config.functionCodeGenerator.command).toBe('claude-switcher');
      expect(config.functionCodeGenerator.args).toBe('MINMAX -- -p');
    });

    it('should use empty strings when only command is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.FUNCTION_GENERATOR_CMD = 'claude-switcher';
      delete process.env.FUNCTION_GENERATOR_ARGS;
      const config = loadConfig();

      expect(config.functionCodeGenerator.command).toBe('claude-switcher');
      expect(config.functionCodeGenerator.args).toBe('');
    });

    it('should use empty strings when only args is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.FUNCTION_GENERATOR_CMD;
      process.env.FUNCTION_GENERATOR_ARGS = '-p';
      const config = loadConfig();

      expect(config.functionCodeGenerator.command).toBe('');
      expect(config.functionCodeGenerator.args).toBe('-p');
    });
  });

  describe('Planner Generator Configuration', () => {
    it('should load planner generator config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.PLANNER_GENERATOR_CMD = 'gemini';
      process.env.PLANNER_GENERATOR_ARGS = '--plan';
      const config = loadConfig();

      expect(config.plannerGenerator.command).toBe('gemini');
      expect(config.plannerGenerator.args).toBe('--plan');
    });

    it('should use empty strings when only PLANNER_GENERATOR_CMD is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.PLANNER_GENERATOR_CMD = 'ollama';
      delete process.env.PLANNER_GENERATOR_ARGS;
      const config = loadConfig();

      expect(config.plannerGenerator.command).toBe('ollama');
      expect(config.plannerGenerator.args).toBe('');
    });
  });

  describe('mergeConfig', () => {
    it('should merge plannerGenerator configs', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.PLANNER_GENERATOR_CMD = 'env-cmd';

      const config = loadConfig({
        plannerGenerator: { command: 'override-cmd', args: '-p' },
      });

      expect(config.plannerGenerator.command).toBe('override-cmd');
      expect(config.plannerGenerator.args).toBe('-p');
    });

    it('should merge functionCodeGenerator configs', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.FUNCTION_GENERATOR_CMD = 'env-cmd';

      const config = loadConfig({
        functionCodeGenerator: { command: 'override-cmd', args: '--gen' },
      });

      expect(config.functionCodeGenerator.command).toBe('override-cmd');
      expect(config.functionCodeGenerator.args).toBe('--gen');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LLM_MODEL = '';
      process.env.LLM_MAX_TOKENS = '';

      const config = loadConfig();

      // 空字符串会被忽略，使用默认值
      expect(config.llm.model).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.llm.maxTokens).toBe(DEFAULT_CONFIG.llm.maxTokens);
    });

    it('should load with valid model name', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LLM_MODEL = 'custom-model';
      delete process.env.LLM_MAX_TOKENS;

      const config = loadConfig();

      expect(config.llm.model).toBe('custom-model');
      // maxTokens not provided, should use default
      expect(config.llm.maxTokens).toBe(DEFAULT_CONFIG.llm.maxTokens);
    });
  });
});
