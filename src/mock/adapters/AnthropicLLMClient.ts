import Anthropic from '@anthropic-ai/sdk';
import type { ILLMClient } from '../interfaces/ILLMClient.js';

/**
 * Anthropic LLM client adapter
 * Follows Adapter pattern: Wraps Anthropic SDK to match ILLMClient interface
 */
export class AnthropicLLMClient implements ILLMClient {
  private client: Anthropic;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      ...(baseURL && { baseURL }),
    });
  }

  /**
   * Generate code using Claude API
   */
  async generateCode(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content from response
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('LLM returned non-text content');
    }

    return textContent.text;
  }
}
