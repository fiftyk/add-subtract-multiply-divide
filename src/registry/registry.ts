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
  private descriptionsCache: string | null = null;

  /**
   * 注册一个函数
   */
  register(fn: FunctionDefinition): void {
    if (this.functions.has(fn.name)) {
      throw new FunctionAlreadyRegisteredError(fn.name);
    }
    this.functions.set(fn.name, fn);
    // 使缓存失效
    this.descriptionsCache = null;
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
   * 获取所有函数的描述信息（用于 LLM prompt）
   * 结果会被缓存以提高性能
   */
  getAllDescriptions(): string {
    // 返回缓存结果（如果存在）
    if (this.descriptionsCache !== null) {
      return this.descriptionsCache;
    }

    // 生成并缓存结果
    const functions = this.getAll();
    if (functions.length === 0) {
      this.descriptionsCache = '当前没有可用的函数。';
      return this.descriptionsCache;
    }

    this.descriptionsCache = functions
      .map((fn) => {
        const params = fn.parameters
          .map((p) => `    - ${p.name} (${p.type}): ${p.description}`)
          .join('\n');

        return `- ${fn.name}: ${fn.description}
  使用场景: ${fn.scenario}
  参数:
${params || '    (无参数)'}
  返回值: ${fn.returns.type} - ${fn.returns.description}`;
      })
      .join('\n\n');

    return this.descriptionsCache;
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
    // 使缓存失效
    this.descriptionsCache = null;
  }
}
