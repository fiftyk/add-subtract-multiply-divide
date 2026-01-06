/**
 * Web Server for fn-orchestrator
 *
 * Provides SSE endpoint for A2UI rendering and REST API for user actions.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { WebRendererImpl } from './WebA2UIRenderer.js';
import type { A2UIUserAction } from '../a2ui/types.js';
import { webContainer } from '../container/index.js';
import { Planner } from '../planner/interfaces/IPlanner.js';
import { Executor } from '../executor/interfaces/Executor.js';
import { ConfigManager } from '../config/index.js';
import { Storage } from '../storage/interfaces/Storage.js';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { LocalFunctionProvider } from '../function-provider/LocalFunctionProvider.js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { promises as fs } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let app: FastifyInstance;

async function createApp(): Promise<FastifyInstance> {
  const instance = Fastify({ logger: true });

  // Register plugins
  await instance.register(cors, {
    origin: true,
    credentials: true,
  });

  // Serve Vue app static files (only actual files with extensions)
  // This should NOT match /plans, /tools, etc.
  await instance.register(staticPlugin, {
    root: join(__dirname, '../../../web/dist'),
    prefix: '/',
    wildcard: false,
    // Only serve files that are actual assets (not API routes)
    allowedPath: (pathname) => {
      // Exclude API routes and SSE endpoints
      if (pathname.startsWith('/api/') || pathname.startsWith('/sse/')) {
        return false;
      }
      // Allow all other paths (static files will return 404 if not found)
      return true;
    },
  });

  return instance;
}

// Create web renderer (singleton)
const webRenderer = new WebRendererImpl();

// Store renderer for access by commands
let globalRenderer: WebRendererImpl | null = null;
export function getWebRenderer(): WebRendererImpl {
  if (!globalRenderer) {
    globalRenderer = webRenderer;
  }
  return globalRenderer;
}

/**
 * Load local functions from the functions directory
 */
async function loadLocalFunctions(): Promise<void> {
  try {
    // Try to load from the functions index file
    const functionsPath = resolve(process.cwd(), 'dist/functions/index.js');

    try {
      await fs.access(functionsPath);
    } catch {
      // Functions not built yet, skip loading
      console.log('Local functions not found (dist/functions/index.js not built)');
      return;
    }

    // Dynamic import functions
    const module = await import(functionsPath);

    // Get LocalFunctionProvider from container
    const localProvider = webContainer.get<LocalFunctionProvider>(LocalFunctionProvider);

    // Register all exported functions
    for (const key of Object.keys(module)) {
      const fn = module[key];
      if (isFunctionDefinition(fn)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          localProvider.register(fn as any);
          console.log(`Loaded local function: ${fn.name}`);
        } catch (error) {
          // Ignore duplicate registration errors
        }
      }
    }

    const count = (await localProvider.list()).filter(f => f.type === 'local').length;
    console.log(`Loaded ${count} local functions`);
  } catch (error) {
    console.warn('Failed to load local functions:', error);
  }
}

/**
 * Check if an object is a valid FunctionDefinition (runtime check)
 */
function isFunctionDefinition(obj: unknown): obj is {
  name: string;
  description: string;
  scenario: string;
  parameters: Array<{ name: string; type: string; description: string }>;
  returns: { type: string; description: string };
  implementation: Function;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const fn = obj as Record<string, unknown>;
  return (
    typeof fn.name === 'string' &&
    typeof fn.description === 'string' &&
    typeof fn.scenario === 'string' &&
    Array.isArray(fn.parameters) &&
    fn.parameters.length > 0 &&
    typeof (fn.parameters[0] as Record<string, unknown>).name === 'string' &&
    typeof fn.returns === 'object' &&
    typeof fn.implementation === 'function'
  );
}

