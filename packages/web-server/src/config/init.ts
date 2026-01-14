/**
 * Configuration initialization for web server
 *
 * This module must be imported before any code that uses the container
 */
// @ts-ignore - Importing from parent project's dist folder
import * as ConfigModule from '@fn-orchestrator/core/config';

const { ConfigManager } = ConfigModule;

// Initialize once
let initialized = false;

export function initializeConfig(): void {
  if (initialized) {
    return;
  }

  ConfigManager.initialize({
    autoComplete: false, // Default: no auto-complete in web mode
    maxRetries: 3        // Default: 3 retries
  });

  initialized = true;
  console.log('[Config] ConfigManager initialized for web server');
}

export function isConfigInitialized(): boolean {
  return initialized && ConfigManager.isInitialized();
}
