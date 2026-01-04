/**
 * Web Server
 *
 * 基于 Express 的 Web API 服务
 * 提供 RESTful API 给前端调用
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import container from '../container.js';
import { OrchestrationService } from '../core/interfaces/OrchestrationService.js';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { plansRouter } from './routes/plans.js';
import { executeRouter } from './routes/execute.js';
import { functionsRouter } from './routes/functions.js';
import { interactiveRouter } from './routes/interactive.js';
import { a2uiRouter } from './routes/a2ui.js';
import { ConfigManager } from '../config/index.js';
import { WebSocketServerImpl } from './WebSocketServer.js';
import { InteractiveSession } from '../core/services/interfaces/InteractiveSession.js';
import type { InteractiveSessionService } from '../core/services/InteractiveSessionService.js';
import { A2UISessionFactory } from '../a2ui/interfaces/index.js';
import { LoggerFactory } from '../logger/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loadFunctionsFromDirectory } from '../cli/utils.js';
import { bindA2UIContainer } from '../a2ui/container.js';

// 初始化配置
ConfigManager.initialize();

const logger = LoggerFactory.create();

/**
 * 异步启动服务器
 */
async function startServer() {
  // 加载本地函数
  try {
    const functionProvider = container.get<FunctionProvider>(FunctionProvider);
    const functionsPath = process.env.FUNCTIONS_DIR || './dist/functions';

    logger.info('Loading local functions...', { path: functionsPath });
    await loadFunctionsFromDirectory(functionProvider, functionsPath);

    const allFunctions = await functionProvider.list();
    const localFunctions = allFunctions.filter(f => f.source === 'local');

    if (localFunctions.length > 0) {
      logger.info('Local functions loaded', {
        count: localFunctions.length,
        functions: localFunctions.map(f => f.name).join(', ')
      });
    } else {
      logger.warn('No local functions found', { path: functionsPath });
    }
  } catch (error) {
    logger.error('Failed to load local functions', error as Error);
    // 继续启动服务器，即使函数加载失败
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const WS_PORT = Number(process.env.WS_PORT) || 3001;

  // 速率限制
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 中间件
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json());
  app.use('/api/', limiter); // Apply rate limiting to API routes

  // 获取服务实例
  const orchestrationService = container.get<OrchestrationService>(OrchestrationService);
  const sessionService = container.get<InteractiveSessionService>(InteractiveSession);

  // 绑定 A2UI 容器
  bindA2UIContainer(container);
  const a2uiSessionFactory = container.get<A2UISessionFactory>(A2UISessionFactory);

  // 将服务挂载到 request 上供路由使用
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.orchestrationService = orchestrationService;
    req.sessionService = sessionService;
    req.a2uiSessionFactory = a2uiSessionFactory;
    next();
  });

  // API 路由
  app.use('/api/plans', plansRouter);
  app.use('/api/execute', executeRouter);
  app.use('/api/functions', functionsRouter);
  app.use('/api/interactive', interactiveRouter);
  app.use('/api/a2ui', a2uiRouter);

  // 健康检查
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 调试路由 - 列出所有已注册的路由
  app.get('/debug/routes', (_req: Request, res: Response) => {
    const routes: string[] = [];
    app._router.stack.forEach((layer: any) => {
      if (layer.route) {
        routes.push(`${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle?.stack) {
        layer.handle.stack.forEach((routeLayer: any) => {
          if (routeLayer.route) {
            const path = routeLayer.route.path;
            const methods = Object.keys(routeLayer.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${path}`);
          }
        });
      }
    });
    res.json({ routes });
  });

  // 错误处理中间���（必��在所有路由之后）
  app.use(errorHandler);

  // 启动服务器
  const server = app.listen(PORT, () => {
    logger.info('Web API server started', { port: PORT });
    logger.info('API endpoints available', {
      plans: `http://localhost:${PORT}/api/plans`,
      execute: `http://localhost:${PORT}/api/execute`,
      functions: `http://localhost:${PORT}/api/functions`,
      interactive: `http://localhost:${PORT}/api/interactive`,
      a2ui: `http://localhost:${PORT}/api/a2ui`,
      websocket: `ws://localhost:${WS_PORT}`,
    });
  });

  // 启动 WebSocket 服务器
  const wsServer = new WebSocketServerImpl(sessionService, WS_PORT);
  wsServer.start();

  // 优雅关闭
  process.on('SIGINT', () => {
    logger.info('Shutting down server...');
    wsServer.stop();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  return app;
}

// 启动服务器
startServer().catch((error) => {
  logger.error('Failed to start server', error as Error);
  process.exit(1);
});

export default startServer;
