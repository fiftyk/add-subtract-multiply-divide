import type { AppConfig } from './types.js';
import * as path from 'path';

/**
 * Default configuration values
 *
 * Note: MCP configuration is managed separately by MCPServerConfigProvider
 */
export const DEFAULT_CONFIG: Omit<AppConfig, 'api'> = {
  llm: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
  },
  executor: {
    stepTimeout: 30000, // 30 seconds
  },
  storage: {
    dataDir: path.join(process.cwd(), '.data'),
  },
  functionCompletion: {
    outputDir: path.join(process.cwd(), 'functions/generated'),
    enabled: false,
    maxRetries: 3,
  },
  functionCodeGenerator: {
    command: 'claude-switcher',
    args: 'MINMAX -- -p',
  },
  plannerGenerator: {
    command: '',
    args: '',
  },
};
