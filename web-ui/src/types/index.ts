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
 * Execution Plan (from session.plan)
 */
export interface ExecutionPlan {
  id: string
  userRequest: string
  steps: Array<{
    stepId: number
    type: 'function_call' | 'user_input'
    description?: string
    functionName?: string
    parameters?: Record<string, any>
    dependsOn?: number[]
  }>
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
  plan?: ExecutionPlan  // 完整计划信息（从后端会话获取）
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
  values?: Record<string, any>  // 用户输入的值
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

export interface A2UIFieldValidation {
  range?: { min?: number; max?: number }
  length?: { min?: number; max?: number }
  pattern?: string
  errorMessage?: string
}

export interface A2UIFieldConfig {
  multiline?: boolean
  rows?: number
  placeholder?: string
  options?: Array<{ value: string | number; label: string; description?: string }>
  minSelections?: number
  maxSelections?: number
  minDate?: string
  maxDate?: string
}

export interface A2UIField {
  id: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'single_select' | 'multi_select'
  label: string
  description?: string
  required?: boolean
  defaultValue?: unknown
  validation?: A2UIFieldValidation
  config?: A2UIFieldConfig
  options?: Array<{ value: string | number; label: string }>
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
  components?: A2UIComponent[]
  timestamp: string
}

export interface A2UIComponent {
  id: string
  component: Record<string, Record<string, unknown>>
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

export interface ListSessionsResponse {
  sessions: SessionSummary[]
}

export interface SessionSummary {
  id: string
  planId: string
  status: Session['status']
  createdAt: string
  completedAt?: string
  platform: string
}

export interface ListPlansResponse {
  plans: Plan[]
}

export interface GetPlanResponse {
  plan: Plan
}
