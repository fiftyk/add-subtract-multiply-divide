/**
 * Interactive A2UI Routes
 *
 * 交互式 A2UI 会话路由
 * 支持通过 A2UI 协议执行计划并在执行过程中与用户交互
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import container from '../../container.js';
import { InteractiveSession } from '../../core/services/interfaces/InteractiveSession.js';
import { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../errors/ApiErrors.js';
import { LoggerFactory } from '../../logger/index.js';
import { A2UISessionFactory } from '../../a2ui/interfaces/index.js';
import { A2UIFormRenderer } from '../../a2ui/form/A2UIFormRenderer.js';

const router = Router();
const logger = LoggerFactory.create();
const formRenderer = new A2UIFormRenderer();

// 内存中存储交互式会话信息
interface InteractiveA2UISessionInfo {
  sessionId: string;
  a2uiSessionId: string;
  planId?: string;
  createdAt: string;
  status: string;
}

const interactiveSessions: Map<string, InteractiveA2UISessionInfo> = new Map();

// 获取 InteractiveSession
const getInteractiveSession = (): InteractiveSession => {
  return container.get<InteractiveSession>(InteractiveSession);
};

// 获取 OrchestrationService
const getOrchestrationService = (): OrchestrationService => {
  return container.get<OrchestrationService>(OrchestrationService);
};

// POST /api/interactive-a2ui/start - 启动交互式会话
router.post(
  '/start',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body || {};
    const { request, planId, confirmed } = body;

    if (!request && !planId) {
      throw new ValidationError('request or planId is required');
    }

    const orchestrationService = getOrchestrationService();
    const interactiveSession = getInteractiveSession();

    // 如果提供了 planId，获取计划
    let userRequest = request;
    if (planId) {
      const plan = await orchestrationService.getPlan(planId);
      if (!plan) {
        throw new NotFoundError(`Plan not found: ${planId}`);
      }
      userRequest = plan.userRequest;
    }

    // 启动会话
    const session = await interactiveSession.start(userRequest, planId);

    // 创建 A2UI 会话
    const a2uiSessionFactory = req.a2uiSessionFactory;
    if (!a2uiSessionFactory) {
      throw new Error('A2UISessionFactory not available');
    }

    const a2uiSession = a2uiSessionFactory.create();
    const surfaceId = `interactive-${session.id}`;
    a2uiSession.createSurface(surfaceId);

    // 存储会话信息
    const sessionInfo: InteractiveA2UISessionInfo = {
      sessionId: session.id,
      a2uiSessionId: a2uiSession.sessionId,
      planId: session.planId,
      createdAt: session.createdAt,
      status: session.status,
    };

    interactiveSessions.set(session.id, sessionInfo);

    logger.info('Interactive A2UI session started', {
      sessionId: session.id,
      a2uiSessionId: a2uiSession.sessionId,
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        a2uiSessionId: a2uiSession.sessionId,
        surfaceId,
        planId: session.planId,
        status: session.status,
        steps: session.steps,
      },
    });

    // 如果需要确认，发送确认请求
    if (session.status === 'pending' && confirmed) {
      await interactiveSession.confirm(session.id, true);
    }
  })
);

// POST /api/interactive-a2ui/:sessionId/confirm - 确认执行计划
router.post(
  '/:sessionId/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { confirmed } = req.body;

    const sessionInfo = interactiveSessions.get(sessionId);
    if (!sessionInfo) {
      throw new NotFoundError('Interactive session not found');
    }

    const interactiveSession = getInteractiveSession();
    await interactiveSession.confirm(sessionId, confirmed !== false);

    res.json({ success: true, message: confirmed === false ? 'Cancelled' : 'Execution started' });
  })
);

// GET /api/interactive-a2ui/:sessionId - 获取会话信息
router.get(
  '/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const sessionInfo = interactiveSessions.get(sessionId);
    if (!sessionInfo) {
      throw new NotFoundError('Interactive session not found');
    }

    const interactiveSession = getInteractiveSession();
    const session = await interactiveSession.getSession(sessionId);

    res.json({
      success: true,
      data: {
        ...sessionInfo,
        details: session,
      },
    });
  })
);

// GET /api/interactive-a2ui/:sessionId/pending-inputs - 获取待处理的输入
router.get(
  '/:sessionId/pending-inputs',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const sessionInfo = interactiveSessions.get(sessionId);
    if (!sessionInfo) {
      throw new NotFoundError('Interactive session not found');
    }

    const interactiveSession = getInteractiveSession();
    const pendingInputs = await interactiveSession.getPendingInputs(sessionId);

    // 转换为 A2UI 表单组件
    const forms: Array<{ stepId: number; surfaceId: string; components: object[] }> = [];

    for (const input of pendingInputs) {
      const surfaceId = `input-${sessionId}-${input.stepId}`;
      const components = formRenderer.render(
        {
          version: '1.0',
          fields: input.fields.map((f) => ({
            id: f.id,
            type: f.type as any,
            label: f.label,
            required: f.required,
          })),
        },
        `form-${input.stepId}`,
        `submit-${sessionId}-${input.stepId}`
      );

      forms.push({
        stepId: input.stepId,
        surfaceId,
        components,
      });
    }

    res.json({
      success: true,
      data: {
        inputs: pendingInputs,
        forms,
      },
    });
  })
);

// POST /api/interactive-a2ui/:sessionId/submit - 提交用户输入
router.post(
  '/:sessionId/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const body = req.body || {};
    const { stepId, values } = body;

    if (stepId === undefined) {
      throw new ValidationError('stepId is required');
    }

    const sessionInfo = interactiveSessions.get(sessionId);
    if (!sessionInfo) {
      throw new NotFoundError('Interactive session not found');
    }

    const interactiveSession = getInteractiveSession();
    const success = await interactiveSession.submitInput(sessionId, stepId, values || {});

    if (success) {
      res.json({ success: true, message: 'Input submitted' });
    } else {
      throw new Error('Failed to submit input');
    }
  })
);

// POST /api/interactive-a2ui/:sessionId/cancel - 取消会话
router.post(
  '/:sessionId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const sessionInfo = interactiveSessions.get(sessionId);
    if (!sessionInfo) {
      throw new NotFoundError('Interactive session not found');
    }

    const interactiveSession = getInteractiveSession();
    await interactiveSession.cancel(sessionId);

    interactiveSessions.delete(sessionId);

    res.json({ success: true, message: 'Session cancelled' });
  })
);

// GET /api/interactive-a2ui - 列出所有会话
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const sessions = Array.from(interactiveSessions.values());
    res.json({ success: true, data: sessions });
  })
);

export { router as interactiveA2UIRouter };
