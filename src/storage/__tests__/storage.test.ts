import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageImpl } from '../StorageImpl.js';
import type { Storage } from '../interfaces/Storage.js';
import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Storage', () => {
  const testDataDir = '.data-test';
  let storage: Storage;

  beforeEach(() => {
    storage = new StorageImpl(testDataDir);
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

  describe('Version Management', () => {
    describe('parsePlanId', () => {
      it('should parse plan ID without version', () => {
        const result = storage.parsePlanId('plan-abc123');
        expect(result.basePlanId).toBe('plan-abc123');
        expect(result.version).toBeUndefined();
      });

      it('should parse plan ID with version', () => {
        const result = storage.parsePlanId('plan-abc123-v2');
        expect(result.basePlanId).toBe('plan-abc123');
        expect(result.version).toBe(2);
      });

      it('should handle plan ID with v1', () => {
        const result = storage.parsePlanId('plan-xyz-v1');
        expect(result.basePlanId).toBe('plan-xyz');
        expect(result.version).toBe(1);
      });

      it('should handle plan ID with large version number', () => {
        const result = storage.parsePlanId('plan-test-v999');
        expect(result.basePlanId).toBe('plan-test');
        expect(result.version).toBe(999);
      });
    });

    describe('savePlanVersion and loadPlanVersion', () => {
      it('should save and load a versioned plan', async () => {
        const plan: ExecutionPlan = {
          id: 'plan-version-test',
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

        await storage.savePlanVersion(plan, 'plan-version-test', 1);

        const loaded = await storage.loadPlanVersion('plan-version-test', 1);
        expect(loaded).toBeDefined();
        expect(loaded?.id).toBe('plan-version-test');
        expect(loaded?.userRequest).toBe('计算 3 + 5');

        // 验证文件名
        const filePath = path.join(
          testDataDir,
          'plans',
          'plan-version-test-v1.json'
        );
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it('should save multiple versions of the same plan', async () => {
        const basePlanId = 'plan-multi-version';

        const planV1: ExecutionPlan = {
          id: basePlanId,
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

        const planV2: ExecutionPlan = {
          ...planV1,
          steps: [
            ...planV1.steps,
            {
              stepId: 2,
              functionName: 'multiply',
              description: '乘以2',
              parameters: {
                a: { type: 'reference', value: 'step.1.result' },
                b: { type: 'literal', value: 2 },
              },
              dependsOn: [1],
            },
          ],
        };

        await storage.savePlanVersion(planV1, basePlanId, 1);
        await storage.savePlanVersion(planV2, basePlanId, 2);

        const loadedV1 = await storage.loadPlanVersion(basePlanId, 1);
        const loadedV2 = await storage.loadPlanVersion(basePlanId, 2);

        expect(loadedV1?.steps).toHaveLength(1);
        expect(loadedV2?.steps).toHaveLength(2);
      });

      it('should return undefined for non-existent version', async () => {
        const loaded = await storage.loadPlanVersion('plan-nonexistent', 1);
        expect(loaded).toBeUndefined();
      });
    });

    describe('loadLatestPlanVersion', () => {
      it('should load the latest version of a plan', async () => {
        const basePlanId = 'plan-latest-test';

        const planV1: ExecutionPlan = {
          id: basePlanId,
          userRequest: 'v1',
          steps: [],
          createdAt: new Date().toISOString(),
          status: 'executable',
        };

        const planV2: ExecutionPlan = {
          ...planV1,
          userRequest: 'v2',
        };

        const planV3: ExecutionPlan = {
          ...planV1,
          userRequest: 'v3',
        };

        await storage.savePlanVersion(planV1, basePlanId, 1);
        await storage.savePlanVersion(planV2, basePlanId, 2);
        await storage.savePlanVersion(planV3, basePlanId, 3);

        const result = await storage.loadLatestPlanVersion(basePlanId);

        expect(result).toBeDefined();
        expect(result?.version).toBe(3);
        expect(result?.plan.userRequest).toBe('v3');
      });

      it('should return undefined for non-existent plan', async () => {
        const result = await storage.loadLatestPlanVersion('plan-nonexistent');
        expect(result).toBeUndefined();
      });

      it('should return undefined when no versions exist', async () => {
        const result = await storage.loadLatestPlanVersion('plan-empty');
        expect(result).toBeUndefined();
      });
    });

    describe('listPlanVersions', () => {
      it('should list all versions of a plan', async () => {
        const basePlanId = 'plan-list-versions';

        const plan: ExecutionPlan = {
          id: basePlanId,
          userRequest: 'test',
          steps: [],
          createdAt: new Date().toISOString(),
          status: 'executable',
        };

        await storage.savePlanVersion(plan, basePlanId, 1);
        await storage.savePlanVersion(plan, basePlanId, 2);
        await storage.savePlanVersion(plan, basePlanId, 4);

        const versions = await storage.listPlanVersions(basePlanId);

        expect(versions).toHaveLength(3);
        expect(versions).toEqual([1, 2, 4]);
      });

      it('should return empty array for non-existent plan', async () => {
        const versions = await storage.listPlanVersions('plan-nonexistent');
        expect(versions).toEqual([]);
      });

      it('should return sorted versions', async () => {
        const basePlanId = 'plan-sort-test';

        const plan: ExecutionPlan = {
          id: basePlanId,
          userRequest: 'test',
          steps: [],
          createdAt: new Date().toISOString(),
          status: 'executable',
        };

        // 保存乱序的版本
        await storage.savePlanVersion(plan, basePlanId, 3);
        await storage.savePlanVersion(plan, basePlanId, 1);
        await storage.savePlanVersion(plan, basePlanId, 5);
        await storage.savePlanVersion(plan, basePlanId, 2);

        const versions = await storage.listPlanVersions(basePlanId);

        expect(versions).toEqual([1, 2, 3, 5]);
      });
    });

    describe('deletePlanAllVersions', () => {
      it('should delete all versions of a plan', async () => {
        const basePlanId = 'plan-delete-all';

        const plan: ExecutionPlan = {
          id: basePlanId,
          userRequest: 'test',
          steps: [],
          createdAt: new Date().toISOString(),
          status: 'executable',
        };

        await storage.savePlanVersion(plan, basePlanId, 1);
        await storage.savePlanVersion(plan, basePlanId, 2);
        await storage.savePlanVersion(plan, basePlanId, 3);

        expect(await storage.listPlanVersions(basePlanId)).toHaveLength(3);

        await storage.deletePlanAllVersions(basePlanId);

        expect(await storage.listPlanVersions(basePlanId)).toHaveLength(0);
        expect(await storage.loadPlanVersion(basePlanId, 1)).toBeUndefined();
        expect(await storage.loadPlanVersion(basePlanId, 2)).toBeUndefined();
        expect(await storage.loadPlanVersion(basePlanId, 3)).toBeUndefined();
      });

      it('should not throw error for non-existent plan', async () => {
        await expect(
          storage.deletePlanAllVersions('plan-nonexistent')
        ).resolves.not.toThrow();
      });
    });
  });
});
