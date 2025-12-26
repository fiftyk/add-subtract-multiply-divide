import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicPlannerLLMClient } from '../AnthropicPlannerLLMClient.js';

// Mock the logger
vi.mock('../../logger/index.js', () => ({
  LoggerFactory: {
    create: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    createFromEnv: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('AnthropicPlannerLLMClient', () => {
  describe('generatePlan', () => {
    it('should generate plan successfully', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: 'plan-001',
              userRequest: '计算 3 + 5',
              steps: [
                {
                  stepId: 1,
                  functionName: 'add',
                  description: '将 3 和 5 相加',
                  parameters: {
                    a: { type: 'literal' as const, value: 3 },
                    b: { type: 'literal' as const, value: 5 },
                  },
                },
              ],
              createdAt: new Date().toISOString(),
              status: 'executable' as const,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      };

      const mockMessagesCreate = vi.fn().mockResolvedValue(mockResponse);

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
        baseURL: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      });

      // Spy on the internal client.messages.create
      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const prompt = '请为"计算 3 + 5"生成执行计划';
      const result = await client.generatePlan(prompt);

      expect(result).toBeDefined();
      expect(result).toContain('plan-001');
      expect(result).toContain('add');
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      // Restore
      client['client'].messages = originalMessages;
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text' as const,
            text: '',
          },
        ],
        usage: { input_tokens: 50, output_tokens: 10 },
      };

      const mockMessagesCreate = vi.fn().mockResolvedValue(mockResponse);

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const prompt = '请生成计划';
      const result = await client.generatePlan(prompt);

      expect(result).toBe('');

      client['client'].messages = originalMessages;
    });

    it('should throw error when response has no text content', async () => {
      const mockResponse = {
        content: [
          { type: 'image' as const },
          { type: 'tool_use' as const },
        ],
      };

      const mockMessagesCreate = vi.fn().mockResolvedValue(mockResponse);

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const prompt = '请生成计划';
      await expect(client.generatePlan(prompt)).rejects.toThrow('LLM 返回了非文本内容');

      client['client'].messages = originalMessages;
    });

    it('should use default model and maxTokens when not provided', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text' as const,
            text: '{"id":"test"}',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const mockMessagesCreate = vi.fn().mockResolvedValue(mockResponse);

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      await client.generatePlan('test prompt');

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'test prompt' }],
      });

      client['client'].messages = originalMessages;
    });

    it('should handle API errors', async () => {
      const mockMessagesCreate = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const prompt = '请生成计划';
      await expect(client.generatePlan(prompt)).rejects.toThrow('API rate limit exceeded');

      client['client'].messages = originalMessages;
    });

    it('should throw error on non-Error thrown', async () => {
      const mockMessagesCreate = vi.fn().mockRejectedValue('string error');

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const prompt = '请生成计划';
      await expect(client.generatePlan(prompt)).rejects.toThrow();

      client['client'].messages = originalMessages;
    });
  });

  describe('implements PlannerLLMClient', () => {
    it('should have generatePlan method', () => {
      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      expect(client).toHaveProperty('generatePlan');
      expect(typeof client.generatePlan).toBe('function');
    });

    it('should be able to generate plans', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text' as const,
            text: '{"id":"test"}',
          },
        ],
      };

      const mockMessagesCreate = vi.fn().mockResolvedValue(mockResponse);

      const client = new AnthropicPlannerLLMClient({
        apiKey: 'test-api-key',
      });

      const originalMessages = client['client'].messages;
      client['client'].messages = { create: mockMessagesCreate } as typeof originalMessages;

      const result = await client.generatePlan('test');
      expect(result).toBe('{"id":"test"}');

      client['client'].messages = originalMessages;
    });
  });
});