export async function startWebServer(port: number = 3001): Promise<void> {
  app = await createApp();

  // Initialize ConfigManager for web mode
  ConfigManager.initialize({});

  // Load local functions
  await loadLocalFunctions();

  // Create web renderer and register routes
  const renderer = getWebRenderer();

  // SSE endpoint for A2UI streaming
  app.get('/sse/stream', async (request, reply) => {
    const rawResponse = reply.raw;

    // Set SSE headers
    rawResponse.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const clientId = renderer.registerClient(request.raw, rawResponse);
    request.raw.on('close', () => {
      renderer.unregisterClient(clientId);
    });

    // Keep connection open - don't call reply.send()
    // The connection is handled by the renderer
  });

  // REST API for user actions
  app.post('/api/action', async (request, reply) => {
    const action = request.body as A2UIUserAction;
    renderer.handleUserAction(action);
    return { success: true };
  });

  // Plan endpoint - Create a new execution plan
  app.post('/api/plan', async (request, reply) => {
    const { request: userRequest } = request.body as {
      request: string;
    };

    try {
      const planner = webContainer.get<Planner>(Planner);

      // Broadcast planning start via SSE
      renderer.update('main', [
        {
          id: 'planning-status',
          component: {
            Progress: { value: 0, label: '正在生成计划...' }
          }
        }
      ]);

      const result = await planner.plan(userRequest);

      if (!result.success || !result.plan) {
        throw new Error(result.error || 'Failed to create plan');
      }

      const plan = result.plan;

      // Broadcast plan result via SSE
      renderer.update('main', [
        {
          id: 'planning-status',
          component: {
            Progress: { value: 100, label: '计划生成完成' }
          }
        },
        {
          id: 'plan-result',
          component: {
            Card: {
              title: `执行计划: ${plan.id}`,
              children: ['plan-content']
            }
          }
        },
        {
          id: 'plan-content',
          component: {
            Text: { text: JSON.stringify(plan, null, 2), style: 'code' }
          }
        }
      ]);

      return {
        success: true,
        plan: {
          id: plan.id,
          steps: plan.steps,
          description: plan.userRequest
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      renderer.update('main', [
        {
          id: 'planning-status',
          component: {
            Badge: { text: '计划生成失败', variant: 'error' }
          }
        },
        {
          id: 'plan-error',
          component: {
            Text: { text: `错误: ${errorMessage}`, style: 'default' }
          }
        }
      ]);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // Get single plan by ID
  app.get('/api/plan/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const storage = webContainer.get<Storage>(Storage);
      const plan = await storage.loadPlan(id);

      if (!plan) {
        return reply.status(404).send({ success: false, error: 'Plan not found' });
      }

      return {
        success: true,
        plan: {
          id: plan.id,
          userRequest: plan.userRequest,
          steps: plan.steps,
          status: plan.status,
          createdAt: plan.createdAt,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // Execute endpoint - Execute a plan
  app.post('/api/execute', async (request, reply) => {
    const { planId, planData } = request.body as {
      planId: string;
      planData: any;
    };

    try {
      const executor = webContainer.get<Executor>(Executor);

      // Broadcast execution start via SSE
      renderer.update('main', [
        {
          id: 'execution-status',
          component: {
            Progress: { value: 0, label: '开始执行...' }
          }
        }
      ]);

      const execution = await executor.execute(planData);

      // Broadcast execution result via SSE
      const results = execution.steps.map((step, index) => ({
        id: `step-${index}`,
        component: {
          Card: {
            title: `步骤 ${index + 1}`,
            children: [`step-${index}-result`]
          }
        }
      } as any));

      const resultTexts = execution.steps.map((step, index) => {
        // Get result based on step type
        let resultText: string;
        if ('functionName' in step) {
          resultText = step.error ? `错误: ${step.error}` : `结果: ${JSON.stringify(step.result)}`;
        } else if ('values' in step) {
          resultText = `输入: ${JSON.stringify(step.values)}`;
        } else {
          resultText = step.error ? `错误: ${step.error}` : '完成';
        }
        return {
          id: `step-${index}-result`,
          component: {
            Text: {
              text: resultText,
              style: step.error ? 'caption' : 'code'
            }
          }
        };
      });

      renderer.update('main', [
        ...results,
        ...resultTexts,
        {
          id: 'execution-status',
          component: {
            Badge: {
              text: execution.success ? '执行成功' : '执行失败',
              variant: execution.success ? 'success' : 'error'
            }
          }
        }
      ]);

      return {
        success: execution.success,
        execution: {
          id: execution.planId,
          steps: execution.steps.map((s, i) => ({
            index: i,
            type: s.type,
            success: s.success,
            error: s.error
          }))
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // List all plans
  app.get('/api/plans', async () => {
    try {
      const storage = webContainer.get<Storage>(Storage);
      const plans = await storage.listPlans();
      return {
        plans: plans.map((plan) => ({
          id: plan.id,
          userRequest: plan.userRequest,
          steps: plan.steps,
          status: plan.status || 'pending',
          createdAt: new Date().toISOString(),
        })),
      };
    } catch (error) {
      console.error('Failed to list plans:', error);
      return { plans: [] };
    }
  });

  // List available tools/functions
  app.get('/api/tools', async () => {
    try {
      const functionProvider = webContainer.get<FunctionProvider>(FunctionProvider);
      const tools = await functionProvider.list();
      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          type: tool.source,
          description: tool.description,
          parameters: tool.parameters,
          returns: tool.returns,
        })),
      };
    } catch (error) {
      console.error('Failed to list tools:', error);
      return { tools: [] };
    }
  });

  // SPA fallback: Serve index.html for any route that doesn't match API or assets
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.url || '';
    // API routes, SSE should return 404
    if (url.startsWith('/api') || url.startsWith('/sse')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    // Serve Vue app for all other routes (SPA support)
    const indexPath = join(__dirname, '../../../web/dist/index.html');
    // Use reply.type to set content type and send the HTML content directly
    const fs = await import('fs');
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return reply.type('text/html').send(content);
    } catch (error) {
      console.error('Failed to serve index.html:', error);
      return reply.status(404).send({ error: 'Web app not built. Run: cd web && npm run build' });
    }
  });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', clients: renderer.getClientIds().length };
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server using Fastify's native listen
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🌐 Web server running at http://localhost:${port}`);
  console.log(`   SSE endpoint: http://localhost:${port}/sse/stream`);
  console.log(`   API endpoint: http://localhost:${port}/api/`);
}

export { app, webRenderer };
