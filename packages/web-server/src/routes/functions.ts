/**
 * Functions API Routes
 * Handles function listing, searching, and categorization
 */

import type { FastifyInstance } from 'fastify';
import container from '../container/web-server-container.js';
import type { FunctionService as IFunctionService } from '@fn-orchestrator/core/function-service/interfaces/FunctionService.js';
import { FunctionService } from '@fn-orchestrator/core/function-service/interfaces/FunctionService.js';
import { FunctionProvider } from '@fn-orchestrator/core/function-provider/interfaces/FunctionProvider.js';

// Helper to get FunctionService from container (lazy evaluation)
function getFunctionService(): IFunctionService {
  return container.get<IFunctionService>(FunctionService as any);
}

// Helper to get FunctionProvider from container (lazy evaluation)
function getFunctionProvider(): FunctionProvider {
  return container.get<FunctionProvider>((FunctionProvider as unknown) as symbol);
}

/**
 * Functions 路由
 */
export default async function functionsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/functions
   * List all functions
   */
  fastify.get('/', async (request, reply) => {
    try {
      const functionService = getFunctionService();
      const functions = await functionService.listFunctions();

      console.log(`[FunctionsRoute] Returning ${functions.length} functions`);

      return {
        functions,
        total: functions.length,
      };
    } catch (error) {
      console.error('Error listing functions:', error);
      return reply.status(500).send({
        error: 'Failed to list functions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/search
   * Search functions by name or description
   *
   * Query parameters:
   * - q: search query (required)
   * - type: filter by type (all/local/mcp), default: all
   */
  fastify.get('/search', async (request, reply) => {
    try {
      const functionService = getFunctionService();
      const { q, type = 'all' } = request.query as { q?: string; type?: string };

      if (!q) {
        return reply.status(400).send({
          error: 'Missing query parameter',
          message: 'Query parameter "q" is required',
        });
      }

      // Simple search implementation - filter functions by name/description
      const allFunctions = await functionService.listFunctions();
      const query = q.toLowerCase();

      // First filter by search query
      let results = allFunctions.filter(
        fn =>
          fn.name.toLowerCase().includes(query) ||
          fn.description.toLowerCase().includes(query)
      );

      // Then filter by type
      if (type === 'local') {
        results = results.filter(fn => fn.type === 'local');
      } else if (type === 'mcp') {
        results = results.filter(fn => fn.type === 'remote');
      }

      return {
        functions: results,
        total: results.length,
        query: q,
        type,
      };
    } catch (error) {
      console.error('Error searching functions:', error);
      return reply.status(500).send({
        error: 'Failed to search functions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/categorized
   * Get all functions grouped by category (local/remote)
   */
  fastify.get('/categorized', async (request, reply) => {
    try {
      const functionService = getFunctionService();
      const categorized = await functionService.getCategorizedFunctions();

      return {
        categorized,
      };
    } catch (error) {
      console.error('Error getting categorized functions:', error);
      return reply.status(500).send({
        error: 'Failed to get categorized functions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/:name
   * Get a specific function by name
   */
  fastify.get<{ Params: { name: string } }>(
    '/:name',
    async (request, reply) => {
      const functionService = getFunctionService();
      const { name } = request.params;

      try {
        const allFunctions = await functionService.listFunctions();
        const fn = allFunctions.find(f => f.name === name);

        if (!fn) {
          return reply.status(404).send({
            error: 'Function not found',
            message: `Function "${name}" does not exist`,
          });
        }

        return {
          function: fn,
        };
      } catch (error) {
        console.error('Error getting function:', error);
        return reply.status(500).send({
          error: 'Failed to get function',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/functions/execute
   * Execute a function with given parameters
   *
   * Body parameters:
   * - name: function name (required)
   * - params: parameters object (optional)
   */
  fastify.post<{
    Body: { name: string; params?: Record<string, unknown> }
  }>(
    '/execute',
    async (request, reply) => {
      const { name, params = {} } = request.body || {};

      if (!name) {
        return reply.status(400).send({
          error: 'Missing function name',
          message: 'Function name is required in request body',
        });
      }

      console.log(`[FunctionsRoute] Executing function: ${name}`, params);

      try {
        const functionProvider = getFunctionProvider();
        const result = await functionProvider.execute(name, params);

        return {
          success: true,
          functionName: name,
          result: result.result,
          executionTime: result.metadata?.executionTime,
        };
      } catch (error) {
        console.error(`Error executing function "${name}":`, error);
        return reply.status(500).send({
          success: false,
          error: 'Function execution failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          functionName: name,
        });
      }
    }
  );
}
