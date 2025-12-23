import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Storage } from '../storage.js';
import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Storage', () => {
  const testDataDir = '.data-test';
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage(testDataDir);
  });

  afterEach(() => {
    // 清理测试数据
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('savePlan', () => {
    it('should save a plan to file', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: '计算 3 + 5',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: '加法',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      await storage.savePlan(plan);

      const filePath = path.join(testDataDir, 'plans', `${plan.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('loadPlan', () => {
    it('should load a saved plan', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-002',
        userRequest: '计算 10 - 3',
        steps: [
          {
            stepId: 1,
            functionName: 'subtract',
            description: '减法',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 3 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      await storage.savePlan(plan);
      const loaded = await storage.loadPlan('plan-002');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('plan-002');
      expect(loaded?.userRequest).toBe('计算 10 - 3');
    });

    it('should return undefined for non-existent plan', async () => {
      const loaded = await storage.loadPlan('nonexistent');
      expect(loaded).toBeUndefined();
    });
  });

  describe('listPlans', () => {
    it('should list all saved plans', async () => {
      const plan1: ExecutionPlan = {
        id: 'plan-a',
        userRequest: 'test 1',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const plan2: ExecutionPlan = {
        id: 'plan-b',
        userRequest: 'test 2',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      await storage.savePlan(plan1);
      await storage.savePlan(plan2);

      const plans = await storage.listPlans();

      expect(plans).toHaveLength(2);
      expect(plans.map((p) => p.id)).toContain('plan-a');
      expect(plans.map((p) => p.id)).toContain('plan-b');
    });

    it('should return empty array when no plans exist', async () => {
      const plans = await storage.listPlans();
      expect(plans).toHaveLength(0);
    });
  });

  describe('saveExecution', () => {
    it('should save an execution result', async () => {
      const result: ExecutionResult = {
        planId: 'plan-001',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            parameters: { a: 3, b: 5 },
            result: 8,
            success: true,
            executedAt: new Date().toISOString(),
          },
        ],
        finalResult: 8,
        success: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      const id = await storage.saveExecution(result);

      expect(id).toBeDefined();
      const filePath = path.join(testDataDir, 'executions', `${id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('loadExecution', () => {
    it('should load a saved execution', async () => {
      const result: ExecutionResult = {
        planId: 'plan-001',
        steps: [],
        finalResult: 42,
        success: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      const id = await storage.saveExecution(result);
      const loaded = await storage.loadExecution(id);

      expect(loaded).toBeDefined();
      expect(loaded?.planId).toBe('plan-001');
      expect(loaded?.finalResult).toBe(42);
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-to-delete',
        userRequest: 'test',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      await storage.savePlan(plan);
      expect(await storage.loadPlan('plan-to-delete')).toBeDefined();

      await storage.deletePlan('plan-to-delete');
      expect(await storage.loadPlan('plan-to-delete')).toBeUndefined();
    });
  });
});
