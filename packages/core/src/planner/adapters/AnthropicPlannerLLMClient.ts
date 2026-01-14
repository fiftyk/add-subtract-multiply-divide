import 'reflect-metadata';
import Anthropic from '@anthropic-ai/sdk';
import { injectable } from 'inversify';
import type { PlannerLLMClient } from '../interfaces/PlannerLLMClient.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';

/**
 * Anthropic Claude adapter for planning
 * Implements PlannerLLMClient using Anthropic SDK
 */
@injectable()
export class AnthropicPlannerLLMClient implements PlannerLLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private logger: ILogger;

  constructor(config: {
    apiKey: string;
    baseURL?: string;
    model?: string;
    maxTokens?: number;
    logger?: ILogger;
  }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 1024;
    this.logger = config.logger ?? LoggerFactory.create();
  }

  /**
   * Generate plan using Claude API
   */
  async generatePlan(prompt: string): Promise<string> {
    // Log the request
    this.logger.debug('🤖 Sending request to Claude API for planning', {
      model: this.model,
      maxTokens: this.maxTokens,
      promptLength: prompt.length,
    });

    // Log prompt (truncated if too long)
    const truncatedPrompt = prompt.length > 500
      ? prompt.substring(0, 500) + '...[truncated]'
      : prompt;
    this.logger.debug('📝 Prompt:', { prompt: truncatedPrompt });

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      this.logger.error('❌ LLM 返回了非文本内容', undefined, {
        contentTypes: message.content.map(c => c.type)
      });
      throw new Error('LLM 返回了非文本内容');
    }

    // Log the response
    this.logger.debug('✅ Received response from Claude API', {
      responseLength: textContent.text.length,
      usage: message.usage,
    });

    return textContent.text;
  }
}
