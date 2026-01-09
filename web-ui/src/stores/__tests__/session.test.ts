/**
 * Session Store Unit Tests
 *
 * Tests for the session store, focusing on:
 * - State initialization and cleanup
 * - surfaceUpdates management
 * - generateA2UIComponentsFromResult function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Session, SurfaceUpdateEvent } from '../../types'

// Mock the API module
vi.mock('../../services/api', () => ({
  sessionsApi: {
    execute: vi.fn(),
    get: vi.fn(),
    resume: vi.fn(),
    getStreamUrl: vi.fn()
  }
}))

// Mock the SSE module
vi.mock('../../services/sse', () => ({
  createSSEConnection: vi.fn(() => ({
    onEvent: vi.fn(),
    onError: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true)
  }))
}))

import { sessionsApi } from '../../services/api'
import { useSessionStore } from '../session'

describe('SessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('State Initialization', () => {
    it('should initialize with default values', () => {
      const store = useSessionStore()

      expect(store.currentSessionId).toBeNull()
      expect(store.currentSession).toBeNull()
      expect(store.status).toBe('pending')
      expect(store.isExecuting).toBe(false)
      expect(store.currentStep).toBe(0)
      expect(store.stepResults).toEqual([])
      expect(store.finalResult).toBeNull()
      expect(store.pendingInputSchema).toBeNull()
      expect(store.pendingInputStepId).toBeNull()
      expect(store.surfaceUpdates).toEqual([])
      expect(store.error).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('reset()', () => {
    it('should reset all state values', () => {
      const store = useSessionStore()

      // Simulate some state
      store.currentSessionId = 'test-session'
      store.status = 'executing'
      store.isExecuting = true
      store.currentStep = 5
      store.stepResults = [{ stepId: 1, type: 'test', success: true }] as any
      store.finalResult = { success: true, steps: [] } as any
      store.surfaceUpdates = [{ type: 'surfaceUpdate', sessionId: 's1', surfaceId: 'surf1', components: [], timestamp: '' }] as any
      store.error = 'some error'

      // Reset
      store.reset()

      expect(store.currentSessionId).toBeNull()
      expect(store.currentSession).toBeNull()
      expect(store.status).toBe('pending')
      expect(store.isExecuting).toBe(false)
      expect(store.currentStep).toBe(0)
      expect(store.stepResults).toEqual([])
      expect(store.finalResult).toBeNull()
      expect(store.pendingInputSchema).toBeNull()
      expect(store.pendingInputStepId).toBeNull()
      expect(store.surfaceUpdates).toEqual([])
      expect(store.error).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('startExecution()', () => {
    it('should clear surfaceUpdates before starting new execution', async () => {
      const store = useSessionStore()

      // Simulate previous session with surface updates
      store.surfaceUpdates = [
        { type: 'surfaceUpdate', sessionId: 'old-session', surfaceId: 'surf1', components: [], timestamp: '' } as any
      ]

      // Mock API response
      vi.mocked(sessionsApi.execute).mockResolvedValue({ sessionId: 'new-session', status: 'pending' })

      await store.startExecution('test-plan')

      // surfaceUpdates should be cleared
      expect(store.surfaceUpdates).toEqual([])
      expect(store.currentSessionId).toBe('new-session')
    })

    it('should reset all state values when starting new execution', async () => {
      const store = useSessionStore()

      // Simulate previous state
      store.currentSessionId = 'old-session'
      store.status = 'completed'
      store.isExecuting = true
      store.currentStep = 10
      store.stepResults = [{ stepId: 5, type: 'function_call', success: true }] as any
      store.finalResult = { success: true, steps: [] } as any
      store.error = 'previous error'
      store.surfaceUpdates = [{ type: 'surfaceUpdate' }] as any

      vi.mocked(sessionsApi.execute).mockResolvedValue({ sessionId: 'new-session', status: 'pending' })

      await store.startExecution('test-plan')

      expect(store.currentSessionId).toBe('new-session')
      expect(store.status).toBe('pending')
      expect(store.isExecuting).toBe(true)
      expect(store.currentStep).toBe(0)
      expect(store.stepResults).toEqual([])
      expect(store.finalResult).toBeNull()
      expect(store.error).toBeNull()
      expect(store.surfaceUpdates).toEqual([])
    })
  })

  describe('loadSession()', () => {
    it('should clear surfaceUpdates before loading session', async () => {
      const store = useSessionStore()

      // Simulate previous surface updates
      store.surfaceUpdates = [
        { type: 'surfaceUpdate', sessionId: 'old-session', surfaceId: 'surf1', components: [], timestamp: '' } as any
      ]

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: []
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      // surfaceUpdates should be cleared first, then regenerated from steps
      expect(store.currentSessionId).toBe('session-123')
    })

    it('should generate surfaceUpdates from completed session steps', async () => {
      const store = useSessionStore()

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: [
            {
              stepId: 1,
              type: 'function_call',
              functionName: 'add',
              result: 8,
              success: true,
              executedAt: '2026-01-10T00:00:00.000Z'
            }
          ]
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      expect(store.surfaceUpdates.length).toBe(1)
      expect(store.surfaceUpdates[0].surfaceId).toBe('result-session-123-1')
    })

    it('should generate Table component for array results', async () => {
      const store = useSessionStore()

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: [
            {
              stepId: 1,
              type: 'function_call',
              functionName: 'queryPatents',
              result: [
                { title: 'Patent 1', pn: 'CN123', inventor: 'A', pubDate: '2024-01-01' },
                { title: 'Patent 2', pn: 'CN456', inventor: 'B', pubDate: '2024-02-01' }
              ],
              success: true,
              executedAt: '2026-01-10T00:00:00.000Z'
            }
          ]
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      expect(store.surfaceUpdates.length).toBe(1)
      const components = store.surfaceUpdates[0].components
      expect(components.length).toBe(1)
      expect(components[0].id).toBe('table-1')
      expect(components[0].component).toHaveProperty('Table')
      expect((components[0].component as any).Table.headers).toEqual(['title', 'pn', 'inventor', 'pubDate'])
      expect((components[0].component as any).Table.rows.length).toBe(2)
    })

    it('should generate Card component for object results', async () => {
      const store = useSessionStore()

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: [
            {
              stepId: 1,
              type: 'function_call',
              functionName: 'getStats',
              result: { count: 100, rate: 0.95 },
              success: true,
              executedAt: '2026-01-10T00:00:00.000Z'
            }
          ]
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      expect(store.surfaceUpdates.length).toBe(1)
      const components = store.surfaceUpdates[0].components
      expect(components.length).toBe(1)
      expect(components[0].id).toBe('card-1')
      expect(components[0].component).toHaveProperty('Card')
      expect((components[0].component as any).Card.title).toBe('getStats')
    })

    it('should generate Text component for primitive results', async () => {
      const store = useSessionStore()

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: [
            {
              stepId: 1,
              type: 'function_call',
              functionName: 'add',
              result: 8,
              success: true,
              executedAt: '2026-01-10T00:00:00.000Z'
            }
          ]
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      expect(store.surfaceUpdates.length).toBe(1)
      const components = store.surfaceUpdates[0].components
      expect(components.length).toBe(1)
      expect(components[0].id).toBe('text-1')
      expect(components[0].component).toHaveProperty('Text')
      expect((components[0].component as any).Text.text).toContain('8')
    })

    it('should handle empty arrays', async () => {
      const store = useSessionStore()

      const mockSession: Partial<Session> = {
        id: 'session-123',
        planId: 'plan-abc',
        status: 'completed',
        createdAt: new Date().toISOString(),
        result: {
          planId: 'plan-abc',
          success: true,
          steps: [
            {
              stepId: 1,
              type: 'function_call',
              functionName: 'queryPatents',
              result: [],
              success: true,
              executedAt: '2026-01-10T00:00:00.000Z'
            }
          ]
        }
      }

      vi.mocked(sessionsApi.get).mockResolvedValue(mockSession as Session)

      await store.loadSession('session-123')

      expect(store.surfaceUpdates.length).toBe(1)
      const components = store.surfaceUpdates[0].components
      expect(components.length).toBe(1)
      expect(components[0].component).toHaveProperty('Text')
    })
  })
})
