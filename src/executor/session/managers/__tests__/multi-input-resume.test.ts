import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionSessionManagerImpl } from '../ExecutionSessionManagerImpl.js';
import { ConditionalExecutor } from '../../../implementations/ConditionalExecutor.js';
import { ExecutionSessionStorageImpl } from '../../storage/ExecutionSessionStorageImpl.js';
import type { ExecutionPlan, StepType } from '../../../../planner/types.js';
import type { FunctionRegistry } from '../../../../registry/interfaces/FunctionRegistry.js';
import type { IA2UIRenderer } from '../../../../a2ui/interfaces/IA2UIRenderer.js';
import type { Storage } from '../../../../storage/interfaces/Storage.js';
import { LoggerFactory } from '../../../../logger/index.js';
import { ConfigManager } from '../../../../config/ConfigManager.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ExecutionSessionManager - Multi-Input Resume Bug', () => {
  let manager: ExecutionSessionManagerImpl;
  let executor: ConditionalExecutor;
  let sessionStorage: ExecutionSessionStorageImpl;
  let mockFunctionRegistry: FunctionRegistry;
  let mockRenderer: IA2UIRenderer;
  let mockStorage: Storage;
  let testDataDir: string;

  beforeEach(async () => {
    // Initialize ConfigManager
    ConfigManager.reset();
    await ConfigManager.initialize({
      api: { apiKey: 'test-key' },
      storage: { dataDir: '.data' },
      executor: { stepTimeout: 30000 },
    });
    // Create temp directory for test data
    testDataDir = path.join(os.tmpdir(), `test-sessions-${Date.now()}`);
    await fs.promises.mkdir(testDataDir, { recursive: true });

    // Mock FunctionProvider (not FunctionRegistry!)
    const mockFunctionProvider = {
      getType: vi.fn(() => 'local'),
      getSource: vi.fn(() => 'local'),
      list: vi.fn(async () => []),
      has: vi.fn(async () => true),
      get: vi.fn(async (name: string) => {
        if (name === 'calculateBasePrice' || name === 'calculateFinalPrice') {
          return {
            name,
            description: 'Test function',
            parameters: [],
            returns: { type: 'object', description: 'Result' }
          };
        }
        return undefined;
      }),
      execute: vi.fn(async (name: string, params: Record<string, unknown>) => {
        if (name === 'calculateBasePrice') {
          const { category, quantity } = params;
          return {
            success: true,
            result: { basePrice: 2250, category, quantity, pricePerUnit: 500, discount: 0.1, subtotal: 2500, discountAmount: 250 }
          };
        }
        if (name === 'calculateFinalPrice') {
          const { basePrice, warranty } = params as { basePrice: number; warranty: boolean };
          return {
            success: true,
            result: { finalPrice: warranty ? basePrice * 1.08 : basePrice }
          };
        }
        return { success: false, error: 'Function not found' };
      }),
      register: vi.fn(),
      clear: vi.fn()
    } as any;

    mockFunctionRegistry = mockFunctionProvider;

    // Mock A2UI Renderer (throws UserInputRequiredError)
    mockRenderer = {
      begin: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      end: vi.fn(),
      onUserAction: vi.fn(),
      requestInput: vi.fn(async () => {
        throw new Error('User input required');
      }),
    };

    // Mock Storage
    mockStorage = {
      parsePlanId: vi.fn((planId: string) => ({
        basePlanId: planId,
        version: undefined,
      })),
    } as any;

    // Create real instances
    sessionStorage = new ExecutionSessionStorageImpl(testDataDir);
    executor = new ConditionalExecutor(
      mockFunctionRegistry, // FunctionProvider
      undefined,            // config (optional)
      mockRenderer as any,  // a2uiRenderer (optional)
      undefined             // timeoutStrategy (optional)
    );
    manager = new ExecutionSessionManagerImpl(
      sessionStorage,
      executor,
      mockStorage
    );
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.promises.rm(testDataDir, { recursive: true, force: true });
    // Clean up ConfigManager
    ConfigManager.reset();
  });

  /**
   * 测试场景：3个步骤的计划需要2次用户输入
   *
   * Step 1: user_input (基本信息: category, quantity)
   * Step 2: function_call (calculateBasePrice, 引用 step.1.result)
   * Step 3: user_input (附加信息: warranty)
   * Step 4: function_call (calculateFinalPrice, 引用 step.2.result.basePrice)
   *
   * 预期行为：
   * - 第一次 resume(step 1 输入) → 执行 step 2 → 暂停等待 step 3 输入
   * - 第二次 resume(step 3 输入) → 执行 step 4 → 应该能访问 step 2 的结果
   *
   * Bug: 第二次 resume 时，step 2 的结果丢失，导致 step 4 失败
   */
  it('should preserve step results across multiple resume calls', async () => {
    // Arrange: Create a plan with 2 user inputs and 2 function calls
    const plan: ExecutionPlan = {
      id: 'test-multi-input-plan',
      userRequest: 'Test multi-input with cross-reference',
      steps: [
        {
          stepId: 1,
          type: 'user_input' as StepType,
          description: 'Collect basic info',
          schema: {
            version: '1.0',
            fields: [
              {
                id: 'category',
                type: 'text',
                label: 'Category',
                required: true,
              },
              {
                id: 'quantity',
                type: 'number',
                label: 'Quantity',
                required: true,
              },
            ],
          },
          outputName: 'basicInfo',
        },
        {
          stepId: 2,
          type: 'function_call' as StepType,
          description: 'Calculate base price',
          functionName: 'calculateBasePrice',
          parameters: {
            category: { type: 'reference', value: 'step.1.result.category' },
            quantity: { type: 'reference', value: 'step.1.result.quantity' },
          },
        },
        {
          stepId: 3,
          type: 'user_input' as StepType,
          description: 'Collect additional info',
          schema: {
            version: '1.0',
            fields: [
              {
                id: 'warranty',
                type: 'boolean',
                label: 'Extended Warranty',
                required: false,
                defaultValue: false,
              },
            ],
          },
          outputName: 'additionalInfo',
        },
        {
          stepId: 4,
          type: 'function_call' as StepType,
          description: 'Calculate final price',
          functionName: 'calculateFinalPrice',
          parameters: {
            basePrice: { type: 'reference', value: 'step.2.result.basePrice' },
            warranty: { type: 'reference', value: 'step.3.result.warranty' },
          },
        },
      ],
      status: 'executable',
      createdAt: new Date().toISOString(),
    };

    // Act 1: Create session and manually set to waiting_input (mimicking web server flow)
    const session = await manager.createSession(plan, 'cli');

    // Manually set session to waiting_input state (this is what web server does)
    const firstUserInputStep = plan.steps.find(s => s.type === 'user_input');
    await sessionStorage.updateSession(session.id, {
      status: 'waiting_input',
      currentStepId: firstUserInputStep!.stepId,
      pendingInput: {
        stepId: firstUserInputStep!.stepId,
        schema: (firstUserInputStep as any).schema,
        surfaceId: `user-input-${firstUserInputStep!.stepId}`
      }
    });

    // Act 2: Resume with step 1 input (should execute step 2, then stop at step 3)
    const result2 = await manager.resumeSession(session.id, {
      category: '电子产品',
      quantity: 5,
    });

    // Assert 2: Should be waiting for input at step 3
    expect(result2.success).toBe(true);
    expect(result2.waitingForInput).toBeDefined();
    expect(result2.waitingForInput?.stepId).toBe(3);

    // Debug: Print all steps
    console.log('[TEST] result2.steps:', JSON.stringify(result2.steps.map(s => ({ stepId: s.stepId, type: s.type })), null, 2));

    // Verify step 2 was executed
    const step2Result = result2.steps.find(s => s.stepId === 2);
    expect(step2Result).toBeDefined();
    expect(step2Result?.success).toBe(true);
    expect(step2Result?.result).toMatchObject({
      basePrice: 2250,
      category: '电子产品',
      quantity: 5,
    });

    // Act 3: Resume with step 3 input (should execute step 4 referencing step 2 result)
    const result3 = await manager.resumeSession(session.id, {
      warranty: true,
    });

    // Assert 3: Should complete successfully with step 4 accessing step 2 result
    expect(result3.success).toBe(true);
    expect(result3.waitingForInput).toBeUndefined();

    // ✅ This is the critical assertion - step 4 should succeed
    const step4Result = result3.steps.find(s => s.stepId === 4);
    expect(step4Result).toBeDefined();
    expect(step4Result?.success).toBe(true);
    expect(step4Result?.result).toMatchObject({
      finalPrice: 2430, // 2250 * 1.08
    });
  });
});
