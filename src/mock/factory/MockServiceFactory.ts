import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';

export interface MockServiceFactory {
  createOrchestrator(planId: string): IMockOrchestrator;
}

export const MockServiceFactory = Symbol('MockServiceFactory');
