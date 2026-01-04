/**
 * A2UI Protocol Routes
 *
 * A2UI 协议路由
 * 支持 SSE 流式传输和 UI 组件渲染
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  A2UISession,
  A2UISessionFactory,
  SurfaceManager,
  UserActionMessage,
  MessageSender,
} from '../../a2ui/interfaces/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../errors/ApiErrors.js';
import { LoggerFactory } from '../../logger/index.js';

const router = Router();
const logger = LoggerFactory.create();

// 内存中存储 A2UI 会话信息
interface A2UISessionInfo {
  sessionId: string;
  orchestrationSessionId?: string;
  createdAt: string;
  surfaceId: string;
}

// 获取 A2UISessionFactory (with type safety)
const getSessionFactory = (req: Request): A2UISessionFactory => {
  if (!req.a2uiSessionFactory) {
    throw new Error('A2UISessionFactory not available');
  }
  return req.a2uiSessionFactory;
};

// 获取 MessageSender
const getMessageSender = (req: Request): MessageSender => {
  // MessageSender 通过 A2UI 容器绑定
  const factory = getSessionFactory(req);
  // 临时获取 session 来访问 messageSender
  const sessions = (factory as any).sessions;
  if (sessions && sessions.size > 0) {
    const firstSession = sessions.values().next().value;
    return (firstSession as any).messageSender;
  }
  throw new Error('MessageSender not available');
};

// 存储会话信息
const a2uiSessions: Map<string, A2UISessionInfo> = new Map();

// POST /api/a2ui/sessions - 创建新 A2UI 会话
router.post(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body || {};
    const { orchestrationSessionId } = body;

    const factory = getSessionFactory(req);
    const a2uiSession = factory.create();

    const surfaceId = `surface-${uuidv4().slice(0, 8)}`;
    a2uiSession.createSurface(surfaceId);

    const sessionInfo: A2UISessionInfo = {
      sessionId: a2uiSession.sessionId,
      orchestrationSessionId,
      createdAt: new Date().toISOString(),
      surfaceId,
    };

    a2uiSessions.set(a2uiSession.sessionId, sessionInfo);

    logger.info('A2UI session created', {
      a2uiSessionId: a2uiSession.sessionId,
      surfaceId,
    });

    res.json({
      success: true,
      data: {
        sessionId: a2uiSession.sessionId,
        surfaceId,
        createdAt: sessionInfo.createdAt,
      },
    });
  })
);

// GET /api/a2ui/sessions - 列出所有 A2UI 会话
router.get(
  '/sessions',
  asyncHandler(async (_req: Request, res: Response) => {
    const sessions = Array.from(a2uiSessions.values());
    res.json({ success: true, data: sessions });
  })
);

// GET /api/a2ui/sessions/:id - 获取 A2UI 会话详情
router.get(
  '/sessions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    res.json({
      success: true,
      data: {
        ...sessionInfo,
        exists: !!a2uiSession,
      },
    });
  })
);

// DELETE /api/a2ui/sessions/:id - 删除 A2UI 会话
router.delete(
  '/sessions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (a2uiSession) {
      a2uiSession.deleteSurface(sessionInfo.surfaceId);
    }

    a2uiSessions.delete(req.params.id);

    logger.info('A2UI session deleted', { sessionId: req.params.id });

    res.json({ success: true, message: 'Session deleted' });
  })
);

// POST /api/a2ui/sessions/:id/surface - 更新 Surface
router.post(
  '/sessions/:id/surface',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const body = req.body || {};
    const { components } = body;

    if (!Array.isArray(components)) {
      throw new ValidationError('components must be an array');
    }

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (!a2uiSession) {
      throw new NotFoundError('A2UI session not found');
    }

    a2uiSession.sendSurfaceUpdate(sessionInfo.surfaceId, components);

    res.json({ success: true, message: 'Surface updated' });
  })
);

// POST /api/a2ui/sessions/:id/datamodel - 更新数据模型
router.post(
  '/sessions/:id/datamodel',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const body = req.body || {};
    const path = body.path;

    // body 本身就是要更新的数据（不需要 data 包装）
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('data must be an object');
    }

    // 移除 path 字段，剩下的作为数据
    const data = { ...body };
    delete (data as Record<string, unknown>).path;

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (!a2uiSession) {
      throw new NotFoundError('A2UI session not found');
    }

    a2uiSession.sendDataModelUpdate(sessionInfo.surfaceId, data, path);

    res.json({ success: true, message: 'Data model updated' });
  })
);

// POST /api/a2ui/sessions/:id/render - 开始渲染
router.post(
  '/sessions/:id/render',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const body = req.body || {};
    const { catalogId, rootComponentId } = body;

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (!a2uiSession) {
      throw new NotFoundError('A2UI session not found');
    }

    a2uiSession.beginRendering(
      sessionInfo.surfaceId,
      catalogId || 'standard',
      rootComponentId || 'root'
    );

    res.json({ success: true, message: 'Rendering started' });
  })
);

// POST /api/a2ui/sessions/:id/actions - 处理用户动作
router.post(
  '/sessions/:id/actions',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body || {};
    const { actionName, surfaceId, sourceComponentId, context } = body;

    if (!actionName || !sourceComponentId) {
      throw new ValidationError('actionName and sourceComponentId are required');
    }

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (!a2uiSession) {
      throw new NotFoundError('A2UI session not found');
    }

    const action: UserActionMessage = {
      userAction: {
        name: actionName,
        surfaceId: surfaceId || 'main',
        sourceComponentId,
        timestamp: new Date().toISOString(),
        context: context || {},
      },
    };

    a2uiSession.handleUserAction(action);

    res.json({ success: true, message: 'Action handled' });
  })
);

// GET /api/a2ui/sessions/:id/events - 获取会话事件（轮询替代 SSE）
router.get(
  '/sessions/:id/events',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    res.json({
      success: true,
      data: {
        sessionId: req.params.id,
        surfaceId: sessionInfo.surfaceId,
        orchestrationSessionId: sessionInfo.orchestrationSessionId,
        createdAt: sessionInfo.createdAt,
      },
    });
  })
);

// GET /api/a2ui/sessions/:id/stream - SSE 流式传输
router.get(
  '/sessions/:id/stream',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = a2uiSessions.get(req.params.id);

    if (!sessionInfo) {
      throw new NotFoundError('A2UI session not found');
    }

    const factory = getSessionFactory(req);
    const a2uiSession = factory.getSession(req.params.id);

    if (!a2uiSession) {
      throw new NotFoundError('A2UI session not found');
    }

    // 设置 SSE 头部
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    res.flushHeaders();

    // 生成 SSE 连接 ID
    const sseId = `sse-${uuidv4().slice(0, 8)}`;

    // 创建 SSE 写入器
    const sseWriter = {
      write: (data: string): void => {
        res.write(data);
      },
      end: (): void => {
        res.end();
      },
    };

    // 注册 SSE 订阅
    const messageSender = getMessageSender(req);
    messageSender.registerSSESubscription(req.params.id, sseId, sseWriter);

    // 发送连接成功事件
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId: req.params.id, sseId })}\n\n`);

    // 处理客户端断开连接
    req.on('close', () => {
      messageSender.unregisterSSESubscription(req.params.id, sseId);
      logger.debug('SSE connection closed', { sessionId: req.params.id, sseId });
    });

    req.on('error', () => {
      messageSender.unregisterSSESubscription(req.params.id, sseId);
    });
  })
);

export { router as a2uiRouter };
