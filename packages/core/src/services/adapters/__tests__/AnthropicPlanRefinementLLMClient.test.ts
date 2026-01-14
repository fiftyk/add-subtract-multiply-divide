import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { PlanRefinementRequest, PlanRefinementResponse } from '../../types.js';
import type { ExecutionPlan } from '../../../planner/types.js';
import type { FunctionMetadata } from '../../../function-provider/types.js';

// Create mock messages.create function
const mockMessagesCreate = vi.fn();

// Mock Anthropic SDK with getter pattern
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

// Import after mocks
const { AnthropicPlanRefinementLLMClient } = await import('../AnthropicPlanRefinementLLMClient.js');

describe('AnthropicPlanRefinementLLMClient', () => {
  let client: AnthropicPlanRefinementLLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesCreate.mockClear();
    client = new AnthropicPlanRefinementLLMClient({
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      expect(client).toBeInstanceOf(AnthropicPlanRefinementLLMClient);
    });

    it('should accept optional baseURL', () => {
      const clientWithBaseURL = new AnthropicPlanRefinementLLMClient({
        apiKey: 'test-key',
        baseURL: 'https://custom.api.com',
      });
      expect(clientWithBaseURL).toBeInstanceOf(AnthropicPlanRefinementLLMClient);
    });

    it('should accept custom model', () => {
      const clientWithModel = new AnthropicPlanRefinementLLMClient({
        apiKey: 'test-key',
        model: 'claude-haiku-3-20250506',
      });
      expect(clientWithModel).toBeInstanceOf(AnthropicPlanRefinementLLMClient);
    });

    it('should accept custom maxTokens', () => {
      const clientWithTokens = new AnthropicPlanRefinementLLMClient({
        apiKey: 'test-key',
        maxTokens: 8192,
      });
      expect(clientWithTokens).toBeInstanceOf(AnthropicPlanRefinementLLMClient);
    });
  });

  describe('refinePlan', () => {
    it('should return refined plan from successful API response', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc',
        userRequest: 'Calculate 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: { a: 1, b: 2 },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const mockResponse: PlanRefinementResponse = {
        refinedPlan: mockPlan,
        changes: [
          {
            type: 'step_added',
            stepId: 2,
            description: 'Added step 2',
          },
        ],
        explanation: 'Added a new step for output formatting',
      };

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResponse),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: mockPlan,
        refinementInstruction: 'Add a step to output the result',
        conversationHistory: [],
        availableFunctions: [],
      };

      const result = await client.refinePlan(request);

      expect(result.refinedPlan).toEqual(mockPlan);
      expect(result.changes).toHaveLength(1);
      expect(result.explanation).toBe('Added a new step for output formatting');
    });

    it('should throw error when LLM returns non-text content', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          { type: 'image', data: '...' },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Modify plan',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow(
        'No text content in LLM response'
      );
    });

    it('should throw error for invalid JSON response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'not valid json' },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Modify plan',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow();
    });

    it('should throw error for missing required fields in response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          { type: 'text', text: '{"missing": "fields"}' },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Modify plan',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow(
        'Invalid response format: missing required fields'
      );
    });

    it('should throw error for empty steps in refined plan', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refinedPlan: {
                id: 'plan-abc',
                userRequest: 'Test',
                steps: [],
                status: 'executable',
                createdAt: new Date().toISOString(),
              },
              changes: [],
              explanation: 'Removed all steps',
            }),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Remove all steps',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow(
        'Invalid refined plan: steps array is empty'
      );
    });

    it('should throw error for non-consecutive step IDs', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refinedPlan: {
                id: 'plan-abc',
                userRequest: 'Test',
                steps: [
                  { stepId: 1, functionName: 'add', parameters: {} },
                  { stepId: 3, functionName: 'multiply', parameters: {} },
                ],
                status: 'executable',
                createdAt: new Date().toISOString(),
              },
              changes: [],
              explanation: 'Test',
            }),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Test',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow(
        'step IDs must be consecutive'
      );
    });

    it('should throw error for invalid dependsOn values', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refinedPlan: {
                id: 'plan-abc',
                userRequest: 'Test',
                steps: [
                  { stepId: 1, functionName: 'add', parameters: {}, dependsOn: [] },
                  { stepId: 2, functionName: 'multiply', parameters: {}, dependsOn: [2] },
                ],
                status: 'executable',
                createdAt: new Date().toISOString(),
              },
              changes: [],
              explanation: 'Test',
            }),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Test',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow(
        'depends on step 2, but dependencies must be on earlier steps'
      );
    });

    it('should handle API errors', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Modify plan',
        conversationHistory: [],
        availableFunctions: [],
      };

      await expect(client.refinePlan(request)).rejects.toThrow('API rate limit exceeded');
    });

    it('should parse JSON wrapped in code blocks', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc',
        userRequest: 'Test',
        steps: [{ stepId: 1, functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify({
              refinedPlan: mockPlan,
              changes: [],
              explanation: 'Test',
            }) + '\n```',
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: mockPlan,
        refinementInstruction: 'Test',
        conversationHistory: [],
        availableFunctions: [],
      };

      const result = await client.refinePlan(request);
      expect(result.refinedPlan).toEqual(mockPlan);
    });

    it('should include conversation history in prompt', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refinedPlan: {
                id: 'plan-abc',
                userRequest: 'Test',
                steps: [{ stepId: 1, functionName: 'add', parameters: {} }],
                status: 'executable',
                createdAt: new Date().toISOString(),
              },
              changes: [],
              explanation: 'Test',
            }),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Add calculation',
        conversationHistory: [
          { role: 'user', content: 'First request' },
          { role: 'assistant', content: 'Here is a plan' },
        ],
        availableFunctions: [],
      };

      await client.refinePlan(request);

      expect(mockMessagesCreate).toHaveBeenCalled();
      // The prompt should include conversation history
      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('First request');
    });
  });

  describe('formatFunctions', () => {
    it('should format function list correctly', async () => {
      const functions: FunctionMetadata[] = [
        {
          id: 'add-function',
          name: 'add',
          description: 'Add two numbers',
          scenario: 'When you need to add two numbers together',
          parameters: [
            { name: 'a', type: 'number', description: 'First number' },
            { name: 'b', type: 'number', description: 'Second number' },
          ],
          returns: { type: 'number', description: 'Sum of numbers' },
          type: 'local',
          source: 'test',
        },
      ];

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              refinedPlan: {
                id: 'plan-abc',
                userRequest: 'Test',
                steps: [{ stepId: 1, functionName: 'add', parameters: {} }],
                status: 'executable',
                createdAt: new Date().toISOString(),
              },
              changes: [],
              explanation: 'Test',
            }),
          },
        ],
      });

      const request: PlanRefinementRequest = {
        currentPlan: {
          id: 'plan-abc',
          userRequest: 'Test',
          steps: [],
          status: 'executable',
          createdAt: new Date().toISOString(),
        },
        refinementInstruction: 'Test',
        conversationHistory: [],
        availableFunctions: functions,
      };

      await client.refinePlan(request);

      // Verify the call was made with formatted functions
      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('add');
      expect(callArgs.messages[0].content).toContain('Add two numbers');
    });
  });
});
