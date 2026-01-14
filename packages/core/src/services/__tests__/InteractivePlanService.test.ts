import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractivePlanService } from '../InteractivePlanService.js';
import { PlanRefinementSessionStorageImpl } from '../storage/PlanRefinementSessionStorage.js';
import type { PlanRefinementSessionStorage } from '../storage/interfaces/PlanRefinementSessionStorage.js';
import type { Planner } from '../../planner/planner.js';
import type { Storage } from '../../storage/index.js';
import type { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import type { IPlanRefinementLLMClient } from '../interfaces/IPlanRefinementLLMClient.js';
import type { ExecutionPlan } from '../../planner/types.js';
import type { FunctionMetadata } from '../../function-provider/types.js';
import * as fs from 'node:fs/promises';

describe('InteractivePlanService', () => {
  const testDataDir = '.data-test-interactive';
  let service: InteractivePlanService;
  let mockPlanner: Planner;
  let mockStorage: Storage;
  let sessionStorage: PlanRefinementSessionStorage;
  let mockRefinementLLMClient: IPlanRefinementLLMClient;
  let mockFunctionProvider: FunctionProvider;

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(testDataDir, { recursive: true });

    // Mock Planner
    mockPlanner = {
      plan: vi.fn(),
    } as any;

    // Mock Storage
    mockStorage = {
      savePlanVersion: vi.fn(),
      loadPlanVersion: vi.fn(),
      loadLatestPlanVersion: vi.fn(),
      listPlanVersions: vi.fn(),
      loadPlan: vi.fn(),
      parsePlanId: (planId: string) => {
        const match = planId.match(/^(.+?)-v(\d+)$/);
        if (match) {
          return {
            basePlanId: match[1],
            version: parseInt(match[2], 10),
          };
        }
        return { basePlanId: planId, version: undefined };
      },
    } as any;

    // Real PlanRefinementSessionStorage for integration testing
    sessionStorage = new PlanRefinementSessionStorageImpl(testDataDir);

    // Mock RefinementLLMClient
    mockRefinementLLMClient = {
      refinePlan: vi.fn(),
    } as any;

    // Mock FunctionProvider
    mockFunctionProvider = {
      getType: () => 'local' as const,
      getSource: () => 'local',
      list: vi.fn().mockResolvedValue([
        {
          id: 'add',
          name: 'add',
          description: '加法',
          parameters: [
            { name: 'a', type: 'number', description: '第一个数' },
            { name: 'b', type: 'number', description: '第二个数' },
          ],
          returns: { type: 'number', description: '和' },
          type: 'local' as const,
          source: 'local',
        },
        {
          id: 'multiply',
          name: 'multiply',
          description: '乘法',
          parameters: [
            { name: 'a', type: 'number', description: '第一个数' },
            { name: 'b', type: 'number', description: '第二个数' },
          ],
          returns: { type: 'number', description: '积' },
          type: 'local' as const,
          source: 'local',
        },
      ] as FunctionMetadata[]),
      has: vi.fn(),
      get: vi.fn(),
      execute: vi.fn(),
    } as any;

    service = new InteractivePlanService(
      mockPlanner,
      mockStorage,
      sessionStorage,
      mockRefinementLLMClient,
      mockFunctionProvider
    );
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略删除错误
    }
  });

  describe('createPlan', () => {
    it('should create a new plan and session', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-test-001',
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
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      vi.mocked(mockPlanner.plan).mockResolvedValue({
        success: true,
        plan: mockPlan,
      });

      const result = await service.createPlan('计算 3 + 5');

      // 验证 planner 被调用
      expect(mockPlanner.plan).toHaveBeenCalledWith('计算 3 + 5');

      // 验证 storage 保存了 plan
      expect(mockStorage.savePlanVersion).toHaveBeenCalledWith(
        mockPlan,
        'plan-test-001',
        1
      );

      // 验证返回的 plan
      expect(result.plan.basePlanId).toBe('plan-test-001');
      expect(result.plan.version).toBe(1);
      expect(result.plan.fullId).toBe('plan-test-001-v1');

      // 验证 session 被创建
      expect(result.session.planId).toBe('plan-test-001');
      expect(result.session.currentVersion).toBe(1);
      expect(result.session.messages).toHaveLength(2); // user + assistant
      expect(result.session.status).toBe('active');
    });

    it('should throw error when planning fails', async () => {
      vi.mocked(mockPlanner.plan).mockResolvedValue({
        success: false,
        error: 'Planning failed',
        plan: undefined,
      });

      await expect(service.createPlan('invalid request')).rejects.toThrow(
        'Failed to create plan: Planning failed'
      );
    });

    it('should use provided sessionId if exists', async () => {
      const existingSession = {
        sessionId: 'existing-session',
        planId: 'old-plan',
        currentVersion: 0,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active' as const,
      };

      await sessionStorage.saveSession(existingSession);

      const mockPlan: ExecutionPlan = {
        id: 'plan-test-002',
        userRequest: '计算 10 - 3',
        steps: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      vi.mocked(mockPlanner.plan).mockResolvedValue({
        success: true,
        plan: mockPlan,
      });

      const result = await service.createPlan('计算 10 - 3', {
        sessionId: 'existing-session',
      });

      expect(result.session.sessionId).toBe('existing-session');
    });
  });

  describe('refinePlan', () => {
    it('should refine an existing plan', async () => {
      const currentPlan: ExecutionPlan = {
        id: 'plan-test-003',
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
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      const refinedPlan: ExecutionPlan = {
        ...currentPlan,
        steps: [
          ...currentPlan.steps,
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

      // Mock loadPlanVersion to return current plan
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(currentPlan);

      // Mock LLM refinement
      vi.mocked(mockRefinementLLMClient.refinePlan).mockResolvedValue({
        refinedPlan,
        changes: [
          {
            type: 'step_added',
            stepId: 2,
            description: '添加了第2步：multiply',
          },
        ],
        explanation: '已添加乘以2的步骤',
      });

      const result = await service.refinePlan(
        'plan-test-003-v1',
        '把结果乘以2'
      );

      // 验证 LLM 被调用
      expect(mockRefinementLLMClient.refinePlan).toHaveBeenCalledWith({
        currentPlan,
        refinementInstruction: '把结果乘以2',
        conversationHistory: expect.any(Array),
        availableFunctions: expect.any(Array),
      });

      // 验证新版本被保存
      expect(mockStorage.savePlanVersion).toHaveBeenCalledWith(
        refinedPlan,
        'plan-test-003',
        2
      );

      // 验证返回结果
      expect(result.newPlan.basePlanId).toBe('plan-test-003');
      expect(result.newPlan.version).toBe(2);
      expect(result.newPlan.fullId).toBe('plan-test-003-v2');
      expect(result.newPlan.parentVersion).toBe(1);
      expect(result.newPlan.refinementInstruction).toBe('把结果乘以2');
      expect(result.changes).toHaveLength(1);
    });

    it('should load latest version when no version specified', async () => {
      const currentPlan: ExecutionPlan = {
        id: 'plan-test-004',
        userRequest: 'test',
        steps: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      vi.mocked(mockStorage.loadLatestPlanVersion).mockResolvedValue({
        plan: currentPlan,
        version: 3,
      });

      vi.mocked(mockRefinementLLMClient.refinePlan).mockResolvedValue({
        refinedPlan: currentPlan,
        changes: [],
        explanation: 'No changes',
      });

      const result = await service.refinePlan(
        'plan-test-004',
        'some instruction'
      );

      expect(mockStorage.loadLatestPlanVersion).toHaveBeenCalledWith(
        'plan-test-004'
      );
      expect(result.newPlan.version).toBe(4); // v3 + 1
    });

    it('should throw error when plan not found', async () => {
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(undefined);
      vi.mocked(mockStorage.loadLatestPlanVersion).mockResolvedValue(undefined);

      await expect(
        service.refinePlan('nonexistent-plan', 'instruction')
      ).rejects.toThrow('Plan not found');
    });

    it('should create new session if not provided', async () => {
      const currentPlan: ExecutionPlan = {
        id: 'plan-test-005',
        userRequest: 'test',
        steps: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(currentPlan);
      vi.mocked(mockRefinementLLMClient.refinePlan).mockResolvedValue({
        refinedPlan: currentPlan,
        changes: [],
        explanation: 'No changes',
      });

      const result = await service.refinePlan(
        'plan-test-005-v1',
        'instruction'
      );

      expect(result.session.planId).toBe('plan-test-005');
      expect(result.session.sessionId).toMatch(/^session-/);
    });

    it('should update conversation history in session', async () => {
      const currentPlan: ExecutionPlan = {
        id: 'plan-test-006',
        userRequest: 'test',
        steps: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(currentPlan);
      vi.mocked(mockRefinementLLMClient.refinePlan).mockResolvedValue({
        refinedPlan: currentPlan,
        changes: [],
        explanation: '已完成修改',
      });

      const result = await service.refinePlan(
        'plan-test-006-v1',
        '修改指令'
      );

      // 验证 session 包含对话消息
      expect(result.session.messages.length).toBeGreaterThanOrEqual(2);
      const userMessage = result.session.messages.find(
        (m) => m.role === 'user' && m.content === '修改指令'
      );
      const assistantMessage = result.session.messages.find(
        (m) => m.role === 'assistant' && m.content === '已完成修改'
      );
      expect(userMessage).toBeDefined();
      expect(assistantMessage).toBeDefined();
    });
  });

  describe('getPlanHistory', () => {
    it('should return all versions of a plan', async () => {
      const basePlanId = 'plan-test-007';

      const planV1: ExecutionPlan = {
        id: basePlanId,
        userRequest: 'v1',
        steps: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'executable',
      };

      const planV2: ExecutionPlan = {
        ...planV1,
        userRequest: 'v2',
      };

      vi.mocked(mockStorage.listPlanVersions).mockResolvedValue([1, 2]);
      vi.mocked(mockStorage.loadPlanVersion)
        .mockResolvedValueOnce(planV1)
        .mockResolvedValueOnce(planV2);

      const history = await service.getPlanHistory(basePlanId);

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[0].plan.userRequest).toBe('v1');
      expect(history[1].version).toBe(2);
      expect(history[1].plan.userRequest).toBe('v2');
    });

    it('should return empty array for non-existent plan', async () => {
      vi.mocked(mockStorage.listPlanVersions).mockResolvedValue([]);

      const history = await service.getPlanHistory('nonexistent');

      expect(history).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return existing session', async () => {
      const session = {
        sessionId: 'test-session',
        planId: 'plan-abc',
        currentVersion: 2,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active' as const,
      };

      await sessionStorage.saveSession(session);

      const loaded = await service.getSession('test-session');

      expect(loaded).toEqual(session);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await service.getSession('nonexistent');

      expect(loaded).toBeNull();
    });
  });
});
