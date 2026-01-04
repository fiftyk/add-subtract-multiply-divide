/**
 * HTTP User Input Provider
 *
 * 通过 HTTP API 实现用户输入支持
 * 用于交互式会话中暂停执行并等待用户输入
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { FormInputSchema, FormInputField, FormInputResult } from '../interfaces/FormInputSchema.js';
import type { UserInputProvider, UserInputRequest } from '../interfaces/UserInputProvider.js';
import type { SessionPendingInput, UserInputResponse } from '../../core/services/interfaces/InteractiveSession.js';

/**
 * 用户输入超时时间（毫秒）
 */
const USER_INPUT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * HTTP 用户输入提供者实现
 *
 * 工作流程:
 * 1. 当执行器需要用户输入时，调用 requestInput()
 * 2. 创建待处理的输入请求并存储
 * 3. 等待输入响应（通过 API 或 WebSocket）
 * 4. 返回用户输入结果
 */
@injectable()
export class HttpUserInputProvider implements UserInputProvider {
  /**
   * 待处理的输入请求
   * key: sessionId + stepId
   */
  private pendingInputs: Map<string, SessionPendingInput> = new Map();

  /**
   * Promise resolvers for pending inputs
   * key: sessionId + stepId
   */
  private pendingResolvers: Map<
    string,
    {
      resolve: (value: FormInputResult) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  > = new Map();

  /**
   * 请求用户输入
   *
   * @param schema Form Input Schema 定义
   * @param context 执行上下文
   * @returns 用户输入结果
   */
  async requestInput(schema: FormInputSchema, context?: Record<string, unknown>): Promise<FormInputResult> {
    const sessionId = context?.sessionId as string;
    const stepId = context?.stepId as number;

    if (!sessionId || !stepId) {
      throw new Error('Missing sessionId or stepId in context');
    }

    const requestId = `${sessionId}-step-${stepId}`;

    // 检查是否已有待处理的输入
    if (this.pendingInputs.has(requestId)) {
      throw new Error(`Input already pending for ${requestId}`);
    }

    // 创建待处理输入
    const pendingInput: SessionPendingInput = {
      sessionId,
      stepId,
      schema,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.pendingInputs.set(requestId, pendingInput);

    // 使用 Promise 等待输入响应
    return new Promise<FormInputResult>((resolve, reject) => {
      // 设置超时定时器
      const timer = setTimeout(() => {
        this.pendingInputs.delete(requestId);
        this.pendingResolvers.delete(requestId);
        reject(new Error(`User input timeout after ${USER_INPUT_TIMEOUT_MS}ms for ${requestId}`));
      }, USER_INPUT_TIMEOUT_MS);

      // 存储 resolver 供 submitInput 调用
      this.pendingResolvers.set(requestId, { resolve, reject, timer });
    });
  }

  /**
   * 检查是否支持特定字段类型
   *
   * @param type 字段类型
   * @returns 是否支持
   */
  supportsFieldType(type: string): boolean {
    // 支持所有标准类型
    const supportedTypes = [
      'text',
      'number',
      'boolean',
      'select',
      'multiselect',
      'textarea',
      'date',
      'email',
      'password',
    ];
    return supportedTypes.includes(type.toLowerCase());
  }

  /**
   * 创建输入请求
   *
   * @param sessionId 会话 ID
   * @param stepId 步骤 ID
   * @param schema Form Input Schema
   * @returns 请求信息
   */
  createInputRequest(
    sessionId: string,
    stepId: number,
    schema: FormInputSchema
  ): UserInputRequest {
    const requestId = `${sessionId}-step-${stepId}`;

    // 转换为更简单的格式用于 API 返回
    const fields = schema.fields.map((field: FormInputField) => ({
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required ?? false,
      options: (field as any).options, // For select fields
    }));

    const request: UserInputRequest = {
      requestId,
      sessionId,
      stepId,
      fields,
      createdAt: new Date().toISOString(),
    };

    return request;
  }

  /**
   * 存储待处理的输入请求
   *
   * @param sessionId 会话 ID
   * @param stepId 步骤 ID
   * @param schema Form Input Schema
   * @returns 请求信息
   */
  addPendingInput(sessionId: string, stepId: number, schema: FormInputSchema): UserInputRequest {
    const requestId = `${sessionId}-step-${stepId}`;
    const request = this.createInputRequest(sessionId, stepId, schema);

    this.pendingInputs.set(requestId, {
      sessionId,
      stepId,
      schema,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return request;
  }

  /**
   * 提交用户输入响应
   *
   * @param sessionId 会话 ID
   * @param stepId 步骤 ID
   * @param values 用户输入的值
   * @returns 是否成功
   */
  submitInput(sessionId: string, stepId: number, values: Record<string, unknown>): boolean {
    const requestId = `${sessionId}-step-${stepId}`;
    const pendingInput = this.pendingInputs.get(requestId);
    const resolver = this.pendingResolvers.get(requestId);

    if (!pendingInput || pendingInput.status !== 'pending' || !resolver) {
      return false;
    }

    // 清理超时定时器
    clearTimeout(resolver.timer);

    // 更新状态
    pendingInput.status = 'received';
    pendingInput.response = {
      values,
      submittedAt: new Date().toISOString(),
    };

    // 解析 Promise
    resolver.resolve({
      values,
      skipped: false,
      timestamp: Date.now(),
    });

    // 清理
    this.pendingInputs.delete(requestId);
    this.pendingResolvers.delete(requestId);

    return true;
  }

  /**
   * 取消待处理的输入
   *
   * @param sessionId 会话 ID
   * @param stepId 步骤 ID
   * @returns 是否成功
   */
  cancelInput(sessionId: string, stepId: number): boolean {
    const requestId = `${sessionId}-step-${stepId}`;
    const pendingInput = this.pendingInputs.get(requestId);
    const resolver = this.pendingResolvers.get(requestId);

    if (!pendingInput || pendingInput.status !== 'pending' || !resolver) {
      return false;
    }

    // 清理超时定时器
    clearTimeout(resolver.timer);

    // 更新状态
    pendingInput.status = 'cancelled';

    // 拒绝 Promise
    resolver.reject(new Error('User input cancelled'));

    // 清理
    this.pendingInputs.delete(requestId);
    this.pendingResolvers.delete(requestId);

    return true;
  }

  /**
   * 获取待处理的输入请求列表
   *
   * @param sessionId 可选的会话 ID 过滤
   * @returns 待处理请求列表
   */
  getPendingInputs(sessionId?: string): UserInputRequest[] {
    const requests: UserInputRequest[] = [];

    for (const [requestId, pendingInput] of this.pendingInputs) {
      if (sessionId && pendingInput.sessionId !== sessionId) {
        continue;
      }

      const schema: FormInputSchema = {
        version: '1.0',
        fields: pendingInput.schema.fields,
      };
      requests.push(this.createInputRequest(pendingInput.sessionId, pendingInput.stepId, schema));
    }

    return requests;
  }

  /**
   * 获取特定请求的状态
   *
   * @param sessionId 会话 ID
   * @param stepId 步骤 ID
   * @returns 状态信息或 undefined
   */
  getInputStatus(sessionId: string, stepId: number): { status: string; createdAt: string } | undefined {
    const requestId = `${sessionId}-step-${stepId}`;
    const pendingInput = this.pendingInputs.get(requestId);

    if (!pendingInput) {
      return undefined;
    }

    return {
      status: pendingInput.status,
      createdAt: pendingInput.createdAt,
    };
  }

  /**
   * 清空所有待处理的输入
   */
  clearPendingInputs(): void {
    // 清理所有定时器并拒绝所有 Promise
    for (const [requestId, resolver] of this.pendingResolvers) {
      clearTimeout(resolver.timer);
      resolver.reject(new Error('All pending inputs cleared'));
    }
    this.pendingInputs.clear();
    this.pendingResolvers.clear();
  }
}
