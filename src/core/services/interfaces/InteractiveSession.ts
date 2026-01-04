/**
 * 交互式会话服务接口
 *
 * 管理执行过程中的用户交互会话
 */

import type { A2UIField } from '../../../user-input/interfaces/A2UISchema.js';

export type SessionStatus = 'pending' | 'running' | 'awaiting_input' | 'completed' | 'cancelled' | 'error';

export type SessionEventType =
  | 'started'
  | 'plan_received'
  | 'step_started'
  | 'step_completed'
  | 'awaiting_input'
  | 'input_received'
  | 'error'
  | 'completed'
  | 'cancelled';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface InteractiveStep {
  stepId: number;
  type: 'function_call' | 'condition' | 'input';
  functionName?: string;
  condition?: string;
  prompt?: string;
  description?: string;
}

export interface SessionMessage {
  type: 'start' | 'confirm' | 'input' | 'cancel';
  sessionId: string;
  planId?: string;
  request?: string;
  value?: boolean | string | number | Record<string, unknown>;
}

export interface SessionInfo {
  id: string;
  planId: string;
  status: SessionStatus;
  currentStep?: number;
  steps: InteractiveStep[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 待处理的输入请求（用于 API 返回）
 */
export interface UserInputField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface UserInputRequest {
  requestId: string;
  sessionId: string;
  stepId: number;
  fields: UserInputField[];
  createdAt: string;
}

export interface UserInputResponse {
  values: Record<string, unknown>;
  submittedAt: string;
}

/**
 * 内部使用的待处理输入状态
 */
export interface SessionPendingInput {
  sessionId: string;
  stepId: number;
  schema: { fields: A2UIField[]; version?: string };
  status: 'pending' | 'received' | 'cancelled';
  response?: UserInputResponse;
  createdAt: string;
}

export interface InteractiveSession {
  start(request: string, planId?: string): Promise<SessionInfo>;
  confirm(sessionId: string, confirmed: boolean): Promise<void>;
  sendInput(sessionId: string, input: Record<string, unknown>): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<SessionInfo | undefined>;
  listSessions(): Promise<SessionInfo[]>;
  getPendingInputs(sessionId: string): Promise<UserInputRequest[]>;
  submitInput(sessionId: string, stepId: number, values: Record<string, unknown>): Promise<boolean>;
}

export const InteractiveSession = Symbol('InteractiveSession');
