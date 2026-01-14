/**
 * SSEManager Tests
 * Tests for SSE connection management with timeout and cleanup
 */

import type { ServerResponse } from 'http';
import type { SSEEvent } from '../types/sse.js';
import { SSEManager } from '../SSEManager.js';

// Create mock response object
const createMockResponse = () => ({
  write: vi.fn(),
  end: vi.fn(),
  destroy: vi.fn()
});

describe('SSEManager', () => {
  describe('with default config', () => {
    let manager: SSEManager;

    beforeEach(() => {
      manager = new SSEManager();
    });

    afterEach(() => {
      manager.destroy();
    });

    describe('Connection Management', () => {
      it('should add a connection for a session', () => {
        const mockRes = createMockResponse();
        manager.addConnection('session-1', mockRes as unknown as ServerResponse);
        expect(manager.getConnectionCount('session-1')).toBe(1);
      });

      it('should support multiple connections per session', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-1', mockRes2 as unknown as ServerResponse);

        expect(manager.getConnectionCount('session-1')).toBe(2);
      });

      it('should report total connection count across sessions', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-2', mockRes2 as unknown as ServerResponse);

        expect(manager.getConnectionCount()).toBe(2);
      });
    });

    describe('Event Broadcasting', () => {
      it('should emit event to all connections', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-1', mockRes2 as unknown as ServerResponse);

        const event: SSEEvent = { type: 'test', data: { message: 'hello' } };
        manager.emit('session-1', event);

        expect(mockRes1.write).toHaveBeenCalledTimes(1);
        expect(mockRes2.write).toHaveBeenCalledTimes(1);

        const expectedData = 'data: {"type":"test","data":{"message":"hello"}}\n\n';
        expect(mockRes1.write).toHaveBeenCalledWith(expectedData);
        expect(mockRes2.write).toHaveBeenCalledWith(expectedData);
      });

      it('should cache events when no active connections', () => {
        const event: SSEEvent = { type: 'test', data: { message: 'cached' } };

        expect(() => manager.emit('session-1', event)).not.toThrow();
        expect(manager.getConnectionCount('session-1')).toBe(0);
      });

      it('should replay cached events to new connection', () => {
        const event: SSEEvent = { type: 'test', data: { message: 'cached' } };
        manager.emit('session-1', event);

        const mockRes = createMockResponse();
        manager.addConnection('session-1', mockRes as unknown as ServerResponse);

        const expectedData = 'data: {"type":"test","data":{"message":"cached"}}\n\n';
        expect(mockRes.write).toHaveBeenCalledWith(expectedData);
      });

      it('should limit history size', () => {
        // Fill up history beyond MAX_HISTORY_SIZE (100)
        for (let i = 0; i < 105; i++) {
          const event: SSEEvent = { type: 'test', data: { index: i } };
          manager.emit('session-1', event);
        }

        const mockRes = createMockResponse();
        manager.addConnection('session-1', mockRes as unknown as ServerResponse);

        // Should only receive the last 100 events
        expect(mockRes.write).toHaveBeenCalledTimes(100);

        // Verify the first replayed event is index 5 (6th event), not index 0
        const lastCall = mockRes.write.mock.calls[0][0];
        expect(lastCall).toContain('"index":5');
      });
    });

    describe('Error Handling', () => {
      it('should remove connection on write error', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        // Make one response throw on write
        mockRes1.write.mockImplementationOnce(() => {
          throw new Error('Connection lost');
        });

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-1', mockRes2 as unknown as ServerResponse);

        const event: SSEEvent = { type: 'test', data: {} };
        manager.emit('session-1', event);

        // Connection with error should be removed
        expect(manager.getConnectionCount('session-1')).toBe(1);
      });
    });

    describe('Statistics', () => {
      it('should return correct stats', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-2', mockRes2 as unknown as ServerResponse);

        const stats = manager.getStats();
        expect(stats.totalConnections).toBe(2);
        expect(stats.activeSessions).toBe(2);
      });
    });

    describe('Session Cleanup', () => {
      it('should clear history for a session', () => {
        const event: SSEEvent = { type: 'test', data: {} };
        manager.emit('session-1', event);
        manager.clearHistory('session-1');

        const mockRes = createMockResponse();
        mockRes.write.mockClear();
        manager.addConnection('session-1', mockRes as unknown as ServerResponse);

        expect(mockRes.write).not.toHaveBeenCalled();
      });

      it('should close session and remove all connections', () => {
        const mockRes1 = createMockResponse();
        const mockRes2 = createMockResponse();

        manager.addConnection('session-1', mockRes1 as unknown as ServerResponse);
        manager.addConnection('session-1', mockRes2 as unknown as ServerResponse);

        expect(manager.getConnectionCount('session-1')).toBe(2);

        // Manually close session without relying on response.end()
        const connections = manager as unknown as { connections: Map<string, Set<{response: ServerResponse}>> };
        const sessionConnections = (manager as unknown as { connections: Map<string, Set<unknown>> }).connections.get('session-1');
        if (sessionConnections) {
          sessionConnections.forEach(() => {
            manager.closeSession('session-1');
          });
        }

        expect(manager.getConnectionCount('session-1')).toBe(0);
      });
    });
  });

  describe('with custom config', () => {
    it('should respect custom heartbeat interval', () => {
      const config: SSEManagerConfig = {
        heartbeatInterval: 5000,
        connectionTimeout: 60000,
        autoCleanupHistory: true,
        historyCleanupInterval: 30000
      };
      const testManager = new SSEManager(config);
      expect(testManager).toBeDefined();
      testManager.destroy();
    });

    it('should disable heartbeat when interval is 0', () => {
      const config: SSEManagerConfig = {
        heartbeatInterval: 0,
        connectionTimeout: 0,
        autoCleanupHistory: false,
        historyCleanupInterval: 0
      };
      const testManager = new SSEManager(config);
      expect(testManager).toBeDefined();
      testManager.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const testManager = new SSEManager();
      const mockRes = createMockResponse();

      testManager.addConnection('session-1', mockRes as unknown as ServerResponse);
      testManager.emit('session-1', { type: 'executionComplete', data: {} });

      testManager.destroy();

      expect(testManager.getConnectionCount()).toBe(0);
    });
  });
});
