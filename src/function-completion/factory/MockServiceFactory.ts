import type { CompletionOrchestrator } from '../interfaces/CompletionOrchestrator.js';

export interface MockServiceFactory {
  createOrchestrator(planId: string): CompletionOrchestrator;
}

export const MockServiceFactory = Symbol('MockServiceFactory');
