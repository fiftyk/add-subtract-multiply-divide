import axios from 'axios'
import type {
  Plan,
  Session,
  ExecuteSessionRequest,
  ExecuteSessionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  GetSessionResponse,
  ListPlansResponse,
  GetPlanResponse
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Plans API
 */
export const plansApi = {
  /**
   * List all available plans
   */
  async list(): Promise<Plan[]> {
    const response = await api.get<ListPlansResponse>('/plans')
    return response.data.plans
  },

  /**
   * Get a specific plan by ID
   */
  async get(planId: string): Promise<Plan> {
    const response = await api.get<GetPlanResponse>(`/plans/${planId}`)
    return response.data.plan
  }
}

/**
 * Sessions API
 */
export const sessionsApi = {
  /**
   * Create and execute a new session
   */
  async execute(request: ExecuteSessionRequest): Promise<ExecuteSessionResponse> {
    const response = await api.post<ExecuteSessionResponse>('/sessions/execute', request)
    return response.data
  },

  /**
   * Get session details
   */
  async get(sessionId: string): Promise<Session> {
    const response = await api.get<GetSessionResponse>(`/sessions/${sessionId}`)
    return response.data.session
  },

  /**
   * Resume a session with user input
   */
  async resume(sessionId: string, request: ResumeSessionRequest): Promise<ResumeSessionResponse> {
    const response = await api.post<ResumeSessionResponse>(
      `/sessions/${sessionId}/resume`,
      request
    )
    return response.data
  },

  /**
   * Get SSE stream URL for a session
   */
  getStreamUrl(sessionId: string): string {
    return `${API_BASE_URL}/sessions/${sessionId}/stream`
  }
}
