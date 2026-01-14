/**
 * Core Bridge - Web Server 与 fn-orchestrator 核心的桥接层
 *
 * 封装对核心服务的访问，提供简洁的 API 供 Web Server 使用
 */

// @ts-ignore - Importing from parent project's dist folder
import { ConfigManager } from '../../../dist/src/config/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ConfigManager if not already initialized
if (!ConfigManager.isInitialized()) {
  // Set STORAGE_DATA_DIR to parent directory's .data folder
  const rootDir = path.resolve(__dirname, '../../../');
  const dataDir = path.join(rootDir, '.data');

  // Override environment variable for correct path
  process.env.STORAGE_DATA_DIR = dataDir;

  ConfigManager.initialize({
    autoComplete: false,
    maxRetries: 3
  });
  console.log(`[CoreBridge] ConfigManager initialized with dataDir: ${dataDir}`);
}

// @ts-ignore - Importing from parent project's dist folder
import container from '../../../dist/src/container/cli-container.js';
// @ts-ignore - Importing from parent project's dist folder
import { ExecutionSessionManager } from '../../../dist/src/executor/session/index.js';
// @ts-ignore - Importing from parent project's dist folder
import { ExecutionSessionStorage } from '../../../dist/src/executor/session/index.js';
// @ts-ignore - Importing from parent project's dist folder
import { Storage } from '../../../dist/src/storage/index.js';
// @ts-ignore - Importing from parent project's dist folder
import { FunctionProvider } from '../../../dist/src/function-provider/interfaces/FunctionProvider.js';
// @ts-ignore - Importing from parent project's dist folder
import { FunctionService } from '../../../dist/src/function-service/index.js';
// @ts-ignore - Importing from parent project's dist folder
import type { ExecutionPlan } from '../../../dist/src/planner/types.js';
// @ts-ignore - Importing from parent project's dist folder
import type { ExecutionSession } from '../../../dist/src/executor/session/types.js';
// @ts-ignore - Importing from parent project's dist folder
import type { ExecutionResult, StepResult } from '../../../dist/src/executor/types.js';
// @ts-ignore - Importing from parent project's dist folder
import type { A2UIComponent } from '../../../dist/src/a2ui/types.js';
// @ts-ignore - Importing from parent project's dist folder
import { buildSchemaFromInputUI, resolvePath } from '../../../dist/src/a2ui/A2UIService.js';
// @ts-ignore - Importing from parent project's dist folder
import { StepType } from '../../../dist/src/planner/types.js';

// @ts-ignore - Importing from parent project's dist folder
import { FunctionService } from '../../../dist/src/function-service/index.js';
import { sseManager } from './SSEManager.js';
import { autoLoadFunctions, getFunctionsDir } from '../utils/AutoLoadFunctions.js';

/**
 * Core Bridge Service
 *
 * 提供与 fn-orchestrator 核心的统一访问接口
 */
export class CoreBridge {
  private sessionManager: ExecutionSessionManager;
  private sessionStorage: ExecutionSessionStorage;
  private planStorage: Storage;
  private functionService: FunctionService;
  private functionProvider: FunctionProvider;
  private initializationPromise: Promise<void>;

  constructor() {
    this.sessionManager = container.get<ExecutionSessionManager>(ExecutionSessionManager);
    this.sessionStorage = container.get<ExecutionSessionStorage>(ExecutionSessionStorage);
    this.planStorage = container.get<Storage>(Storage);
    this.functionService = container.get<FunctionService>(FunctionService);
    this.functionProvider = container.get<FunctionProvider>(FunctionProvider);

    // 使用 FunctionService 初始化（仅连接 MCP servers）
    this.initializationPromise = this.functionService
      .initialize({
        autoConnect: true,
      })
      .then(async () => {
        console.log('[CoreBridge] FunctionService.initialize() completed');

        // 调试：检查 functionProvider 的类型
        console.log(`[CoreBridge] FunctionProvider type: ${this.functionProvider.getType()}`);

        // 调试：尝试直接列举函数（触发懒加载）
        const allFunctionsBeforeLoad = await this.functionProvider.list();
        console.log(`[CoreBridge] Functions before local load: ${allFunctionsBeforeLoad.length} (${allFunctionsBeforeLoad.filter(f => f.type === 'remote').length} remote)`);

        // 加载本地函数（使用 autoLoadFunctions 工具，因为 web-server 运行 TypeScript）
        const functionsDir = getFunctionsDir(__dirname);
        const count = await autoLoadFunctions(functionsDir, (fn) => this.functionProvider.register!(fn));
        console.log(`[CoreBridge] Auto-loaded ${count} built-in functions`);

        // 日志输出统计信息
        const { local, remote } = await this.functionService.getCategorizedFunctions();
        console.log(`[CoreBridge] Total: ${local.length} local functions, ${remote.length} remote functions`);
        if (remote.length > 0) {
          console.log(`[CoreBridge] Remote functions:`, remote.map(f => `${f.name} (${f.source})`).join(', '));
        }
      })
      .catch(error => {
        console.error('[CoreBridge] Failed to initialize FunctionService:', error);
      });
  }

