import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { injectable } from 'inversify';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Server Configuration
 */
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Create Fastify instance
 */
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

/**
 * Register plugins
 */

// CORS
await fastify.register(cors, {
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:3000'], // Allow multiple dev ports and self-origin for test page
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Static files for test page
await fastify.register(fastifyStatic, {
  root: join(__dirname, '../..'),
  prefix: '/',
  decorateReply: false
});

/**
 * Register routes (using dynamic imports to ensure ConfigManager is initialized after dotenv)
 */

// Import web server container (includes MockA2UIRenderer binding)
const { default: container } = await import('./container/web-server-container.js');

// Initialize CoreBridge early to load functions
const { getCoreBridge } = await import('./services/CoreBridge.js');

console.log('[WebServer] Initializing CoreBridge...');
const coreBridge = getCoreBridge(container);

// Wait for CoreBridge initialization to complete (including MCP connections)
await coreBridge.waitForInitialization();
console.log('[WebServer] CoreBridge initialized');

const { default: sessionsRoutes } = await import('./routes/sessions.js');
const { default: plansRoutes } = await import('./routes/plans.js');
const { default: functionsRoutes } = await import('./routes/functions.js');

await fastify.register(sessionsRoutes, { prefix: '/api/sessions' });
await fastify.register(plansRoutes, { prefix: '/api/plans' });
await fastify.register(functionsRoutes, { prefix: '/api/functions' });

/**
 * Health check endpoint
 */
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

/**
 * Root endpoint
 */
fastify.get('/', async (request, reply) => {
  return {
    name: 'fn-orchestrator-web-server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      sessions: '/api/sessions',
      plans: '/api/plans',
      functions: '/api/functions'
    }
  };
});

/**
 * Error handler
 */
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  reply.status(error.statusCode || 500).send({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode || 500
  });
});

/**
 * Start server
 */
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });

    console.log('\n🚀 Server started successfully!');
    console.log(`📡 API Server: http://localhost:${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`📝 Plans API: http://localhost:${PORT}/api/plans`);
    console.log(`🎯 Sessions API: http://localhost:${PORT}/api/sessions`);
    console.log(`⚡ Functions API: http://localhost:${PORT}/api/functions`);
    console.log(`🌐 CORS enabled for: ${FRONTEND_URL}`);
    console.log('\nPress Ctrl+C to stop\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');

  try {
    await fastify.close();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
start();
