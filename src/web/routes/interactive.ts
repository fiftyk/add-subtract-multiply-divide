/**
 * Interactive API Routes
 *
 * 交互式会话 API
 * 支持会话管理、状态查询
 */

import { Router, Request, Response } from 'express';
import type { InteractiveSessionService } from '../../core/services/InteractiveSessionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createSessionSchema, confirmSessionSchema, submitInputSchema } from '../validation/schemas.js';
import { NotFoundError, ValidationError } from '../errors/ApiErrors.js';

const router = Router();

// 获取 InteractiveSessionService (with type safety)
const getService = (req: Request): InteractiveSessionService => {
  if (!req.sessionService) {
    throw new Error('InteractiveSessionService not available');
  }
  return req.sessionService;
};

// POST /api/interactive/sessions - 创建新会话
router.post(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = createSessionSchema.parse(req.body);
    const service = getService(req);
    const session = await service.start(validated.request || '', validated.planId);
    res.json({ success: true, data: session });
  })
);

// GET /api/interactive/sessions - 列出所有会话
router.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const sessions = await service.listSessions();
    res.json({ success: true, data: sessions });
  })
);

// GET /api/interactive/sessions/:id - 获取会话详情
router.get(
  '/sessions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const session = await service.getSession(req.params.id);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    res.json({ success: true, data: session });
  })
);

// POST /api/interactive/sessions/:id/confirm - 确认执行
router.post(
  '/sessions/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = confirmSessionSchema.parse(req.body);
    const service = getService(req);
    await service.confirm(req.params.id, validated.confirmed);
    res.json({ success: true, message: validated.confirmed ? 'Execution started' : 'Execution cancelled' });
  })
);

// POST /api/interactive/sessions/:id/inputs/:stepId - 提交用户输入
router.post(
  '/sessions/:id/inputs/:stepId',
  asyncHandler(async (req: Request, res: Response) => {
    const values = submitInputSchema.parse(req.body);
    const service = getService(req);

    const stepIdNum = parseInt(req.params.stepId, 10);
    if (isNaN(stepIdNum)) {
      throw new ValidationError('Invalid stepId');
    }

    const result = await service.submitInput(req.params.id, stepIdNum, values);
    res.json({ success: result, message: result ? 'Input submitted' : 'Failed to submit input' });
  })
);

// GET /api/interactive/sessions/:id/inputs - 获取待处理的输入请求
router.get(
  '/sessions/:id/inputs',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const inputs = await service.getPendingInputs(req.params.id);
    res.json({ success: true, data: inputs });
  })
);

// POST /api/interactive/sessions/:id/cancel - 取消会话
router.post(
  '/sessions/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    await service.cancel(req.params.id);
    res.json({ success: true, message: 'Session cancelled' });
  })
);

export { router as interactiveRouter };
