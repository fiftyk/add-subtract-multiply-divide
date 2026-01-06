/**
 * Web Server for fn-orchestrator
 *
 * Provides SSE endpoint for A2UI rendering and REST API for user actions.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { WebRendererImpl } from './WebA2UIRenderer.js';
import type { A2UIUserAction, ExecutionStatus } from '../a2ui/types.js';
import { webContainer } from '../container/index.js';
import { Planner } from '../planner/interfaces/IPlanner.js';
import { Executor } from '../executor/interfaces/Executor.js';
import { ConfigManager } from '../config/index.js';
import { Storage } from '../storage/interfaces/Storage.js';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import type { LocalFunctionProvider } from '../function-provider/LocalFunctionProvider.js';
import { LocalFunctionProviderSymbol } from '../function-provider/symbols.js';
import { ExecutionSessionStore } from '../executor/session/interfaces/SessionStore.js';
import { InterruptibleExecutor } from '../executor/interfaces/InterruptibleExecutor.js';
import type { ExecutionSession } from '../executor/session/types.js';
import type { ExecutionResult, UserInputResult } from '../executor/types.js';
import { StepType } from '../planner/types.js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { promises as fsP, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use project root for static files - works both in dev (tsx) and production (compiled)
function getWebDistPath(): string {
  // In production: __dirname is dist/src/web, go up 3 levels to project root
  // dist/src/web -> dist/src -> dist -> project root
  const projectRoot = resolve(__dirname, '../../..');
  const prodPath = join(projectRoot, 'web/dist');

  // In dev mode: use cwd (should be project root when running tsx from project root)
  const devPath = join(process.cwd(), 'web/dist');

  // Prefer prod path first (more reliable)
  if (existsSync(join(prodPath, 'index.html'))) {
    return prodPath;
  }

  // Fall back to dev path
  if (existsSync(join(devPath, 'index.html'))) {
    return devPath;
  }

  // Last resort: try projectRoot/web/dist
  return prodPath;
}

let app: FastifyInstance;

async function createApp(): Promise<FastifyInstance> {
  const instance = Fastify({ logger: true });

  // Register plugins
  await instance.register(cors, {
    origin: true,
    credentials: true,
  });

  // Serve Vue app static files (only actual files with extensions)
  await instance.register(staticPlugin, {
    root: getWebDistPath(),
    prefix: '/',
    wildcard: false,
    // Only serve files that exist (extensions must be valid)
    allowedPath: (pathname) => {
      // API routes and SSE endpoints should not be served as static files
      if (pathname.startsWith('/api/') || pathname.startsWith('/sse/')) {
        return false;
      }
      // Check if it looks like a file path (has extension)
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname);
      return hasExtension;
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
      await fsP.access(functionsPath);
    } catch {
      // Functions not built yet, skip loading
      console.log('Local functions not found (dist/functions/index.js not built)');
      return;
    }

    // Dynamic import functions
    const module = await import(functionsPath);

    // Get LocalFunctionProvider from container using the correct Symbol
    const localProvider = webContainer.get<LocalFunctionProvider>(LocalFunctionProviderSymbol);

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

    const count = (await localProvider.list()).filter((f: { type: string }) => f.type === 'local').length;
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

  // ========== Session API (for interruptible execution) ==========

  // Session SSE endpoint - dedicated stream for a session
  const sessionStreams = new Map<string, Set<(message: string) => void>>();

  function broadcastToSession(sessionId: string, message: object): void {
    const streams = sessionStreams.get(sessionId);
    if (streams) {
      const data = JSON.stringify(message);
      for (const send of streams) {
        try {
          send(data);
        } catch {
          // Stream closed, remove it
          streams.delete(send);
        }
      }
    }
  }

  app.get('/sse/session/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rawResponse = reply.raw;

    // Set SSE headers
    rawResponse.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    rawResponse.write(`data: ${JSON.stringify({ type: 'connected', sessionId: id })}\n\n`);

    // Add this stream to the session's broadcast set
    if (!sessionStreams.has(id)) {
      sessionStreams.set(id, new Set());
    }
    const streams = sessionStreams.get(id)!;
    const send = (data: string) => rawResponse.write(`data: ${data}\n\n`);
    streams.add(send);

    // Remove stream on close
    request.raw.on('close', () => {
      streams.delete(send);
      if (streams.size === 0) {
        sessionStreams.delete(id);
      }
    });

    // Keep connection open
  });

  // Start a new execution session
  app.post('/api/session/start', async (request, reply) => {
    const { planData } = request.body as { planData: any };

    try {
      const sessionStore = webContainer.get<ExecutionSessionStore>(ExecutionSessionStore);
      const executor = webContainer.get<InterruptibleExecutor>(InterruptibleExecutor);

      const sessionId = `session-${randomUUID().slice(0, 8)}`;

      const session: ExecutionSession = {
        id: sessionId,
        plan: planData,
        status: 'running',
        currentStepId: 0,
        stepResults: [],
        context: {},
        pendingInput: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await sessionStore.saveSession(session);

      // Notify via session SSE
      broadcastToSession(sessionId, {
        type: 'executionStart',
        sessionId,
        planId: planData.id,
      });

      // Execute asynchronously with callbacks
      executor.execute(session, {
        onStepComplete: async (stepResult) => {
          await sessionStore.updateSession(sessionId, {
            currentStepId: stepResult.stepId + 1,
            stepResults: [...session.stepResults, stepResult],
          });
          broadcastToSession(sessionId, {
            type: 'stepComplete',
            sessionId,
            stepId: stepResult.stepId,
            success: stepResult.success,
          });
        },
        onInputRequired: async (surfaceId, schema) => {
          await sessionStore.updateSession(sessionId, {
            status: 'waiting_input',
            pendingInput: { surfaceId, stepId: session.currentStepId, schema },
          });
          broadcastToSession(sessionId, {
            type: 'formRequest',
            sessionId,
            surfaceId,
            stepId: session.currentStepId,
            schema,
          });

          // Wait for input by polling session state
          // In a real implementation, this would use a Promise that resolves when input is submitted
          // For now, we'll use a simple polling mechanism
          const startTime = Date.now();
          const timeout = 300000; // 5 minutes

          while (Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const updated = await sessionStore.loadSession(sessionId);
            if (updated && updated.pendingInput === null) {
              // Input was submitted
              const lastResult = updated.stepResults[updated.stepResults.length - 1];
              if (lastResult && lastResult.type === StepType.USER_INPUT) {
                return (lastResult as UserInputResult).values;
              }
            }
            // Check if session failed or completed
            if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
              throw new Error('Session ended while waiting for input');
            }
          }

          throw new Error('Input timeout');
        },
      }).then(async (result) => {
        await sessionStore.updateSession(sessionId, {
          status: result.success ? 'completed' : 'failed',
        });
        broadcastToSession(sessionId, {
          type: 'executionComplete',
          sessionId,
          success: result.success,
          result,
        });
      }).catch(async (error) => {
        await sessionStore.updateSession(sessionId, {
          status: 'failed',
        });
        broadcastToSession(sessionId, {
          type: 'executionError',
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return { success: true, sessionId, status: 'running' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // Submit user input for a session
  app.post('/api/session/:id/input', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { values } = request.body as { values: Record<string, unknown> };

    try {
      const sessionStore = webContainer.get<ExecutionSessionStore>(ExecutionSessionStore);
      const session = await sessionStore.loadSession(id);

      if (!session) {
        return reply.status(404).send({ success: false, error: 'Session not found' });
      }

      if (!session.pendingInput) {
        return reply.status(400).send({ success: false, error: 'No pending input' });
      }

      // Create input result
      const inputResult: UserInputResult = {
        stepId: session.pendingInput.stepId,
        type: StepType.USER_INPUT,
        values,
        success: true,
        timestamp: Date.now(),
        executedAt: new Date().toISOString(),
      };

      // Update session
      await sessionStore.updateSession(id, {
        status: 'running',
        currentStepId: session.pendingInput.stepId + 1,
        stepResults: [...session.stepResults, inputResult],
        pendingInput: null,
      });

      broadcastToSession(id, {
        type: 'inputReceived',
        sessionId: id,
        stepId: session.pendingInput.stepId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // Get session status
  app.get('/api/session/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const sessionStore = webContainer.get<ExecutionSessionStore>(ExecutionSessionStore);
      const session = await sessionStore.loadSession(id);

      if (!session) {
        return reply.status(404).send({ success: false, error: 'Session not found' });
      }

      return {
        success: true,
        session: {
          id: session.id,
          status: session.status,
          currentStepId: session.currentStepId,
          stepCount: session.plan.steps.length,
          pendingInput: session.pendingInput,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // List all sessions
  app.get('/api/sessions', async () => {
    try {
      const sessionStore = webContainer.get<ExecutionSessionStore>(ExecutionSessionStore);
      const sessions = await sessionStore.listSessions();
      return {
        sessions: sessions.map((s) => ({
          id: s.id,
          status: s.status,
          currentStepId: s.currentStepId,
          stepCount: s.plan.steps.length,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      };
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return { sessions: [] };
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

  // SPA fallback: Serve index.html for frontend routes (not API, SSE, or static files)
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.url || '';

    // API routes, SSE should return 404
    if (url.startsWith('/api') || url.startsWith('/sse')) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Static files (with extensions) should return 404 if not found
    if (/\.[a-zA-Z0-9]+$/.test(url)) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Serve Vue app for frontend routes (SPA support)
    const indexPath = join(getWebDistPath(), 'index.html');
    try {
      const content = await fsP.readFile(indexPath, 'utf-8');
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
