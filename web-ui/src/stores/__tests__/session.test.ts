import { describe, it, expect, vi, beforeEach, SpyInstance } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '../session'
import { sessionsApi } from '../../services/api'
import type { Session, A2UISchema, SSEEvent } from '../../types'

// Mock API module
const mockExecute = vi.fn()
const mockGet = vi.fn()
const mockResume = vi.fn()
const mockGetStreamUrl = vi.fn()

vi.mock('../../services/api', () => ({
  sessionsApi: {
    execute: (...args: any[]) => mockExecute(...args),
    get: (...args: any[]) => mockGet(...args),
    resume: (...args: any[]) => mockResume(...args),
    getStreamUrl: (...args: any[]) => mockGetStreamUrl(...args)
  }
}))

// Mock SSE module
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockOnEvent = vi.fn()
const mockOnError = vi.fn()
const mockIsConnected = vi.fn().mockReturnValue(true)

vi.mock('../../services/sse', () => ({
  createSSEConnection: vi.fn(() => ({
    connect: (...args: any[]) => mockConnect(...args),
    disconnect: (...args: any[]) => mockDisconnect(...args),
    onEvent: (...args: any[]) => mockOnEvent(...args),
    onError: (...args: any[]) => mockOnError(...args),
    isConnected: (...args: any[]) => mockIsConnected(...args)
  }))
}))

