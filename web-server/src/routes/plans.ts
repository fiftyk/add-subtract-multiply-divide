import type { FastifyInstance } from 'fastify';
import type { ListPlansResponse, GetPlanResponse } from '../types/sse.js';
import { coreBridge } from '../services/CoreBridge.js';

/**
 * Plans API Routes
 * Handles plan listing and retrieval
 */
export default async function plansRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plans
   * List all available plans
   */
  fastify.get('/', async (request, reply) => {
    try {
      const plans = await coreBridge.listPlans();

      return {
        plans: plans.map(p => ({
          id: p.id,
          userRequest: p.userRequest,
          status: p.status,
          createdAt: p.createdAt || new Date().toISOString()
        }))
      };
    } catch (error) {
      console.error('Error listing plans:', error);
      return reply.status(500).send({
        error: 'Failed to list plans',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/plans/:id
   * Get a specific plan by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id: planId } = request.params;

      try {
        const plan = await coreBridge.getPlan(planId);

        return {
          plan
        };
      } catch (error) {
        console.error('Error loading plan:', error);
        return reply.status(404).send({
          error: 'Plan not found',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
