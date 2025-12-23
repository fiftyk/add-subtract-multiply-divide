import type { FunctionDefinition, FunctionDefinitionInput } from './types.js';

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
export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();

  /**
   * 注册一个函数
   */
  register(fn: FunctionDefinition): void {
    if (this.functions.has(fn.name)) {
      throw new Error(`Function "${fn.name}" already registered`);
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
   * 获取所有函数的描述信息（用于 LLM prompt）
   */
  getAllDescriptions(): string {
    const functions = this.getAll();
    if (functions.length === 0) {
      return '当前没有可用的函数。';
    }

    return functions
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
  }

  /**
   * 执行函数
   */
  execute(name: string, params: Record<string, unknown>): unknown {
    const fn = this.functions.get(name);
    if (!fn) {
      throw new Error(`Function "${name}" not found`);
    }

    // 按参数定义顺序提取参数值
    const args = fn.parameters.map((p) => params[p.name]);
    return fn.implementation(...args);
  }

  /**
   * 清空所有注册的函数
   */
  clear(): void {
    this.functions.clear();
  }
}
