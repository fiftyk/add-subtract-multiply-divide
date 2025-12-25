import 'reflect-metadata';
import { injectable } from 'inversify';
import type { FunctionDefinition, FunctionDefinitionInput } from './types.js';
import {
  FunctionNotFoundError,
  FunctionAlreadyRegisteredError,
} from '../errors/index.js';
import { TypeValidator } from '../validation/index.js';

/**
 * 创建函数定义
 */
export function defineFunction(input: FunctionDefinitionInput): FunctionDefinition {
  return {
    name: input.name,
    description: input.description,
    scenario: input.scenario,
    parameters: input.parameters,
    returns: input.returns,
    implementation: input.implementation,
  };
}

/**
 * 函数注册表
 */
@injectable()
export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();

  /**
   * 注册一个函数
   */
  register(fn: FunctionDefinition): void {
    if (this.functions.has(fn.name)) {
      throw new FunctionAlreadyRegisteredError(fn.name);
    }
    this.functions.set(fn.name, fn);
  }

  /**
   * 检查函数是否存在
   */
  has(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * 获取函数定义
   */
  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  /**
   * 获取所有函数定义
   */
  getAll(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  /**
   * 执行函数（支持同步和异步函数）
   */
  async execute(name: string, params: Record<string, unknown>): Promise<unknown> {
    const fn = this.functions.get(name);
    if (!fn) {
      const availableFunctions = Array.from(this.functions.keys());
      throw new FunctionNotFoundError(name, availableFunctions);
    }

    // Validate parameters before execution
    TypeValidator.validateFunctionParameters(fn, params);

    // 按参数定义顺序提取参数值
    const args = fn.parameters.map((p) => params[p.name]);
    const result = fn.implementation(...args);

    // 如果返回 Promise，等待其完成
    if (result instanceof Promise) {
      return await result;
    }

    return result;
  }

  /**
   * 清空所有注册的函数
   */
  clear(): void {
    this.functions.clear();
  }
}
