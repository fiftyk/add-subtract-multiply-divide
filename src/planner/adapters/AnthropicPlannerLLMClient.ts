import Anthropic from '@anthropic-ai/sdk';
import type { IPlannerLLMClient } from '../interfaces/IPlannerLLMClient.js';

/**
 * Anthropic Claude adapter for planning
 * Implements IPlannerLLMClient using Anthropic SDK
 */
export class AnthropicPlannerLLMClient implements IPlannerLLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: {
    apiKey: string;
    baseURL?: string;
    model?: string;
    maxTokens?: number;
  }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 1024;
  }

  /**
   * Generate plan using Claude API
   */
  async generatePlan(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('LLM 返回了非文本内容');
    }

    return textContent.text;
  }
}
