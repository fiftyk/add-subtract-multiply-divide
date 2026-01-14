/**
 * SSE Event Types
 * Server-Sent Events for real-time communication
 */

import type { A2UIComponent } from '@fn-orchestrator/core/a2ui/types.js';

export type SSEEvent =
  | ExecutionStartEvent
  | StepStartEvent
  | StepCompleteEvent
  | SurfaceUpdateEvent
  | InputRequestedEvent
  | InputReceivedEvent
  | ExecutionCompleteEvent
  | ExecutionErrorEvent;

export interface ExecutionStartEvent {
  type: 'executionStart';
  sessionId: string;
  timestamp: string;
}

export interface StepStartEvent {
  type: 'stepStart';
  sessionId: string;
  stepId: number;
  functionName?: string;
  timestamp: string;
}

export interface StepCompleteEvent {
  type: 'stepComplete';
  sessionId: string;
  stepId: number;
  stepType: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: string;
}

export interface SurfaceUpdateEvent {
  type: 'surfaceUpdate';
  sessionId: string;
  surfaceId: string;
  components: A2UIComponent[];
  removeComponentIds?: string[];
  timestamp: string;
}

export interface InputRequestedEvent {
  type: 'inputRequested';
  sessionId: string;
  surfaceId: string;
  schema: any; // A2UISchema
  stepId: number;
  timestamp: string;
}

export interface InputReceivedEvent {
  type: 'inputReceived';
  sessionId: string;
  stepId: number;
  status: 'accepted' | 'rejected';
  timestamp: string;
}

export interface ExecutionCompleteEvent {
  type: 'executionComplete';
  sessionId: string;
  success: boolean;
  result: any;
  timestamp: string;
}

export interface ExecutionErrorEvent {
  type: 'executionError';
  sessionId: string;
  error: string;
  stepId?: number;
  timestamp: string;
}

/**
 * API Request/Response Types
 */

export interface ExecuteSessionRequest {
  planId: string;
  platform?: 'web' | 'cli';
}

export interface ExecuteSessionResponse {
  sessionId: string;
  status: 'pending' | 'running';
}

export interface ResumeSessionRequest {
  inputData: Record<string, any>;
}

export interface ResumeSessionResponse {
  status: 'resumed' | 'error';
  message?: string;
}

export interface GetSessionResponse {
  session: any; // ExecutionSession
}

export interface ListPlansResponse {
  plans: Array<{
    id: string;
    userRequest: string;
    status: string;
    createdAt: string;
  }>;
}

export interface GetPlanResponse {
  plan: any; // ExecutionPlan
}
