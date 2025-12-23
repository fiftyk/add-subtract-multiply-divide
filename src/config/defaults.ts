import type { AppConfig } from './types.js';
import * as path from 'path';

/**
 * Default configuration values
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
  mock: {
    outputDir: path.join(process.cwd(), 'functions/generated'),
  },
};
