import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sessionsApi } from '../services/api'
import { createSSEConnection, type SSEConnection } from '../services/sse'
import type {
  Session,
  SSEEvent,
  ExecutionResult,
  StepResult,
  A2UISchema,
  SurfaceUpdateEvent,
  A2UIComponent
} from '../types'
import type { ExecutionPlan } from '../types'

// InputRequested event type with components
interface InputRequestedEvent {
  type: 'inputRequested'
  sessionId: string
  schema: A2UISchema
  stepId: number
  surfaceId: string
  components?: A2UIComponent[]
  timestamp: string
}

export const useSessionStore = defineStore('session', () => {
  // State
  const currentSessionId = ref<string | null>(null)
  const currentSession = ref<Session | null>(null)
  const currentPlan = ref<ExecutionPlan | null>(null)  // 完整计划信息
  const status = ref<Session['status']>('pending')
  const isExecuting = ref(false)
  const currentStep = ref<number>(0)
  const stepResults = ref<StepResult[]>([])
  const finalResult = ref<ExecutionResult | null>(null)
  const pendingInputSchema = ref<A2UISchema | null>(null)
  const pendingInputStepId = ref<number | null>(null)
  const surfaceUpdates = ref<SurfaceUpdateEvent[]>([])
  const error = ref<string | null>(null)
  const loading = ref(false)
  const lastInputRequested = ref<InputRequestedEvent | null>(null)

  // SSE Connection
  let sseConnection: SSEConnection | null = null

  // Getters
  const hasSession = computed(() => currentSessionId.value !== null)
  const isWaitingInput = computed(() => status.value === 'waiting_input')
  const isCompleted = computed(() => status.value === 'completed')
  const isFailed = computed(() => status.value === 'failed')
  // Total steps in the plan (for display in sidebar)
  const totalSteps = computed(() => {
    if (currentPlan.value?.steps) {
      return currentPlan.value.steps.length
    }
    return stepResults.value.length || 1
  })
  // Total user input steps in the plan (from plan.steps)
  const totalUserInputSteps = computed(() => {
    if (currentPlan.value?.steps) {
      return currentPlan.value.steps.filter(s => s.type === 'user_input').length
    }
    // Fallback: count from stepResults
    return stepResults.value.filter(s => s.type === 'user_input').length
  })
  // Completed user input steps count
  const completedUserInputSteps = computed(() => {
    return stepResults.value.filter(s => s.type === 'user_input').length
  })
  // Total completed steps count
  const completedSteps = computed(() => {
    return stepResults.value.length
  })

  // Actions
  async function startExecution(planId: string) {
    loading.value = true
    error.value = null

    try {
      console.log('[SessionStore] Starting execution for plan:', planId)

      // Create session
      const response = await sessionsApi.execute({
        planId,
        platform: 'web'
      })

      currentSessionId.value = response.sessionId
      status.value = 'pending'
      isExecuting.value = true
      currentStep.value = 0
      stepResults.value = []
      finalResult.value = null
      pendingInputSchema.value = null
      pendingInputStepId.value = null
      surfaceUpdates.value = []

      console.log('[SessionStore] Session created:', response.sessionId)

      // Load full session to get plan information
      const fullSession = await sessionsApi.get(response.sessionId)
      currentSession.value = fullSession
      currentPlan.value = fullSession.plan ?? null

      console.log('[SessionStore] Plan loaded:', currentPlan.value?.steps?.length, 'steps')

      // Connect to SSE stream
      connectSSE(response.sessionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start execution'
      console.error('[SessionStore] Error starting execution:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function connectSSE(sessionId: string) {
    if (sseConnection) {
      sseConnection.disconnect()
    }

    const url = sessionsApi.getStreamUrl(sessionId)
    console.log('[SessionStore] Connecting to SSE:', url)

    sseConnection = createSSEConnection(url)

    sseConnection.onEvent((event: SSEEvent) => {
      handleSSEEvent(event)
    })

    sseConnection.onError((error: Event) => {
      console.error('[SessionStore] SSE connection error:', error)
    })

    sseConnection.connect()
  }

  function handleSSEEvent(event: SSEEvent) {
    console.log('[SessionStore] Handling event:', event.type)

    switch (event.type) {
      case 'executionStart':
        status.value = 'executing'
        isExecuting.value = true
        break

      case 'stepStart':
        currentStep.value = event.stepId
        console.log('[SessionStore] Step started:', event.stepId)
        break

      case 'stepComplete':
        // 检查是否已经存在相同 stepId 的结果（去重）
        const existingIndex = stepResults.value.findIndex(s => s.stepId === event.stepId)
        const stepResult = {
          stepId: event.stepId,
          type: event.stepType || 'function_call',
          result: event.result,
          success: event.success,
          executedAt: event.timestamp
        }
        if (existingIndex >= 0) {
          // 更新现有结果（保持数组顺序）
          stepResults.value[existingIndex] = stepResult
          console.log('[SessionStore] Step result updated:', event.stepId, event.stepType)
        } else {
          stepResults.value.push(stepResult)
          console.log('[SessionStore] Step completed:', event.stepId, event.stepType)
        }
        break

      case 'surfaceUpdate':
        surfaceUpdates.value.push(event)
        console.log('[SessionStore] Surface update received:', event.surfaceId, event.components.length, 'components')
        break

      case 'inputRequested':
        status.value = 'waiting_input'
        isExecuting.value = false
        // Save the full event with components for the sidebar
        lastInputRequested.value = event as InputRequestedEvent
        console.log('[SessionStore] Input requested schema:', JSON.stringify(event.schema, null, 2))
        console.log('[SessionStore] Field optionsSource:', JSON.stringify(event.schema?.fields?.map(f => ({ id: f.id, optionsSource: f.optionsSource })), null, 2))
        console.log('[SessionStore] Input components:', event.components?.length || 0)
        pendingInputSchema.value = event.schema
        pendingInputStepId.value = event.stepId
        console.log('[SessionStore] Input requested at step:', event.stepId)
        break

      case 'inputReceived':
        status.value = 'executing'
        isExecuting.value = true
        pendingInputSchema.value = null
        pendingInputStepId.value = null
        console.log('[SessionStore] Input received for step:', event.stepId)
        break

      case 'executionComplete':
        status.value = event.success ? 'completed' : 'failed'
        isExecuting.value = false
        finalResult.value = event.result
        console.log('[SessionStore] Execution completed:', event.success)
        disconnectSSE()
        break

      case 'executionError':
        status.value = 'failed'
        isExecuting.value = false
        error.value = event.error
        console.error('[SessionStore] Execution error:', event.error)
        disconnectSSE()
        break
    }
  }

  async function submitInput(inputData: Record<string, any>) {
    if (!currentSessionId.value) {
      throw new Error('No active session')
    }

    if (!isWaitingInput.value) {
      throw new Error('Session is not waiting for input')
    }

    loading.value = true
    error.value = null

    try {
      console.log('[SessionStore] Submitting input:', inputData)

      await sessionsApi.resume(currentSessionId.value, { inputData })

      console.log('[SessionStore] Input submitted successfully')

      // Ensure SSE connection is still active and reconnect if needed
      if (!sseConnection || !sseConnection.isConnected()) {
        console.log('[SessionStore] SSE connection lost, reconnecting...')
        try {
          connectSSE(currentSessionId.value)
        } catch (err) {
          console.error('[SessionStore] Failed to reconnect SSE:', err)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit input'
      console.error('[SessionStore] Error submitting input:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadSession(sessionId: string) {
    loading.value = true
    error.value = null
    surfaceUpdates.value = []

    try {
      currentSession.value = await sessionsApi.get(sessionId)
      currentSessionId.value = sessionId
      currentPlan.value = currentSession.value.plan ?? null  // 从会话中获取完整计划
      status.value = currentSession.value.status
      finalResult.value = currentSession.value.result ?? null

      // 如果会话已完成，从 result.steps 生成 surfaceUpdates 和 stepResults
      if (currentSession.value.result?.steps) {
        for (const stepResult of currentSession.value.result.steps) {
          // 跳过用户输入的占位符结果（success: false, values: {}）
          // 这些是等待用户输入时创建的临时记录
          if (stepResult.type === 'user_input' && !stepResult.success && (!stepResult.values || Object.keys(stepResult.values).length === 0)) {
            continue
          }

          // 填充 stepResults（用于侧边栏摘要）
          const stepEntry: any = {
            stepId: stepResult.stepId,
            type: stepResult.type,
            result: stepResult.result,
            success: stepResult.success,
            executedAt: stepResult.executedAt,
            functionName: stepResult.functionName
          }
          // 用户输入步骤有 values 字段
          if ('values' in stepResult) {
            stepEntry.values = stepResult.values
          }
          stepResults.value.push(stepEntry)

          if (stepResult.type === 'function_call' && stepResult.result !== undefined) {
            // 生成 surfaceUpdate 事件数据
            const components = generateA2UIComponentsFromResult(stepResult)
            if (components.length > 0) {
              surfaceUpdates.value.push({
                type: 'surfaceUpdate',
                sessionId,
                surfaceId: `result-${sessionId}-${stepResult.stepId}`,
                components,
                timestamp: stepResult.executedAt || new Date().toISOString()
              })
            }
          }
        }
      }

      console.log('[SessionStore] Session loaded:', sessionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load session'
      console.error('[SessionStore] Error loading session:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 从 StepResult 生成 A2UI 组件
  function generateA2UIComponentsFromResult(stepResult: StepResult): Array<{
    id: string
    component: Record<string, Record<string, unknown>>
  }> {
    const components: Array<{
      id: string
      component: Record<string, Record<string, unknown>>
    }> = []

    const result = stepResult.result

    if (Array.isArray(result) && result.length > 0) {
      // 生成表格组件
      const headers = Object.keys(result[0])
      const rows = result.map(item => headers.map(h => item[h] ?? null))

      components.push({
        id: `table-${stepResult.stepId}`,
        component: {
          Table: {
            headers,
            rows
          }
        }
      })
    } else if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      // 生成卡片组件
      const children = Object.entries(result).map(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
        return `${key}: ${displayValue}`
      })

      components.push({
        id: `card-${stepResult.stepId}`,
        component: {
          Card: {
            title: stepResult.functionName || `步骤 ${stepResult.stepId} 结果`,
            children
          }
        }
      })
    } else if (result !== undefined) {
      // 生成文本组件
      components.push({
        id: `text-${stepResult.stepId}`,
        component: {
          Text: {
            text: `${stepResult.functionName || '步骤 ' + stepResult.stepId}: ${String(result)}`
          }
        }
      })
    }

    return components
  }

  function disconnectSSE() {
    if (sseConnection) {
      sseConnection.disconnect()
      sseConnection = null
      console.log('[SessionStore] SSE disconnected')
    }
  }

  function reset() {
    disconnectSSE()
    currentSessionId.value = null
    currentSession.value = null
    currentPlan.value = null
    status.value = 'pending'
    isExecuting.value = false
    currentStep.value = 0
    stepResults.value = []
    finalResult.value = null
    pendingInputSchema.value = null
    pendingInputStepId.value = null
    surfaceUpdates.value = []
    error.value = null
    loading.value = false
    lastInputRequested.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    currentSessionId,
    currentSession,
    currentPlan,
    status,
    isExecuting,
    currentStep,
    stepResults,
    finalResult,
    pendingInputSchema,
    pendingInputStepId,
    surfaceUpdates,
    error,
    loading,
    lastInputRequested,

    // Getters
    hasSession,
    isWaitingInput,
    isCompleted,
    isFailed,
    totalSteps,
    totalUserInputSteps,
    completedSteps,
    completedUserInputSteps,

    // Actions
    startExecution,
    submitInput,
    loadSession,
    connectSSE,
    disconnectSSE,
    reset,
    clearError
  }
})
