/**
 * Functions API Routes
 * Handles function listing, searching, and categorization
 */

import type { FastifyInstance } from 'fastify';
// @ts-ignore - Importing from parent project's dist folder
import container from '../../../dist/src/container/cli-container.js';
// @ts-ignore - Importing from parent project's dist folder
import type { FunctionsService as IFunctionsService } from '../../../dist/src/functions-service/index.js';
// @ts-ignore - Importing from parent project's dist folder
import { FunctionsService } from '../../../dist/src/functions-service/index.js';
// @ts-ignore - Importing from parent project's dist folder
import { FunctionProvider } from '../../../dist/src/function-provider/interfaces/FunctionProvider.js';

// Helper to get FunctionsService from container (lazy evaluation)
function getFunctionsService(): IFunctionsService {
  return container.get<IFunctionsService>(FunctionsService as any);
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
   * List all functions with optional filtering
   *
   * Query parameters:
   * - type: 'local' | 'remote' (optional)
   * - source: source identifier (optional)
   * - limit: number (optional)
   * - offset: number (optional)
   */
  fastify.get('/', async (request, reply) => {
    try {
      const functionsService = getFunctionsService();
      const { type, source, limit, offset } = request.query as {
        type?: 'local' | 'remote';
        source?: string;
        limit?: string;
        offset?: string;
      };

      const functions = await functionsService.listFunctions({
        type,
        source,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });

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
   * Search functions
   *
   * Query parameters:
   * - q: search query (required)
   * - type: 'local' | 'remote' (optional)
   * - source: source identifier (optional)
   * - limit: number (optional)
   * - offset: number (optional)
   */
  fastify.get('/search', async (request, reply) => {
    try {
      const functionsService = getFunctionsService();
      const { q, type, source, limit, offset } = request.query as {
        q?: string;
        type?: 'local' | 'remote';
        source?: string;
        limit?: string;
        offset?: string;
      };

      if (!q) {
        return reply.status(400).send({
          error: 'Missing query parameter',
          message: 'Query parameter "q" is required',
        });
      }

      const result = await functionsService.search({
        query: q,
        type,
        source,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });

      return result;
    } catch (error) {
      console.error('Error searching functions:', error);
      return reply.status(500).send({
        error: 'Failed to search functions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/suggest
   * Get search suggestions (autocomplete)
   *
   * Query parameters:
   * - q: search query (required)
   * - limit: number (optional, default: 10)
   */
  fastify.get('/suggest', async (request, reply) => {
    try {
      const functionsService = getFunctionsService();
      const { q, limit } = request.query as {
        q?: string;
        limit?: string;
      };

      if (!q) {
        return reply.status(400).send({
          error: 'Missing query parameter',
          message: 'Query parameter "q" is required',
        });
      }

      const suggestions = await functionsService.suggest(
        q,
        limit ? parseInt(limit, 10) : undefined
      );

      return {
        suggestions,
      };
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return reply.status(500).send({
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/categories
   * List all function categories
   */
  fastify.get('/categories', async (request, reply) => {
    try {
      const functionsService = getFunctionsService();
      const categories = await functionsService.listCategories();

      return {
        categories,
      };
    } catch (error) {
      console.error('Error listing categories:', error);
      return reply.status(500).send({
        error: 'Failed to list categories',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/functions/categories/:id
   * Get a specific category
   */
  fastify.get<{ Params: { id: string } }>(
    '/categories/:id',
    async (request, reply) => {
      const functionsService = getFunctionsService();
      const { id } = request.params;

      try {
        const category = await functionsService.getCategory(id);

        if (!category) {
          return reply.status(404).send({
            error: 'Category not found',
            message: `Category "${id}" does not exist`,
          });
        }

        return {
          category,
        };
      } catch (error) {
        console.error('Error getting category:', error);
        return reply.status(500).send({
          error: 'Failed to get category',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/functions/categories/:id/functions
   * Get functions in a specific category
   */
  fastify.get<{ Params: { id: string } }>(
    '/categories/:id/functions',
    async (request, reply) => {
      const functionsService = getFunctionsService();
      const { id } = request.params;

      try {
        const functions = await functionsService.getFunctionsByCategory(id);

        return {
          functions,
          total: functions.length,
        };
      } catch (error) {
        console.error('Error getting functions by category:', error);
        return reply.status(500).send({
          error: 'Failed to get functions by category',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/functions/categorized
   * Get all functions grouped by category
   */
  fastify.get('/categorized', async (request, reply) => {
    try {
      const functionsService = getFunctionsService();
      const categorized = await functionsService.getAllCategorized();

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
      const functionsService = getFunctionsService();
      const { name } = request.params;

      try {
        const fn = await functionsService.getFunction(name);

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
