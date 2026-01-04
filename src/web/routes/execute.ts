/**
 * Execute API Routes
 *
 * RESTful API for plan execution
 */

import { Router, Request, Response } from 'express';
import type { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError } from '../errors/ApiErrors.js';

const router = Router();

// 获取 OrchestrationService (with type safety)
const getService = (req: Request): OrchestrationService => {
  if (!req.orchestrationService) {
    throw new Error('OrchestrationService not available');
  }
  return req.orchestrationService;
};

// POST /api/execute/:planId - 执行计划
router.post(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const result = await service.executePlan(req.params.planId);

    res.json({
      success: result.success,
      data: {
        planId: result.planId,
        finalResult: result.finalResult,
        steps: result.steps,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      },
      error: result.error,
    });
  })
);

// GET /api/execute/:execId - 获取执行结果
router.get(
  '/:execId',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const result = await service.getExecution(req.params.execId);

    if (!result) {
      throw new NotFoundError('Execution not found');
    }

    res.json({ success: true, data: result });
  })
);

// GET /api/execute - 列出所有执行记录
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const executions = await service.listExecutions();
    res.json({ success: true, data: executions });
  })
);

export { router as executeRouter };
