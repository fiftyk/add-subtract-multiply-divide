/**
 * Plans API Routes
 *
 * RESTful API for plan management
 */

import { Router, Request, Response } from 'express';
import type { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';
import { asyncHandler, errorHandler } from '../middleware/errorHandler.js';
import { createPlanSchema, refinePlanSchema } from '../validation/schemas.js';
import { NotFoundError } from '../errors/ApiErrors.js';

const router = Router();

// 获取 OrchestrationService (with type safety)
const getService = (req: Request): OrchestrationService => {
  if (!req.orchestrationService) {
    throw new Error('OrchestrationService not available');
  }
  return req.orchestrationService;
};

// GET /api/plans - 列出所有计划
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const plans = await service.listPlans();
    res.json({ success: true, data: plans });
  })
);

// POST /api/plans - 创建新计划
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = createPlanSchema.parse(req.body);
    const service = getService(req);
    const result = await service.createPlan(validated.request, validated.options);

    if (!result.success) {
      throw new NotFoundError(result.error || 'Failed to create plan');
    }

    res.json({ success: true, data: result.plan });
  })
);

// GET /api/plans/:id - 获取计划详情
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const plan = await service.getPlan(req.params.id);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    res.json({ success: true, data: plan });
  })
);

// DELETE /api/plans/:id - 删除计划
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const deleted = await service.deletePlan(req.params.id);

    if (!deleted) {
      throw new NotFoundError('Plan not found');
    }

    res.json({ success: true, message: 'Plan deleted' });
  })
);

// POST /api/plans/:id/refine - 改进计划
router.post(
  '/:id/refine',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = refinePlanSchema.parse(req.body);
    const service = getService(req);
    const result = await service.refinePlan(req.params.id, validated.instruction);

    if (!result.success) {
      throw new NotFoundError(result.error || 'Failed to refine plan');
    }

    res.json({ success: true, data: result });
  })
);

// GET /api/plans/:id/history - 获取计划版本历史
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getService(req);
    const history = await service.getPlanHistory(req.params.id);
    res.json({ success: true, data: history });
  })
);

export { router as plansRouter };
