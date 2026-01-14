import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sseManager } from '../services/SSEManager.js';
import { coreBridge } from '../services/CoreBridge.js';
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
   * GET /api/sessions
   * List sessions (optionally filtered by planId)
   */
  fastify.get<{ Querystring: { planId?: string } }>(
    '/',
    async (request, reply) => {
      const { planId } = request.query;

      try {
        const sessions = await coreBridge.listSessionsByPlan(planId);

        return {
          sessions: sessions.map(session => ({
            id: session.id,
            planId: session.planId,
            status: session.status,
            createdAt: session.createdAt,
            completedAt: session.completedAt,
            platform: session.platform
          }))
        };
      } catch (error) {
        console.error('Error listing sessions:', error);
        return reply.status(500).send({
          error: 'Failed to list sessions',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/sessions/execute
   * Create and start executing a session
   */
  fastify.post<{ Body: ExecuteSessionRequest }>(
    '/execute',
    async (request, reply) => {
      const { planId, platform = 'web' } = request.body;

      try {
        // 创建会话
        const session = await coreBridge.createAndExecuteSession(planId, platform);

        // 异步执行（不阻塞响应）
        coreBridge.executeSessionWithSSE(session.id).catch(err => {
          console.error(`Session ${session.id} execution error:`, err);
        });

        return {
          sessionId: session.id,
          status: session.status as 'pending'
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

      // Set SSE headers with CORS
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': request.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
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
        sseManager.removeConnectionByResponse(sessionId, reply.raw);
        console.log(`[SSE] Client disconnected from session ${sessionId}`);
      });

      request.raw.on('error', (error) => {
        console.error(`[SSE] Connection error for session ${sessionId}:`, error);
        clearInterval(heartbeatInterval);
        sseManager.removeConnectionByResponse(sessionId, reply.raw);
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
        console.log(`[API] Resume session ${sessionId} with data:`, inputData);

        // 恢复会话并继续执行（异步）
        coreBridge.resumeSessionWithSSE(sessionId, inputData).catch(err => {
          console.error(`Session ${sessionId} resume error:`, err);
        });

        return {
          status: 'resumed' as const
        };
      } catch (error) {
        console.error('Error resuming session:', error);
        return reply.status(500).send({
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
        // 从存储加载会话
        const session = await coreBridge.getSession(sessionId);

        return {
          session
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
