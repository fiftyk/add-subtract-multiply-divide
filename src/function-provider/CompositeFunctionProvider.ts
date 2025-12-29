/**
 * CompositeFunctionProvider 实现
 * 组合多个 FunctionProvider，提供统一的函数访问接口
 */

import 'reflect-metadata';
import { injectable, inject, optional, unmanaged } from 'inversify';
import type { FunctionMetadata, FunctionExecutionResult } from './types.js';
import { FunctionProvider } from './interfaces/FunctionProvider.js';
import { LocalFunctionProviderSymbol, RemoteFunctionProviderSymbol } from './symbols.js';
import { LocalFunctionProvider } from './LocalFunctionProvider.js';
import { MCPFunctionProvider } from './remote/MCPFunctionProvider.js';

/**
 * 冲突解决策略
 */
export type DuplicateResolutionStrategy = 'first-wins' | 'last-wins' | 'merge';

/**
 * 组合函数提供者配置
 */
export interface CompositeFunctionProviderConfig {
  /** 冲突解决策略 */
  resolutionStrategy?: DuplicateResolutionStrategy;

  /** 是否在列表中包含重复函数 */
  includeDuplicates?: boolean;

  /** 用于测试的 Provider 列表（直接实例化时使用） */
  _providers?: FunctionProvider[];
}

/**
 * 组合函数提供者
 *
 * 职责：
 * - 合并多个 FunctionProvider
 * - 提供统一的函数发现和执行接口
 * - 按优先级路由函数调用
 *
 * 使用场景：
 * - 同时使用本地函数和 MCP 远程函数
 * - 同时使用多个 MCP 服务器
 * - 测试环境组合多个 Provider
 */
@injectable()
export class CompositeFunctionProvider implements FunctionProvider {
  private readonly providers: FunctionProvider[];
  private readonly config: Required<CompositeFunctionProviderConfig>;

  constructor(
    @inject(LocalFunctionProviderSymbol) @optional() localProvider?: LocalFunctionProvider | FunctionProvider[],
    @inject(RemoteFunctionProviderSymbol) @optional() remoteProvider?: MCPFunctionProvider,
    @unmanaged() config?: CompositeFunctionProviderConfig
  ) {
    // 检测是否是直接实例化（测试场景）：第一个参数是数组
    if (Array.isArray(localProvider)) {
      // 测试场景：new CompositeFunctionProvider([providers], config?)
      this.providers = localProvider;
    } else {
      // 容器注入时：组合本地和远程 Provider
      this.providers = [];
      if (localProvider) {
        this.providers.push(localProvider);
      }
      if (remoteProvider) {
        this.providers.push(remoteProvider);
      }
    }
    this.config = {
      resolutionStrategy: config?.resolutionStrategy ?? 'first-wins',
      includeDuplicates: config?.includeDuplicates ?? false,
      _providers: config?._providers ?? [],
    };
  }

  /**
   * 获取 Provider 类型
   */
  getType(): 'composite' {
    return 'composite';
  }

  /**
   * 获取来源标识
   */
  getSource(): string {
    return 'composite';
  }

  /**
   * 列出所有可用函数
   */
  async list(): Promise<FunctionMetadata[]> {
    if (this.providers.length === 0) {
      return [];
    }

    const results = await Promise.all(
      this.providers.map(p => p.list())
    );

    const allFunctions = results.flat();

    // 去重策略
    if (!this.config.includeDuplicates) {
      return this.deduplicate(allFunctions);
    }

    return allFunctions;
  }

  /**
   * 检查函数是否存在
   */
  async has(name: string): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.has(name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取函数元数据
   */
  async get(name: string): Promise<FunctionMetadata | undefined> {
    for (const provider of this.providers) {
      const fn = await provider.get(name);
      if (fn) {
        return fn;
      }
    }
    return undefined;
  }

  /**
   * 执行函数
   * 自动路由到第一个拥有该函数的 Provider
   */
  async execute(
    name: string,
    params: Record<string, unknown>
  ): Promise<FunctionExecutionResult> {
    // 找到第一个拥有该函数的 Provider
    for (const provider of this.providers) {
      if (await provider.has(name)) {
        return provider.execute(name, params);
      }
    }

    return {
      success: false,
      error: `Function not found: ${name}`,
      metadata: {
        provider: this.getSource(),
      },
    };
  }

  /**
   * 初始化所有 Provider
   */
  async initialize(): Promise<void> {
    await Promise.all(
      this.providers.map(async (provider) => {
        if (typeof provider.initialize === 'function') {
          await provider.initialize();
        }
      })
    );
  }

  /**
   * 清理所有 Provider 资源
   */
  async dispose(): Promise<void> {
    await Promise.all(
      this.providers.map(async (provider) => {
        if (typeof provider.dispose === 'function') {
          await provider.dispose();
        }
      })
    );
  }

  /**
   * 去重函数列表
   * 保留第一个出现的函数（按 Provider 优先级）
   */
  private deduplicate(functions: FunctionMetadata[]): FunctionMetadata[] {
    const seen = new Map<string, FunctionMetadata>();

    for (const fn of functions) {
      if (!seen.has(fn.name)) {
        seen.set(fn.name, fn);
      }
    }

    return Array.from(seen.values());
  }
}
