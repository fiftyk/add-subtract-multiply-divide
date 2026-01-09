import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  origin: [FRONTEND_URL, 'http://localhost:3000'], // Allow self-origin for test page
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
 * Register routes (using dynamic imports to ensure ConfigManager is initialized first)
 */
const { default: sessionsRoutes } = await import('./routes/sessions.js');
const { default: plansRoutes } = await import('./routes/plans.js');

await fastify.register(sessionsRoutes, { prefix: '/api/sessions' });
await fastify.register(plansRoutes, { prefix: '/api/plans' });

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
      plans: '/api/plans'
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
