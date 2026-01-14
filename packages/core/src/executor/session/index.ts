/**
 * Execution Session Module Exports
 *
 * Centralized exports for session-related types, interfaces, and implementations.
 */

// Types
export type { ExecutionSession, CreateSessionOptions } from './types.js';

// Session Store (for temporary in-memory/file storage)
export { ExecutionSessionStore } from './interfaces/SessionStore.js';
export { MemorySessionStore } from './implementations/MemorySessionStore.js';
export { FileSessionStore } from './implementations/FileSessionStore.js';

// Session Storage (for persistent execution history)
export {
  ExecutionSessionStorage,
  type ListSessionsOptions,
  type ExecutionStats,
} from './interfaces/ExecutionSessionStorage.js';
export { ExecutionSessionStorageImpl } from './storage/ExecutionSessionStorageImpl.js';

// Session Manager (business logic layer)
export { ExecutionSessionManager } from './interfaces/ExecutionSessionManager.js';
export { ExecutionSessionManagerImpl } from './managers/ExecutionSessionManagerImpl.js';
