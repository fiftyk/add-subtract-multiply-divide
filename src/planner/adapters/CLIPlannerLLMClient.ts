import 'reflect-metadata';
import { spawn } from 'node:child_process';
import { injectable } from 'inversify';
import type { PlannerLLMClient } from '../interfaces/PlannerLLMClient.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';

@injectable()
/**
 * CLI LLM adapter for plan generation
 * Supports any CLI tool that reads prompt from stdin and outputs plan JSON to stdout
 * Examples: claude-switcher, gemini, ollama, etc.
 */
export class CLIPlannerLLMClient implements PlannerLLMClient {
  private logger: ILogger;
  private command: string;
  private args: string[];

  constructor(command: string, args: string, logger?: ILogger) {
    this.logger = logger ?? LoggerFactory.createFromEnv();
    this.command = command;
    // Parse space-separated args into array, preserving quoted arguments
    this.args = this.parseArgs(args);
  }

  /**
   * Parse space-separated args string into array
   * Handles quoted arguments correctly
   */
  private parseArgs(args: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < args.length; i++) {
      const char = args[i];

      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          result.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }

  /**
   * Generate plan using CLI tool
   */
  async generatePlan(prompt: string): Promise<string> {
    this.logger.debug('🤖 Sending request to CLI for plan generation', {
      command: this.command,
      args: this.args,
      promptLength: prompt.length,
    });

    const truncatedPrompt = prompt.length > 500
      ? prompt.substring(0, 500) + '...[truncated]'
      : prompt;
    this.logger.debug('📝 Prompt:', { prompt: truncatedPrompt });

    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, {
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
          this.logger.debug('✅ Received response from CLI', {
            command: this.command,
            responseLength: stdout.length,
          });
          resolve(stdout);
        } else {
          const error = new Error(`${this.command} exited with code ${code}: ${stderr}`);
          this.logger.error('❌ CLI command failed', error, {
            command: this.command,
            promptLength: prompt.length,
            stderr,
          });
          reject(error);
        }
      });

      child.on('error', (error) => {
        this.logger.error('❌ CLI command failed', error, {
          command: this.command,
          promptLength: prompt.length,
        });
        reject(error);
      });

      // Send the prompt to CLI
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
