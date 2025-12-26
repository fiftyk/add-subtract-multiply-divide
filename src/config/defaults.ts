import type { AppConfig } from './types.js';
import * as path from 'path';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<AppConfig, 'api'> = {
  llm: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    adapter: 'anthropic', // 默认使用 Anthropic API
  },
  executor: {
    stepTimeout: 30000, // 30 seconds
  },
  storage: {
    dataDir: path.join(process.cwd(), '.data'),
  },
  mock: {
    outputDir: path.join(process.cwd(), 'functions/generated'),
    autoGenerate: false, // Breaking change: 默认禁用
    maxIterations: 3,    // 显式默认值，之前硬编码
  },
};
