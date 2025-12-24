import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Planner } from '../../planner/planner.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { PlanResult, ExecutionPlan } from '../../planner/types.js';
import { PlannerWithMockSupport } from '../decorators/PlannerWithMockSupport.js';

describe('PlannerWithMockSupport', () => {
  let basePlanner: Planner;
  let mockOrchestrator: IMockOrchestrator;
  let registry: FunctionRegistry;
  let plannerWithMockSupport: PlannerWithMockSupport;

  beforeEach(() => {
    basePlanner = {
      plan: vi.fn(),
    } as unknown as Planner;

    mockOrchestrator = {
      generateAndRegisterMocks: vi.fn(),
    };

    registry = {
      getAll: vi.fn().mockReturnValue([]),
    } as unknown as FunctionRegistry;

    plannerWithMockSupport = new PlannerWithMockSupport(
      basePlanner,
      mockOrchestrator,
      registry,
      { maxIterations: 3 } // Add required config parameter
    );
  });

  it('should pass through to base planner when plan is executable', async () => {
    const executablePlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Calculate 3 + 5',
      steps: [
        {
          stepId: 1,
          functionName: 'add',
          parameters: {
            a: { type: 'literal', value: 3 },
            b: { type: 'literal', value: 5 },
          },
          description: 'Add numbers',
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    const planResult: PlanResult = {
      success: true,
      plan: executablePlan,
    };

    vi.mocked(basePlanner.plan).mockResolvedValue(planResult);

    const result = await plannerWithMockSupport.plan('Calculate 3 + 5');

    expect(result.success).toBe(true);
    expect(result.plan?.status).toBe('executable');
    expect(basePlanner.plan).toHaveBeenCalledTimes(1);
    expect(mockOrchestrator.generateAndRegisterMocks).not.toHaveBeenCalled();
  });

  it('should generate mocks and re-plan when functions are missing', async () => {
    const incompletePlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Query patent CN123',
      steps: [],
      missingFunctions: [
        {
          name: 'queryPatent',
          description: '查询专利',
          suggestedParameters: [
            { name: 'patentNumber', type: 'string', description: '专利号' },
          ],
          suggestedReturns: { type: 'object', description: '专利信息' },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'incomplete',
    };

    const executablePlan: ExecutionPlan = {
      id: 'plan-124',
      userRequest: 'Query patent CN123',
      steps: [
        {
          stepId: 1,
          functionName: 'queryPatent',
          parameters: {
            patentNumber: { type: 'literal', value: 'CN123' },
          },
          description: 'Query patent',
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    // First call returns incomplete, second returns executable
    vi.mocked(basePlanner.plan)
      .mockResolvedValueOnce({ success: true, plan: incompletePlan })
      .mockResolvedValueOnce({ success: true, plan: executablePlan });

    vi.mocked(mockOrchestrator.generateAndRegisterMocks).mockResolvedValue({
      success: true,
      generatedFunctions: [
        {
          functionName: 'queryPatent',
          filePath: '/data/plans/plan-123/mocks/queryPatent-v1.js',
          generatedAt: '2025-12-24T10:00:00.000Z',
          isMock: true,
        },
      ],
    });

    const result = await plannerWithMockSupport.plan('Query patent CN123');

    expect(result.success).toBe(true);
    expect(result.plan?.status).toBe('executable');
    expect(basePlanner.plan).toHaveBeenCalledTimes(2); // Once before, once after mock generation
    expect(mockOrchestrator.generateAndRegisterMocks).toHaveBeenCalledWith(
      incompletePlan.missingFunctions
    );
    expect(result.plan?.metadata?.usesMocks).toBe(true);
    // mockFunctions is now MockFunctionReference[] instead of string[]
    expect(result.plan?.metadata?.mockFunctions).toHaveLength(1);
    expect(result.plan?.metadata?.mockFunctions?.[0]).toEqual({
      name: 'queryPatent',
      version: 1,
      filePath: 'mocks/queryPatent-v1.js',
      generatedAt: '2025-12-24T10:00:00.000Z',
    });
  });

  it('should handle multiple missing functions', async () => {
    const incompletePlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Find inventor of patent CN123',
      steps: [],
      missingFunctions: [
        {
          name: 'queryPatent',
          description: '查询专利',
          suggestedParameters: [],
          suggestedReturns: { type: 'object', description: '' },
        },
        {
          name: 'extractInventor',
          description: '提取发明人',
          suggestedParameters: [],
          suggestedReturns: { type: 'string', description: '' },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'incomplete',
    };

    const executablePlan: ExecutionPlan = {
      ...incompletePlan,
      id: 'plan-124',
      steps: [{ stepId: 1, functionName: 'queryPatent', parameters: {}, description: '' }],
      status: 'executable',
      missingFunctions: undefined,
    };

    vi.mocked(basePlanner.plan)
      .mockResolvedValueOnce({ success: true, plan: incompletePlan })
      .mockResolvedValueOnce({ success: true, plan: executablePlan });

    vi.mocked(mockOrchestrator.generateAndRegisterMocks).mockResolvedValue({
      success: true,
      generatedFunctions: [
        {
          functionName: 'queryPatent',
          filePath: '/data/plans/plan-123/mocks/queryPatent-v1.js',
          generatedAt: '2025-12-24T10:00:00.000Z',
          isMock: true,
        },
        {
          functionName: 'extractInventor',
          filePath: '/data/plans/plan-123/mocks/extractInventor-v1.js',
          generatedAt: '2025-12-24T10:00:01.000Z',
          isMock: true,
        },
      ],
    });

    const result = await plannerWithMockSupport.plan(
      'Find inventor of patent CN123'
    );

    expect(result.plan?.metadata?.mockFunctions).toHaveLength(2);
    // Check that mock functions have the correct structure
    const mockNames = result.plan?.metadata?.mockFunctions?.map(m => m.name) || [];
    expect(mockNames).toContain('queryPatent');
    expect(mockNames).toContain('extractInventor');

    // Verify version and path structure
    const queryPatent = result.plan?.metadata?.mockFunctions?.find(m => m.name === 'queryPatent');
    expect(queryPatent?.version).toBe(1);
    expect(queryPatent?.filePath).toBe('mocks/queryPatent-v1.js');
  });

  it('should not add metadata when no mocks are used', async () => {
    const executablePlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Calculate 3 + 5',
      steps: [],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    vi.mocked(basePlanner.plan).mockResolvedValue({
      success: true,
      plan: executablePlan,
    });

    const result = await plannerWithMockSupport.plan('Calculate 3 + 5');

    expect(result.plan?.metadata).toBeUndefined();
  });

  it('should handle mock generation failures gracefully', async () => {
    const incompletePlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Test',
      steps: [],
      missingFunctions: [
        {
          name: 'testFunc',
          description: 'Test',
          suggestedParameters: [],
          suggestedReturns: { type: 'string', description: '' },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'incomplete',
    };

    vi.mocked(basePlanner.plan).mockResolvedValue({
      success: true,
      plan: incompletePlan,
    });

    vi.mocked(mockOrchestrator.generateAndRegisterMocks).mockResolvedValue({
      success: false,
      generatedFunctions: [],
      errors: [{ functionName: 'testFunc', error: 'Generation failed' }],
    });

    const result = await plannerWithMockSupport.plan('Test');

    // Should return the incomplete plan since mock generation failed
    expect(result.plan?.status).toBe('incomplete');
    expect(basePlanner.plan).toHaveBeenCalledTimes(1); // No re-plan
  });

  it('should propagate base planner errors', async () => {
    vi.mocked(basePlanner.plan).mockResolvedValue({
      success: false,
      error: 'Planning failed',
    });

    const result = await plannerWithMockSupport.plan('Test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Planning failed');
    expect(mockOrchestrator.generateAndRegisterMocks).not.toHaveBeenCalled();
  });
});