  /**
   * 等待初始化完成
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  /**
   * 创建并执行会话
   *
   * @param planId - 计划 ID
   * @param platform - 平台 ('web' 或 'cli')
   * @returns 创建的会话
   */
  async createAndExecuteSession(
    planId: string,
    platform: 'web' | 'cli' = 'web'
  ): Promise<ExecutionSession> {
    try {
      // 加载计划
      const plan = await this.planStorage.loadPlan(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // 加载 plan-specific mock 函数
      if (plan.metadata?.usesMocks) {
        try {
          const planMocks = await this.planStorage.loadPlanMocks(planId);
          const functionProvider = container.get<FunctionProvider>(FunctionProvider);
          planMocks.forEach((fn: any) => {
            functionProvider.register?.(fn as any);
          });
          console.log(`[CoreBridge] Loaded ${planMocks.length} mock functions for plan ${planId}`);
        } catch (error) {
          console.warn(`[CoreBridge] Failed to load mock functions:`, error);
        }
      }

      // 创建会话
      const session = await this.sessionManager.createSession(plan, platform);

      console.log(`[CoreBridge] Session created: ${session.id}`);

      return session;
    } catch (error) {
      console.error(`[CoreBridge] Error creating session:`, error);
      throw error;
    }
  }

  /**
   * 执行会话（异步执行，发射 SSE 事件）
   *
   * @param sessionId - 会话 ID
   */
  async executeSessionWithSSE(sessionId: string): Promise<void> {
    try {
      console.log(`[CoreBridge] Executing session with SSE: ${sessionId}`);

      // 发射执行开始事件
      sseManager.emit(sessionId, {
        type: 'executionStart',
        sessionId,
        timestamp: new Date().toISOString()
      });

      // 加载会话
      const session = await this.sessionStorage.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 查找第一个 user_input 步骤（如果有）
      const firstUserInputStep = session.plan.steps.find(s => s.type === 'user_input');

      // 如果有 user_input 步骤，发射 inputRequested 事件并暂停
      if (firstUserInputStep) {
        console.log(`[CoreBridge] Session ${sessionId} waiting for input at step ${firstUserInputStep.stepId}`);

        // 计算进度信息
        const userInputSteps = session.plan.steps.filter(s => s.type === 'user_input');
        const currentIndex = userInputSteps.findIndex(s => s.stepId === firstUserInputStep.stepId);
        const totalSteps = userInputSteps.length;
        const progressValue = Math.round(((currentIndex + 1) / totalSteps) * 100);

        // 生成进度和说明组件
        const components: A2UIComponent[] = [];

        // Progress 组件
        components.push({
          id: `progress-${firstUserInputStep.stepId}`,
          component: {
            Progress: {
              value: progressValue,
              max: 100,
              label: `步骤 ${currentIndex + 1}/${totalSteps}: ${(firstUserInputStep as any).description || '用户输入'}`
            }
          }
        });

        // Build schema - for first step, context is empty (no previous step results)
        const firstStepSchema = (firstUserInputStep as any).inputUI
          ? buildSchemaFromInputUI(firstUserInputStep as any, {})
          : (firstUserInputStep as any).schema;

        // Card 组件 - 步骤说明
        components.push({
          id: `card-${firstUserInputStep.stepId}`,
          component: {
            Card: {
              title: firstStepSchema?.title || (firstUserInputStep as any).description || '步骤说明',
              content: firstStepSchema?.description || '请填写以下信息'
            }
          }
        });

        // 发射 inputRequested 事件（包含进度和说明组件）
        sseManager.emit(sessionId, {
          type: 'inputRequested',
          sessionId,
          surfaceId: `form-${sessionId}`,
          schema: firstStepSchema,
          stepId: firstUserInputStep.stepId,
          // @ts-ignore - components 是扩展属性
          components,
          timestamp: new Date().toISOString()
        });

        // 更新会话状态为等待输入
        await this.sessionStorage.updateSession(sessionId, {
          status: 'waiting_input',
          currentStepId: firstUserInputStep.stepId,
          pendingInput: {
            stepId: firstUserInputStep.stepId,
            schema: firstStepSchema,
            surfaceId: `form-${sessionId}`
          }
        });

        // 暂停执行，等待 resumeSession 被调用
        return;
      }

      // 如果没有用户输入步骤，直接执行计划
      const result = await this.sessionManager.executeSession(sessionId);

      // 发射每个步骤的 stepComplete 和 surfaceUpdate 事件
      // 注意：不要发射 stepStart，因为用户输入步骤已经被跳过
      if (result.steps) {
        for (const stepResult of result.steps) {
          // 跳过已经通过 inputRequested 事件处理的 user_input 步骤
          // 这些步骤已经被标记为 skipped，不需要再次发射 stepComplete
          if (stepResult.type === 'user_input' && (stepResult as any).skipped) {
            console.log(`[CoreBridge] Skipping stepComplete for already-handled user_input step ${stepResult.stepId}`);
            continue;
          }

          // 发射 stepComplete 事件
          const stepAny = stepResult as any;
          sseManager.emit(sessionId, {
            type: 'stepComplete',
            sessionId,
            stepId: stepResult.stepId,
            stepType: stepResult.type,
            success: stepResult.success,
            result: stepAny.result,
            error: stepAny.error,
            timestamp: new Date().toISOString()
          });

          // 发射 surfaceUpdate 事件（生成 A2UI 组件）
          const components = this.generateA2UIComponents(stepResult);
          if (components.length > 0) {
            sseManager.emit(sessionId, {
              type: 'surfaceUpdate',
              sessionId,
              surfaceId: `result-${sessionId}-${stepResult.stepId}`,
              components,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // 发射执行完成事件
      sseManager.emit(sessionId, {
        type: 'executionComplete',
        sessionId,
        success: result.success,
        result,
        timestamp: new Date().toISOString()
      });

      console.log(`[CoreBridge] Session execution completed: ${result.success}`);
    } catch (error) {
      console.error(`[CoreBridge] Error executing session:`, error);

      // 发射错误事件
      sseManager.emit(sessionId, {
        type: 'executionError',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * 执行会话（原始方法，不发射SSE）
   *
   * @param sessionId - 会话 ID
   */
  async executeSession(
    sessionId: string
  ): Promise<ExecutionResult> {
    try {
      console.log(`[CoreBridge] Executing session: ${sessionId}`);

      const result = await this.sessionManager.executeSession(sessionId);

      console.log(`[CoreBridge] Session execution completed: ${result.success}`);

      return result;
    } catch (error) {
      console.error(`[CoreBridge] Error executing session:`, error);
      throw error;
    }
  }

  /**
   * 根据函数结果生成 A2UI 组件
   * 如果结果是数组，生成表格组件；如果是对象，生成卡片组件
   *
   * @param stepResult - 步骤执行结果
   * @returns A2UI 组件数组
   */
  private generateA2UIComponents(stepResult: StepResult): A2UIComponent[] {
    const components: A2UIComponent[] = [];

    // 如果步骤失败，生成错误提示
    if (!stepResult.success) {
      components.push({
        id: `error-${stepResult.stepId}`,
        component: {
          Card: {
            title: `步骤 ${stepResult.stepId} 执行失败`,
            children: [stepResult.error || '未知错误']
          }
        }
      });
      return components;
    }

    const result = (stepResult as any).result;

    // 如果结果是数组，生成表格
    if (Array.isArray(result)) {
      if (result.length === 0) {
        components.push({
          id: `text-${stepResult.stepId}`,
          component: {
            Text: {
              text: `${(stepResult as any).functionName || '步骤 ' + stepResult.stepId}: 返回空结果`
            }
          }
        });
      } else {
        // 从数组中提取表头（使用对象的键作为列名）
        const headers = Object.keys(result[0]);
        const rows = result.map(item => headers.map(h => item[h] ?? null));

        components.push({
          id: `table-${stepResult.stepId}`,
          component: {
            Table: {
              headers,
              rows
            }
          }
        });
      }
    }
    // 如果结果是对象，生成卡片
    else if (result && typeof result === 'object') {
      const children = Object.entries(result).map(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${displayValue}`;
      });

      components.push({
        id: `card-${stepResult.stepId}`,
        component: {
          Card: {
            title: (stepResult as any).functionName || `步骤 ${stepResult.stepId} 结果`,
            children
          }
        }
      });
    }
    // 其他类型，生成文本
    else {
      components.push({
        id: `text-${stepResult.stepId}`,
        component: {
          Text: {
            text: `${(stepResult as any).functionName || '步骤 ' + stepResult.stepId}: ${String(result)}`
          }
        }
      });
    }

    return components;
  }

  /**
   * 恢复会话（提交用户输入并继续执行）
   *
   * @param sessionId - 会话 ID
   * @param inputData - 用户输入数据
   */
  async resumeSessionWithSSE(
    sessionId: string,
    inputData: Record<string, any>
  ): Promise<void> {
    try {
      console.log(`[CoreBridge] Resuming session ${sessionId} with input:`, inputData);

      // 获取当前会话，找到用户输入步骤的 ID
      const session = await this.sessionStorage.loadSession(sessionId);
      const inputStepId = session?.pendingInput?.stepId ?? 0;

      // 发射 inputReceived 事件
      sseManager.emit(sessionId, {
        type: 'inputReceived',
        sessionId,
        stepId: inputStepId,
        status: 'accepted',
        timestamp: new Date().toISOString()
      });

      // 调用核心的 resumeSession，它会从下一步继续执行
      // 注意：resumeSession 内部会调用 executor.execute，所以不需要额外调用 continueExecution
      const result = await this.sessionManager.resumeSession(sessionId, inputData);

      // 发射每个步骤的 stepComplete 和 surfaceUpdate 事件
      // 注意：不要发射 stepStart，resumeSession 返回的结果中已经包含了用户输入步骤的结果
      if (result.steps) {
        for (const stepResult of result.steps) {
          // 如果步骤结果是 user_input 类型，可能是：
          // 1. 刚刚提交的用户输入步骤 - 需要发射 stepComplete
          // 2. 下一个等待输入的步骤（skipped=true）- 不需要发射 stepComplete
          if (stepResult.type === 'user_input') {
            if ((stepResult as any).skipped) {
              // 这是下一个等待输入的步骤，不需要发射 stepComplete
              // inputRequested 事件会在下面处理
              continue;
            }
            // 这是刚刚提交的用户输入步骤，发射 stepComplete
            const stepAny = stepResult as any;
            sseManager.emit(sessionId, {
              type: 'stepComplete',
              sessionId,
              stepId: stepResult.stepId,
              stepType: stepResult.type,
              success: stepResult.success,
              result: stepAny.result,
              error: stepAny.error,
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // 发射 function_call 步骤的 stepComplete 事件
          const stepAny = stepResult as any;
          sseManager.emit(sessionId, {
            type: 'stepComplete',
            sessionId,
            stepId: stepResult.stepId,
            stepType: stepResult.type,
            success: stepResult.success,
            result: stepAny.result,
            error: stepAny.error,
            timestamp: new Date().toISOString()
          });

          // 发射 surfaceUpdate 事件（生成 A2UI 组件）
          const components = this.generateA2UIComponents(stepResult);
          if (components.length > 0) {
            sseManager.emit(sessionId, {
              type: 'surfaceUpdate',
              sessionId,
              surfaceId: `result-${sessionId}-${stepResult.stepId}`,
              components,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // 检查是否需要更多用户输入（通过 waitingForInput 字段）
      const needsMoreInput = result.waitingForInput !== undefined;

      if (needsMoreInput) {
        const nextPendingStepId = result.waitingForInput!.stepId;

        // 需要更多用户输入，更新会话状态并发射 inputRequested 事件
        const session = await this.sessionStorage.loadSession(sessionId);
        const nextStep = session?.plan.steps.find((s: any) => s.stepId === nextPendingStepId);

        // Build context from step results for resolving dynamic options
        const contextWithResults: Record<string, unknown> = {};
        if (result.steps) {
          for (const stepResult of result.steps) {
            if (stepResult.type === 'function_call' && stepResult.success) {
              let resultValue: unknown = (stepResult as any).result;
              // Parse JSON string results (handle Python-style dict strings)
              if (typeof resultValue === 'string') {
                try {
                  resultValue = JSON.parse(resultValue);
                } catch {
                  let normalized = resultValue as string;
                  normalized = normalized.replace(/'/g, '"');
                  normalized = normalized.replace(/\bNone\b/g, 'null');
                  normalized = normalized.replace(/\bTrue\b/g, 'true');
                  normalized = normalized.replace(/\bFalse\b/g, 'false');
                  try {
                    resultValue = JSON.parse(normalized);
                  } catch {
                    // Keep as string if parsing fails
                  }
                }
              }
              contextWithResults[`step${stepResult.stepId}`] = { result: resultValue };
            } else if (stepResult.type === 'user_input' && stepResult.success) {
              contextWithResults[`step${stepResult.stepId}`] = { result: (stepResult as any).values };
            }
          }
        }

        // Build schema with resolved options from inputUI
        const pendingInputSchema = nextStep?.type === 'user_input' && (nextStep as any).inputUI
          ? buildSchemaFromInputUI(nextStep as any, contextWithResults)
          : (nextStep?.type === 'user_input' ? (nextStep as any).schema : { fields: [] });

        await this.sessionStorage.updateSession(sessionId, {
          status: 'waiting_input',
          currentStepId: nextPendingStepId,
          pendingInput: {
            stepId: nextPendingStepId,
            schema: pendingInputSchema,
            surfaceId: `user-input-${nextPendingStepId}`,
          },
          result: undefined,
        });

        // 计算进度信息
        const userInputSteps = session?.plan.steps.filter(s => s.type === 'user_input') || [];
        const currentIndex = userInputSteps.findIndex(s => (s as any).stepId === nextPendingStepId);
        const totalSteps = userInputSteps.length;
        const progressValue = Math.round(((currentIndex + 1) / totalSteps) * 100);

        // 生成进度和说明组件
        const components: A2UIComponent[] = [];

        // Progress 组件
        components.push({
          id: `progress-${nextPendingStepId}`,
          component: {
            Progress: {
              value: progressValue,
              max: 100,
              label: `步骤 ${currentIndex + 1}/${totalSteps}: ${(nextStep as any).description || '用户输入'}`
            }
          }
        });

        // Card 组件 - 步骤说明
        components.push({
          id: `card-${nextPendingStepId}`,
          component: {
            Card: {
              title: pendingInputSchema?.title || (nextStep as any).description || '步骤说明',
              content: pendingInputSchema?.description || '请填写以下信息'
            }
          }
        });

        // 发射 inputRequested 事件（包含进度和说明组件）
        sseManager.emit(sessionId, {
          type: 'inputRequested',
          sessionId,
          stepId: nextPendingStepId,
          surfaceId: `user-input-${nextPendingStepId}`,
          schema: pendingInputSchema,
          // @ts-ignore - components 是扩展属性
          components,
          timestamp: new Date().toISOString()
        });

        console.log(`[CoreBridge] Session ${sessionId} waiting for more input at step ${nextPendingStepId}`);
        return; // 不发射 executionComplete，继续等待输入
      }

      // 发射执行完成事件
      sseManager.emit(sessionId, {
        type: 'executionComplete',
        sessionId,
        success: result.success,
        result,
        timestamp: new Date().toISOString()
      });

      console.log(`[CoreBridge] Session resumed and execution completed: ${result.success}`);
    } catch (error) {
      console.error(`[CoreBridge] Error resuming session:`, error);

      // 发射错误事件
      sseManager.emit(sessionId, {
        type: 'executionError',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * 继续执行会话（在用户输入后）
   *
   * @param sessionId - 会话 ID
   */
  private async continueExecution(sessionId: string): Promise<void> {
    try {
      // 加载会话
      const session = await this.sessionStorage.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 找到下一个需要执行的步骤
      const currentStepIndex = session.currentStepId;
      const remainingSteps = session.plan.steps.slice(currentStepIndex);

      // 执行剩余步骤
      for (const step of remainingSteps) {
        await new Promise(resolve => setTimeout(resolve, 500));

        sseManager.emit(sessionId, {
          type: 'stepStart',
          sessionId,
          stepId: step.stepId,
          functionName: step.type === 'function_call' ? (step as any).functionName : undefined,
          timestamp: new Date().toISOString()
        });

        // 检查是否又遇到用户输入步骤
        if (step.type === 'user_input') {
          // Build context from step results for resolving dynamic options
          const contextForStep: Record<string, unknown> = {};
          if (session.stepResults) {
            for (const stepResult of session.stepResults) {
              if (stepResult.type === 'function_call' && stepResult.success) {
                let resultValue: unknown = (stepResult as any).result;
                if (typeof resultValue === 'string') {
                  try {
                    resultValue = JSON.parse(resultValue);
                  } catch {
                    let normalized = resultValue as string;
                    normalized = normalized.replace(/'/g, '"');
                    normalized = normalized.replace(/\bNone\b/g, 'null');
                    normalized = normalized.replace(/\bTrue\b/g, 'true');
                    normalized = normalized.replace(/\bFalse\b/g, 'false');
                    try {
                      resultValue = JSON.parse(normalized);
                    } catch {
                      // Keep as string
                    }
                  }
                }
                contextForStep[`step${stepResult.stepId}`] = { result: resultValue };
              } else if (stepResult.type === 'user_input' && stepResult.success) {
                contextForStep[`step${stepResult.stepId}`] = { result: (stepResult as any).values };
              }
            }
          }

          const stepSchema = (step as any).inputUI
            ? buildSchemaFromInputUI(step as any, contextForStep)
            : (step as any).schema;

          sseManager.emit(sessionId, {
            type: 'inputRequested',
            sessionId,
            surfaceId: `form-${sessionId}`,
            schema: stepSchema,
            stepId: step.stepId,
            timestamp: new Date().toISOString()
          });

          await this.sessionStorage.updateSession(sessionId, {
            status: 'waiting_input',
            pendingInput: {
              stepId: step.stepId,
              schema: stepSchema,
              surfaceId: `form-${sessionId}`
            }
          });

          return; // 再次暂停
        }
      }

      // 所有步骤完成，执行计划
      const result = await this.sessionManager.executeSession(sessionId);

      // 发射完成事件
      sseManager.emit(sessionId, {
        type: 'executionComplete',
        sessionId,
        success: result.success,
        result,
        timestamp: new Date().toISOString()
      });

      console.log(`[CoreBridge] Execution fully completed: ${result.success}`);
    } catch (error) {
      console.error(`[CoreBridge] Error continuing execution:`, error);
      throw error;
    }
  }

  /**
   * 恢复会话（原始方法，不发射 SSE）
   *
   * @param sessionId - 会话 ID
   * @param inputData - 用户输入数据
   */
  async resumeSession(
    sessionId: string,
    inputData: Record<string, any>
  ): Promise<void> {
    try {
      console.log(`[CoreBridge] Resuming session ${sessionId} with input:`, inputData);

      await this.sessionManager.resumeSession(sessionId, inputData);

      console.log(`[CoreBridge] Session resumed successfully`);
    } catch (error) {
      console.error(`[CoreBridge] Error resuming session:`, error);
      throw error;
    }
  }

  /**
   * 获取会话详情
   *
   * @param sessionId - 会话 ID
   * @returns 会话对象
   */
  async getSession(sessionId: string): Promise<ExecutionSession> {
    try {
      const session = await this.sessionStorage.loadSession(sessionId);

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      return session;
    } catch (error) {
      console.error(`[CoreBridge] Error loading session:`, error);
      throw error;
    }
  }

  /**
   * 按计划 ID 列出会话
   *
   * @param planId - 计划 ID (可选，如果不提供则返回所有会话)
   * @returns 会话列表
   */
  async listSessionsByPlan(planId?: string): Promise<ExecutionSession[]> {
    try {
      if (planId) {
        const sessions = await this.sessionStorage.listSessionsByPlan(planId);
        // 按创建时间倒序排列 (最新的在前)
        return sessions.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        const sessions = await this.sessionStorage.listSessions({});
        return sessions.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    } catch (error) {
      console.error(`[CoreBridge] Error listing sessions:`, error);
      throw error;
    }
  }

  /**
   * 列出所有计划
   *
   * @returns 计划列表
   */
  async listPlans(): Promise<ExecutionPlan[]> {
    try {
      const plans = await this.planStorage.listPlans();
      return plans;
    } catch (error) {
      console.error(`[CoreBridge] Error listing plans:`, error);
      throw error;
    }
  }

  /**
   * 获取计划详情
   *
   * @param planId - 计划 ID
   * @returns 计划对象
   */
  async getPlan(planId: string): Promise<ExecutionPlan> {
    try {
      const plan = await this.planStorage.loadPlan(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      return plan;
    } catch (error) {
      console.error(`[CoreBridge] Error loading plan:`, error);
      throw error;
    }
  }

  /**
   * 取消会话
   *
   * @param sessionId - 会话 ID
   */
  async cancelSession(sessionId: string): Promise<void> {
    try {
      console.log(`[CoreBridge] Cancelling session: ${sessionId}`);

      await this.sessionManager.cancelSession(sessionId);

      console.log(`[CoreBridge] Session cancelled successfully`);
    } catch (error) {
      console.error(`[CoreBridge] Error cancelling session:`, error);
      throw error;
    }
  }

  /**
   * 重试会话
   *
   * @param sessionId - 会话 ID
   * @param fromStep - 可选，从指定步骤开始重试
   * @returns 新创建的会话
   */
  async retrySession(
    sessionId: string,
    fromStep?: number
  ): Promise<ExecutionSession> {
    try {
      console.log(`[CoreBridge] Retrying session: ${sessionId} from step ${fromStep || 'start'}`);

      const newSession = await this.sessionManager.retrySession(sessionId, fromStep);

      console.log(`[CoreBridge] Retry session created: ${newSession.id}`);

      return newSession;
    } catch (error) {
      console.error(`[CoreBridge] Error retrying session:`, error);
      throw error;
    }
  }
}

// Lazy singleton instance
let _coreBridgeInstance: CoreBridge | null = null;

export function getCoreBridge(): CoreBridge {
  if (!_coreBridgeInstance) {
    _coreBridgeInstance = new CoreBridge();
  }
  return _coreBridgeInstance;
}

// For backwards compatibility, export coreBridge as a getter
export const coreBridge = {
  get createAndExecuteSession() { return getCoreBridge().createAndExecuteSession.bind(getCoreBridge()); },
  get executeSessionWithSSE() { return getCoreBridge().executeSessionWithSSE.bind(getCoreBridge()); },
  get executeSession() { return getCoreBridge().executeSession.bind(getCoreBridge()); },
  get resumeSessionWithSSE() { return getCoreBridge().resumeSessionWithSSE.bind(getCoreBridge()); },
  get resumeSession() { return getCoreBridge().resumeSession.bind(getCoreBridge()); },
  get getSession() { return getCoreBridge().getSession.bind(getCoreBridge()); },
  get listSessionsByPlan() { return getCoreBridge().listSessionsByPlan.bind(getCoreBridge()); },
  get listPlans() { return getCoreBridge().listPlans.bind(getCoreBridge()); },
  get getPlan() { return getCoreBridge().getPlan.bind(getCoreBridge()); },
  get cancelSession() { return getCoreBridge().cancelSession.bind(getCoreBridge()); },
  get retrySession() { return getCoreBridge().retrySession.bind(getCoreBridge()); }
};
