import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sseManager } from '../services/SSEManager.js';
import type {
  ExecuteSessionRequest,
  ExecuteSessionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  GetSessionResponse
} from '../types/sse.js';

/**
 * Sessions API Routes
 * Handles session execution, SSE streaming, and user input
 */
export default async function sessionsRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/sessions/execute
   * Create and start executing a session
   */
  fastify.post<{ Body: ExecuteSessionRequest }>(
    '/execute',
    async (request, reply) => {
      const { planId, platform = 'web' } = request.body;

      try {
        // TODO: Integrate with ExecutionSessionManager
        // const sessionManager = container.get<ExecutionSessionManager>(TYPES.ExecutionSessionManager);
        // const session = await sessionManager.createSession(planId, platform);

        // Mock response for now
        const sessionId = `session-${Date.now()}`;

        // Start execution asynchronously (don't await)
        // executeSessionAsync(sessionId).catch(err => {
        //   console.error(`Session ${sessionId} execution error:`, err);
        // });

        return {
          sessionId,
          status: 'pending' as const
        };
      } catch (error) {
        console.error('Error creating session:', error);
        return reply.status(500).send({
          error: 'Failed to create session',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/sessions/:id/stream
   * SSE endpoint for real-time execution updates
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/stream',
    async (request, reply) => {
      const { id: sessionId } = request.params;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      });

      // Register the connection
      sseManager.addConnection(sessionId, reply.raw);

      // Send initial connection confirmation
      reply.raw.write(': connected\n\n');

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          reply.raw.write(': heartbeat\n\n');
        } catch (error) {
          console.error('Heartbeat error:', error);
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on disconnect
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        sseManager.removeConnection(sessionId, reply.raw);
        console.log(`[SSE] Client disconnected from session ${sessionId}`);
      });

      request.raw.on('error', (error) => {
        console.error(`[SSE] Connection error for session ${sessionId}:`, error);
        clearInterval(heartbeatInterval);
        sseManager.removeConnection(sessionId, reply.raw);
      });
    }
  );

  /**
   * POST /api/sessions/:id/resume
   * Submit user input and resume execution
   */
  fastify.post<{
    Params: { id: string };
    Body: ResumeSessionRequest;
  }>(
    '/:id/resume',
    async (request, reply) => {
      const { id: sessionId } = request.params;
      const { inputData } = request.body;

      try {
        // TODO: Integrate with ExecutionSessionManager
        // const sessionManager = container.get<ExecutionSessionManager>(TYPES.ExecutionSessionManager);
        // await sessionManager.resumeSession(sessionId, inputData);

        console.log(`[API] Resume session ${sessionId} with data:`, inputData);

        // Send confirmation via SSE
        sseManager.emit(sessionId, {
          type: 'inputReceived',
          sessionId,
          stepId: 1, // TODO: Get from actual step
          status: 'accepted',
          timestamp: new Date().toISOString()
        });

        return {
          status: 'resumed' as const
        };
      } catch (error) {
        console.error('Error resuming session:', error);
        reply.status(500).send({
          status: 'error' as const,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/sessions/:id
   * Get session details
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id: sessionId } = request.params;

      try {
        // TODO: Integrate with ExecutionSessionStorage
        // const storage = container.get<ExecutionSessionStorage>(TYPES.ExecutionSessionStorage);
        // const session = await storage.loadSession(sessionId);

        // Mock response
        return {
          session: {
            id: sessionId,
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        };
      } catch (error) {
        console.error('Error loading session:', error);
        return reply.status(404).send({
          error: 'Session not found',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}

/**
 * Helper function to execute session asynchronously
 */
async function executeSessionAsync(sessionId: string): Promise<void> {
  // TODO: Implement actual execution logic
  console.log(`[Executor] Starting execution for session ${sessionId}`);

  // Emit execution start
  sseManager.emit(sessionId, {
    type: 'executionStart',
    sessionId,
    timestamp: new Date().toISOString()
  });

  // Mock execution flow
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Emit input request (for demo)
  sseManager.emit(sessionId, {
    type: 'inputRequested',
    sessionId,
    surfaceId: `form-${sessionId}`,
    stepId: 1,
    schema: {
      version: '1.0',
      fields: [
        {
          id: 'companyName',
          type: 'text',
          label: '公司名称',
          required: true,
          config: { placeholder: '例如：华为技术有限公司' }
        }
      ]
    },
    timestamp: new Date().toISOString()
  });
}
