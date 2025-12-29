/**
 * LocalFunctionProvider 实现
 * 本地函数提供者，实现 FunctionProvider 接口
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { FunctionDefinition } from '../registry/types.js';
import type { FunctionMetadata, FunctionExecutionResult } from './types.js';
import type { FunctionProvider } from './interfaces/FunctionProvider.js';

/**
 * 将 FunctionDefinition 转换为 FunctionMetadata
 */
function toMetadata(fn: FunctionDefinition, source: string): FunctionMetadata {
  return {
    id: fn.name, // 使用 name 作为 id
    name: fn.name,
    description: fn.description,
    scenario: fn.scenario,
    parameters: fn.parameters,
    returns: fn.returns,
    type: 'local',
    source,
  };
}

/**
 * 本地函数提供者
 *
 * 职责：
 * - 管理本地函数的注册和执行
 * - 实现 FunctionProvider 接口
 *
 * 使用场景：
 * - CLI 应用启动时加载的本地函数
 * - Mock 函数
 * - 测试环境
 */
@injectable()
export class LocalFunctionProvider implements FunctionProvider {
  private functions: Map<string, FunctionDefinition> = new Map();

  /**
   * 获取 Provider 类型
   */
  getType(): 'local' {
    return 'local';
  }

  /**
   * 获取来源标识
   */
  getSource(): string {
    return 'local';
  }

  /**
   * 注册一个函数
   *
   * @param fn 函数定义
   * @throws {Error} 重复注册时抛出
   */
  register(fn: FunctionDefinition): void {
    if (this.functions.has(fn.name)) {
      throw new Error(`Function already registered: ${fn.name}`);
    }
    this.functions.set(fn.name, fn);
  }

  /**
   * 列出所有可用函数
   */
  async list(): Promise<FunctionMetadata[]> {
    return Array.from(this.functions.values()).map(fn =>
      toMetadata(fn, this.getSource())
    );
  }

  /**
   * 检查函数是否存在
   */
  async has(name: string): Promise<boolean> {
    return this.functions.has(name);
  }

  /**
   * 获取函数元数据
   */
  async get(name: string): Promise<FunctionMetadata | undefined> {
    const fn = this.functions.get(name);
    return fn ? toMetadata(fn, this.getSource()) : undefined;
  }

  /**
   * 执行函数
   */
  async execute(
    name: string,
    params: Record<string, unknown>
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();

    try {
      const fn = this.functions.get(name);
      if (!fn) {
        return {
          success: false,
          error: `Function not found: ${name}`,
          metadata: {
            executionTime: Date.now() - startTime,
            provider: this.getSource(),
          },
        };
      }

      // 按参数定义顺序提取参数值
      const args = fn.parameters.map((p) => params[p.name]);
      const result = fn.implementation(...args);

      // 如果返回 Promise，等待其完成
      const finalResult = result instanceof Promise
        ? await result
        : result;

      return {
        success: true,
        result: finalResult,
        metadata: {
          executionTime: Date.now() - startTime,
          provider: this.getSource(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime,
          provider: this.getSource(),
        },
      };
    }
  }

  /**
   * 清空所有注册的函数
   */
  clear(): void {
    this.functions.clear();
  }
}
