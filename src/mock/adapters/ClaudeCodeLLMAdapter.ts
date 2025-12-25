import { spawn } from 'node:child_process';
import type { LLMAdapter } from '../interfaces/LLMAdapter.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';

/**
 * Claude Code CLI LLM adapter
 * Uses Claude Code CLI (claude -p) for code generation
 */
export class ClaudeCodeLLMAdapter implements LLMAdapter {
  private logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * Generate code using Claude Code CLI
   */
  async generateCode(prompt: string): Promise<string> {
    this.logger.debug('🤖 Sending request to Claude Code CLI for code generation', {
      promptLength: prompt.length,
    });

    const truncatedPrompt = prompt.length > 500
      ? prompt.substring(0, 500) + '...[truncated]'
      : prompt;
    this.logger.debug('📝 Prompt:', { prompt: truncatedPrompt });

    return new Promise((resolve, reject) => {
      const child = spawn('claude', ['-p'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.logger.debug('✅ Received response from Claude Code CLI', {
            responseLength: stdout.length,
          });
          resolve(stdout);
        } else {
          const error = new Error(`Claude CLI exited with code ${code}: ${stderr}`);
          this.logger.error('❌ Claude Code CLI failed', error, {
            promptLength: prompt.length,
            stderr,
          });
          reject(error);
        }
      });

      child.on('error', (error) => {
        this.logger.error('❌ Claude Code CLI failed', error, {
          promptLength: prompt.length,
        });
        reject(error);
      });

      // Send the prompt to Claude CLI
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
