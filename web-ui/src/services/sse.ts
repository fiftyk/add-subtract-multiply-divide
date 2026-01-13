import type { SSEEvent } from '../types'

export type SSEEventHandler = (event: SSEEvent) => void
export type SSEErrorHandler = (error: Event) => void

export class SSEConnection {
  private eventSource: EventSource | null = null
  private url: string
  private handlers: SSEEventHandler[] = []
  private errorHandlers: SSEErrorHandler[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(url: string) {
    this.url = url
  }

  /**
   * Connect to SSE stream
   */
  connect(): void {
    if (this.eventSource) {
      console.warn('[SSE] Already connected')
      return
    }

    console.log('[SSE] Connecting to', this.url)
    this.eventSource = new EventSource(this.url)

    this.eventSource.onopen = () => {
      console.log('[SSE] Connection established')
      this.reconnectAttempts = 0
    }

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data: SSEEvent = JSON.parse(event.data)
        console.log('[SSE] Event received:', data.type, data)
        this.handlers.forEach(handler => handler(data))
      } catch (error) {
        console.error('[SSE] Error parsing event:', error)
      }
    }

    this.eventSource.onerror = (error: Event) => {
      console.error('[SSE] Connection error:', error)
      this.errorHandlers.forEach(handler => handler(error))

      // Auto-reconnect logic
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        console.log(`[SSE] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

        setTimeout(() => {
          this.disconnect()
          this.connect()
        }, this.reconnectDelay * this.reconnectAttempts)
      } else {
        console.error('[SSE] Max reconnect attempts reached')
        this.disconnect()
      }
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      console.log('[SSE] Disconnecting')
      this.eventSource.close()
      this.eventSource = null
    }
  }

  /**
   * Add event handler
   */
  onEvent(handler: SSEEventHandler): void {
    this.handlers.push(handler)
  }

  /**
   * Add error handler
   */
  onError(handler: SSEErrorHandler): void {
    this.errorHandlers.push(handler)
  }

  /**
   * Remove event handler
   */
  offEvent(handler: SSEEventHandler): void {
    const index = this.handlers.indexOf(handler)
    if (index > -1) {
      this.handlers.splice(index, 1)
    }
  }

  /**
   * Remove error handler
   */
  offError(handler: SSEErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler)
    if (index > -1) {
      this.errorHandlers.splice(index, 1)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN
  }
}

/**
 * Create a new SSE connection
 */
export function createSSEConnection(url: string): SSEConnection {
  return new SSEConnection(url)
}