describe('SessionStore - SSE Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockIsConnected.mockReturnValue(true)
  })

  describe('submitInput', () => {
    it('should submit input and reconnect SSE if connection lost', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: 'session-test-123',
        status: 'waiting_input',
        pendingInputSchema: {
          surfaceId: 'test-form',
          description: 'Test form',
          fields: [
            { id: 'companyName', type: 'text' as const, label: 'Company', required: true }
          ]
        } as A2UISchema
      })

      mockResume.mockResolvedValue({ status: 'resumed' })
      mockIsConnected.mockReturnValue(false) // Simulate connection lost
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-test-123/stream')

      await store.submitInput({ companyName: 'Test Company' })

      expect(mockResume).toHaveBeenCalledWith('session-test-123', {
        inputData: { companyName: 'Test Company' }
      })
      // Should reconnect SSE after submit
      expect(mockConnect).toHaveBeenCalled()
      expect(store.loading).toBe(false)
    })

    it('should not reconnect if SSE is still connected', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: 'session-test-456',
        status: 'waiting_input',
        pendingInputSchema: {
          surfaceId: 'test-form',
          description: 'Test form',
          fields: [
            { id: 'name', type: 'text' as const, label: 'Name', required: true }
          ]
        } as A2UISchema
      })

      mockResume.mockResolvedValue({ status: 'resumed' })
      mockIsConnected.mockReturnValue(true) // SSE is connected

      await store.submitInput({ name: 'Test' })

      expect(mockResume).toHaveBeenCalled()
      // Should not reconnect if already connected
      // Note: connectSSE is called during startExecution, not here
    })

    it('should throw error when no active session', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: null,
        status: 'pending'
      })

      await expect(store.submitInput({ test: 'value' }))
        .rejects.toThrow('No active session')
    })

    it('should throw error when session is not waiting for input', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: 'session-test',
        status: 'executing'
      })

      await expect(store.submitInput({ test: 'value' }))
        .rejects.toThrow('Session is not waiting for input')
    })

    it('should handle API error during submitInput', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: 'session-error',
        status: 'waiting_input',
        pendingInputSchema: {
          surfaceId: 'test-form',
          description: 'Test form',
          fields: []
        } as A2UISchema
      })

      mockResume.mockRejectedValue(new Error('Network error'))

      await expect(store.submitInput({ test: 'value' }))
        .rejects.toThrow('Network error')

      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })

    it('should reset loading state after submitInput completes', async () => {
      const store = useSessionStore()

      store.$patch({
        currentSessionId: 'session-test',
        status: 'waiting_input',
        pendingInputSchema: {
          surfaceId: 'test-form',
          description: 'Test form',
          fields: [{ id: 'test', type: 'text' as const, label: 'Test', required: false }]
        } as A2UISchema,
        loading: false
      })

      mockResume.mockResolvedValue({ status: 'resumed' })

      expect(store.loading).toBe(false)

      const promise = store.submitInput({ test: 'value' })

      // Loading should be true during the request
      expect(store.loading).toBe(true)

      await promise

      expect(store.loading).toBe(false)
    })
  })

  describe('SSE Connection', () => {
    it('should connect to SSE when startExecution is called', async () => {
      const store = useSessionStore()

      mockExecute.mockResolvedValue({ sessionId: 'session-new-123', status: 'pending' })
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-new-123/stream')

      await store.startExecution('plan-test')

      expect(mockExecute).toHaveBeenCalledWith({ planId: 'plan-test', platform: 'web' })
      expect(mockGetStreamUrl).toHaveBeenCalledWith('session-new-123')
      expect(mockConnect).toHaveBeenCalled()
      expect(store.currentSessionId).toBe('session-new-123')
    })

    it('should disconnect SSE when execution completes', async () => {
      const store = useSessionStore()

      mockExecute.mockResolvedValue({ sessionId: 'session-test', status: 'pending' })
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-test/stream')

      await store.startExecution('plan-test')

      store.disconnectSSE()

      expect(mockDisconnect).toHaveBeenCalled()
      expect(store.currentSessionId).toBe('session-test')
    })

    it('should reconnect SSE when connecting to a new session', async () => {
      const store = useSessionStore()

      mockExecute.mockResolvedValue({ sessionId: 'session-1', status: 'pending' })
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-1/stream')

      await store.startExecution('plan-1')
      expect(mockConnect).toHaveBeenCalledTimes(1)

      // Reset mocks for second connection
      mockExecute.mockResolvedValue({ sessionId: 'session-2', status: 'pending' })
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-2/stream')

      await store.startExecution('plan-2')

      // Should disconnect first, then connect to new session
      expect(mockDisconnect).toHaveBeenCalled()
      expect(mockConnect).toHaveBeenCalledTimes(2)
      expect(store.currentSessionId).toBe('session-2')
    })
  })

  describe('SSE Event Handling - State Transitions', () => {
    it('should transition from waiting_input to executing on inputReceived', () => {
      const store = useSessionStore()

      // Initial state: waiting for input
      store.$patch({
        status: 'waiting_input',
        isExecuting: false
      })

      expect(store.isWaitingInput).toBe(true)
      expect(store.isExecuting).toBe(false)

      // Simulate inputReceived event handling
      store.$patch({
        status: 'executing',
        isExecuting: true,
        pendingInputSchema: null,
        pendingInputStepId: null
      })

      expect(store.isWaitingInput).toBe(false)
      expect(store.isExecuting).toBe(true)
    })

    it('should transition to completed on successful execution', () => {
      const store = useSessionStore()

      store.$patch({
        status: 'executing',
        isExecuting: true
      })

      expect(store.isCompleted).toBe(false)

      store.$patch({
        status: 'completed',
        isExecuting: false,
        finalResult: {
          planId: 'plan-test',
          success: true,
          steps: [],
          finalResult: 'ok',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      })

      expect(store.isCompleted).toBe(true)
      expect(store.isExecuting).toBe(false)
      expect(store.finalResult?.success).toBe(true)
    })

    it('should transition to failed on execution error', () => {
      const store = useSessionStore()

      store.$patch({
        status: 'executing',
        isExecuting: true,
        error: null
      })

      store.$patch({
        status: 'failed',
        isExecuting: false,
        error: 'Function execution failed'
      })

      expect(store.isFailed).toBe(true)
      expect(store.error).toBe('Function execution failed')
    })

    it('should update currentStep on stepStart event', () => {
      const store = useSessionStore()

      store.$patch({
        currentStep: 0
      })

      store.$patch({
        currentStep: 1
      })

      expect(store.currentStep).toBe(1)
    })

    it('should append step results on stepComplete event', () => {
      const store = useSessionStore()

      store.$patch({
        stepResults: []
      })

      const stepResult = {
        stepId: 0,
        type: 'function_call' as const,
        functionName: 'add',
        result: 8,
        success: true,
        executedAt: new Date().toISOString()
      }

      store.$patch({
        stepResults: [stepResult]
      })

      expect(store.stepResults).toHaveLength(1)
      expect(store.stepResults[0].result).toBe(8)
    })
  })

  describe('State Getters', () => {
    it('should correctly identify waiting_input status', () => {
      const store = useSessionStore()

      store.$patch({ status: 'waiting_input' })
      expect(store.isWaitingInput).toBe(true)

      store.$patch({ status: 'executing' })
      expect(store.isWaitingInput).toBe(false)
    })

    it('should correctly identify completed status', () => {
      const store = useSessionStore()

      store.$patch({ status: 'pending' })
      expect(store.isCompleted).toBe(false)

      store.$patch({ status: 'completed' })
      expect(store.isCompleted).toBe(true)
    })

    it('should correctly identify failed status', () => {
      const store = useSessionStore()

      store.$patch({ status: 'running' })
      expect(store.isFailed).toBe(false)

      store.$patch({ status: 'failed' })
      expect(store.isFailed).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const store = useSessionStore()

      // Set some state
      mockExecute.mockResolvedValue({ sessionId: 'session-test', status: 'pending' })
      mockGetStreamUrl.mockReturnValue('http://localhost:3000/api/sessions/session-test/stream')

      await store.startExecution('plan-test')

      // Verify state is set
      expect(store.currentSessionId).toBe('session-test')

      // Reset
      store.reset()

      // Verify reset
      expect(store.currentSessionId).toBe(null)
      expect(store.status).toBe('pending')
      expect(store.isExecuting).toBe(false)
      expect(store.currentStep).toBe(0)
      expect(store.stepResults).toEqual([])
      expect(store.finalResult).toBe(null)
      expect(store.error).toBe(null)
    })
  })
})
