import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sessionsApi } from '../services/api'
import { createSSEConnection, type SSEConnection } from '../services/sse'
import type {
  Session,
  SSEEvent,
  ExecutionResult,
  StepResult,
  A2UISchema
} from '../types'

export const useSessionStore = defineStore('session', () => {
  // State
  const currentSessionId = ref<string | null>(null)
  const currentSession = ref<Session | null>(null)
  const status = ref<Session['status']>('pending')
  const isExecuting = ref(false)
  const currentStep = ref<number>(0)
  const stepResults = ref<StepResult[]>([])
  const finalResult = ref<ExecutionResult | null>(null)
  const pendingInputSchema = ref<A2UISchema | null>(null)
  const pendingInputStepId = ref<number | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  // SSE Connection
  let sseConnection: SSEConnection | null = null

  // Getters
  const hasSession = computed(() => currentSessionId.value !== null)
  const isWaitingInput = computed(() => status.value === 'waiting_input')
  const isCompleted = computed(() => status.value === 'completed')
  const isFailed = computed(() => status.value === 'failed')

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
      stepResults.value = []
      finalResult.value = null
      pendingInputSchema.value = null
      pendingInputStepId.value = null

      console.log('[SessionStore] Session created:', response.sessionId)

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
        stepResults.value.push({
          stepId: event.stepId,
          type: 'function_call',
          result: event.result,
          success: event.success,
          executedAt: event.timestamp
        })
        console.log('[SessionStore] Step completed:', event.stepId)
        break

      case 'inputRequested':
        status.value = 'waiting_input'
        isExecuting.value = false
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

    try {
      currentSession.value = await sessionsApi.get(sessionId)
      currentSessionId.value = sessionId
      status.value = currentSession.value.status

      console.log('[SessionStore] Session loaded:', sessionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load session'
      console.error('[SessionStore] Error loading session:', err)
      throw err
    } finally {
      loading.value = false
    }
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
    status.value = 'pending'
    isExecuting.value = false
    currentStep.value = 0
    stepResults.value = []
    finalResult.value = null
    pendingInputSchema.value = null
    pendingInputStepId.value = null
    error.value = null
    loading.value = false
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    currentSessionId,
    currentSession,
    status,
    isExecuting,
    currentStep,
    stepResults,
    finalResult,
    pendingInputSchema,
    pendingInputStepId,
    error,
    loading,

    // Getters
    hasSession,
    isWaitingInput,
    isCompleted,
    isFailed,

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
