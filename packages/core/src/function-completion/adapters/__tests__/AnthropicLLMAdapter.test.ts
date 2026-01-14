import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LLMAdapter } from '../../interfaces/LLMAdapter.js';

// Create mock functions before any mocking
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

// Mock logger using getter pattern to avoid hoisting issues
vi.doMock('../../../logger/index.js', () => ({
  LoggerFactory: {
    create: vi.fn().mockReturnValue({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    }),
    createFromEnv: vi.fn().mockReturnValue({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    }),
  },
}));

// Mock Anthropic SDK
const mockMessagesCreate = vi.fn();
vi.doMock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockMessagesCreate,
    };
  },
}));

// Import after mocks
const { AnthropicLLMAdapter } = await import('../AnthropicLLMAdapter.js');

describe('AnthropicLLMAdapter', () => {
  let adapter: LLMAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDebug.mockClear();
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockMessagesCreate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with API key', () => {
      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect(adapter).toBeInstanceOf(AnthropicLLMAdapter);
    });

    it('should accept optional baseURL', () => {
      adapter = new AnthropicLLMAdapter('test-key', 'https://custom.api.com', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect(adapter).toBeInstanceOf(AnthropicLLMAdapter);
    });
  });

  describe('generateCode', () => {
    it('should return generated code from LLM response', async () => {
      const expectedCode = 'export const test = () => "hello";';

      mockMessagesCreate.mockResolvedValue({
        content: [
          { type: 'text', text: expectedCode },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const result = await adapter.generateCode('Generate a test function');

      expect(result).toBe(expectedCode);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: 'Generate a test function' }],
      });
    });

    it('should throw error when LLM returns non-text content', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          { type: 'image', data: '...' },
          { type: 'tool_use', id: 'tool-1' },
        ],
      });

      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      await expect(adapter.generateCode('Test prompt')).rejects.toThrow(
        'LLM returned non-text content'
      );
    });

    it('should throw error when no text content in response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [],
      });

      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      await expect(adapter.generateCode('Test prompt')).rejects.toThrow(
        'LLM returned non-text content'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      await expect(adapter.generateCode('Test prompt')).rejects.toThrow(
        'API rate limit exceeded'
      );
    });

    it('should handle long prompts', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response' }],
      });

      adapter = new AnthropicLLMAdapter('test-api-key', undefined, {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const longPrompt = 'a'.repeat(600);
      await adapter.generateCode(longPrompt);

      expect(mockMessagesCreate).toHaveBeenCalled();
    });
  });
});
