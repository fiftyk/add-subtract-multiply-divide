import Anthropic from '@anthropic-ai/sdk';
import type { ILLMClient } from '../interfaces/ILLMClient.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';

/**
 * Anthropic LLM client adapter
 * Follows Adapter pattern: Wraps Anthropic SDK to match ILLMClient interface
 */
export class AnthropicLLMClient implements ILLMClient {
  private client: Anthropic;
  private logger: ILogger;

  constructor(apiKey: string, baseURL?: string, logger?: ILogger) {
    this.client = new Anthropic({
      apiKey,
      ...(baseURL && { baseURL }),
    });
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * Generate code using Claude API
   */
  async generateCode(prompt: string): Promise<string> {
    // Log the request
    this.logger.debug('🤖 Sending request to Claude API for code generation', {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      promptLength: prompt.length,
    });

    // Log prompt (truncated if too long)
    const truncatedPrompt = prompt.length > 500
      ? prompt.substring(0, 500) + '...[truncated]'
      : prompt;
    this.logger.debug('📝 Prompt:', { prompt: truncatedPrompt });

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content from response
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      this.logger.error('❌ LLM returned non-text content', undefined, {
        contentTypes: message.content.map(c => c.type)
      });
      throw new Error('LLM returned non-text content');
    }

    // Log the response
    this.logger.debug('✅ Received response from Claude API', {
      responseLength: textContent.text.length,
      usage: message.usage,
    });

    return textContent.text;
  }
}
