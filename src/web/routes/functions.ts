/**
 * Functions API Routes
 *
 * RESTful API for function management
 */

import { Router, Request, Response } from 'express';
import type { OrchestrationService } from '../../core/interfaces/OrchestrationService.js';

const router = Router();

// 获取 OrchestrationService
const getService = (req: Request): OrchestrationService => {
  return (req as any).orchestrationService;
};

// GET /api/functions - 列出所有函数
router.get('/', async (req: Request, res: Response) => {
  try {
    const service = getService(req);
    const functions = await service.listFunctions();
    res.json({ success: true, data: functions });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/functions - 加载函数
router.post('/', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ success: false, error: 'Missing path parameter' });
    }

    const service = getService(req);
    await service.loadFunctions(path);

    res.json({ success: true, message: 'Functions loaded' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export { router as functionsRouter };
