/**
 * Plan Types
 */
export interface Plan {
  id: string
  userRequest: string
  status: 'executable' | 'invalid' | 'pending'
  createdAt: string
  steps?: PlanStep[]
}

export interface PlanStep {
  stepId: number
  type: 'function_call' | 'user_input'
  description?: string
  functionName?: string
  parameters?: Record<string, any>
  schema?: A2UISchema
  dependsOn?: number[]
}

/**
 * Session Types
 */
export interface Session {
  id: string
  planId: string
  status: 'pending' | 'executing' | 'waiting_input' | 'completed' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  result?: ExecutionResult
  pendingInput?: PendingInput
}

export interface PendingInput {
  stepId: number
  schema: A2UISchema
  surfaceId: string
}

export interface ExecutionResult {
  planId: string
  success: boolean
  error?: string
  steps: StepResult[]
  startedAt?: string
  completedAt?: string
}

export interface StepResult {
  stepId: number
  type: string
  functionName?: string
  parameters?: Record<string, any>
  result?: any
  success: boolean
  error?: string
  executedAt?: string
}

/**
 * A2UI Schema Types
 */
export interface A2UISchema {
  version: string
  fields: A2UIField[]
}

export interface A2UIFieldOptionsSource {
  type: 'stepResult'
  stepId: number
  labelField: string
  valueField: string
}

export interface A2UIField {
  id: string
  type: 'text' | 'date' | 'number' | 'select' | 'button'
  label: string
  required?: boolean
  config?: Record<string, any>
  options?: Array<{ value: string; label: string }>
  optionsSource?: A2UIFieldOptionsSource
}

/**
 * SSE Event Types
 */
export type SSEEvent =
  | ExecutionStartEvent
  | StepStartEvent
  | StepCompleteEvent
  | SurfaceUpdateEvent
  | InputRequestedEvent
  | InputReceivedEvent
  | ExecutionCompleteEvent
  | ExecutionErrorEvent

export interface ExecutionStartEvent {
  type: 'executionStart'
  sessionId: string
  timestamp: string
}

export interface StepStartEvent {
  type: 'stepStart'
  sessionId: string
  stepId: number
  functionName?: string
  timestamp: string
}

export interface StepCompleteEvent {
  type: 'stepComplete'
  sessionId: string
  stepId: number
  stepType: string
  result: any
  success: boolean
  timestamp: string
}

export interface SurfaceUpdateEvent {
  type: 'surfaceUpdate'
  sessionId: string
  surfaceId: string
  components: Array<{
    id: string
    component: Record<string, Record<string, unknown>>
  }>
  removeComponentIds?: string[]
  timestamp: string
}

export interface InputRequestedEvent {
  type: 'inputRequested'
  sessionId: string
  stepId: number
  surfaceId: string
  schema: A2UISchema
  timestamp: string
}

export interface InputReceivedEvent {
  type: 'inputReceived'
  sessionId: string
  stepId: number
  status: 'accepted' | 'rejected'
  timestamp: string
}

export interface ExecutionCompleteEvent {
  type: 'executionComplete'
  sessionId: string
  success: boolean
  result: ExecutionResult
  timestamp: string
}

export interface ExecutionErrorEvent {
  type: 'executionError'
  sessionId: string
  error: string
  timestamp: string
}

/**
 * API Request/Response Types
 */
export interface ExecuteSessionRequest {
  planId: string
  platform?: 'web' | 'cli'
}

export interface ExecuteSessionResponse {
  sessionId: string
  status: 'pending'
}

export interface ResumeSessionRequest {
  inputData: Record<string, any>
}

export interface ResumeSessionResponse {
  status: 'resumed'
}

export interface GetSessionResponse {
  session: Session
}

export interface ListPlansResponse {
  plans: Plan[]
}

export interface GetPlanResponse {
  plan: Plan
}
