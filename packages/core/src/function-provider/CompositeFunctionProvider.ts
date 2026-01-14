/**
 * CompositeFunctionProvider 实现
 * 组合多个 FunctionProvider，提供统一的函数访问接口
 */

import 'reflect-metadata';
import { injectable, inject, optional, unmanaged, multiInject } from 'inversify';
import type { FunctionMetadata, FunctionExecutionResult } from './types.js';
import { FunctionExecutionError } from './types.js';
import type { FunctionDefinition } from '../registry/types.js';
import { FunctionProvider } from './interfaces/FunctionProvider.js';
import { LocalFunctionProviderSymbol, AllRemoteFunctionProvidersSymbol } from './symbols.js';
import { LocalFunctionProvider } from './LocalFunctionProvider.js';
import { MCPFunctionProvider } from './implementations/MCPFunctionProvider.js';

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
 * 函数名格式支持：
 * - "functionName" - 使用 first-wins 策略（本地优先）
 * - "local:functionName" - 指定使用本地函数
 * - "mcp:serverName:functionName" - 指定使用某个 MCP server 的函数
 *   例如: "mcp:filesystem:search_patents", "mcp:patent-api:get_patent_details"
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
  private localProvider: LocalFunctionProvider | null = null;

  constructor(
    @inject(LocalFunctionProviderSymbol) @optional() localProvider?: LocalFunctionProvider | FunctionProvider[],
    @inject(AllRemoteFunctionProvidersSymbol) @optional() remoteProviders?: MCPFunctionProvider[],
    @unmanaged() config?: CompositeFunctionProviderConfig
  ) {
    // 检测是否是直接实例化（测试场景）：第一个参数是数组
    if (Array.isArray(localProvider)) {
      // 测试场景：new CompositeFunctionProvider([providers], config?)
      this.providers = localProvider;
      this.localProvider = null;
    } else {
      // 容器注入时：组合本地和多个远程 Providers
      this.providers = [];
      if (localProvider) {
        this.providers.push(localProvider);
        this.localProvider = localProvider as LocalFunctionProvider;
      } else {
        this.localProvider = null;
      }
      // 添加所有远程 Providers（支持多个 MCP servers）
      if (remoteProviders && remoteProviders.length > 0) {
        this.providers.push(...remoteProviders);
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
   * 解析带前缀的函数名
   *
   * 格式：
   * - "local:functionName" -> { source: "local", name: "functionName" }
   * - "mcp:serverName:functionName" -> { source: "mcp://serverName", name: "functionName" }
   * - "mcp:functionName" -> { source: "mcp", name: "functionName" }
   * - "functionName" -> { source: null, name: "functionName" }
   */
  private parsePrefixedName(name: string): { source: string | null; name: string } {
    const parts = name.split(':');

    // 没有前缀
    if (parts.length === 1 || (parts.length === 2 && parts[0] === '')) {
      return { source: null, name: parts[parts.length - 1] };
    }

    // local:functionName
    if (parts[0] === 'local') {
      return { source: 'local', name: parts.slice(1).join(':') };
    }

    // mcp:serverName:functionName 或 mcp:functionName
    if (parts[0] === 'mcp') {
      if (parts.length >= 3) {
        // mcp:serverName:functionName -> source: "mcp://serverName"
        const serverName = parts[1];
        return { source: `mcp://${serverName}`, name: parts.slice(2).join(':') };
      } else {
        // mcp:functionName (没有指定 server)
        return { source: 'mcp', name: parts[1] };
      }
    }

    // 未知前缀，保持原样
    return { source: null, name };
  }

  /**
   * 根据 source 查找对应的 Provider
   */
  private findProviderBySource(source: string): FunctionProvider | undefined {
    // 查找本地 Provider
    if (source === 'local') {
      return this.localProvider || this.providers.find(p => p.getSource() === 'local');
    }

    // 查找 MCP Provider - source 格式: "mcp" 或 "mcp://serverName"
    if (source === 'mcp') {
      // 只有 "mcp" 前缀，查找第一个 MCP Provider
      return this.providers.find(p => p.getSource()?.startsWith('mcp'));
    }

    // 处理 mcp:serverName 格式或 mcp://serverName 格式
    if (source.startsWith('mcp:') || source.startsWith('mcp://')) {
      // 提取 serverName: mcp:server -> server, mcp://server -> server
      const serverName = source.replace(/^mcp:(\/\/)?/, '');
      if (!serverName) {
        return undefined;
      }
      // 查找特定 server 的 MCP Provider
      return this.providers.find(p => p.getSource() === `mcp://${serverName}`);
    }

    return undefined;
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
    const { source, name: fnName } = this.parsePrefixedName(name);

    if (source) {
      // 指定了 source，直接从对应 Provider 查找
      const provider = this.findProviderBySource(source);
      return provider ? await provider.has(fnName) : false;
    }

    // 未指定 source，使用 first-wins 策略
    for (const provider of this.providers) {
      if (await provider.has(fnName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取函数元数据
   */
  async get(name: string): Promise<FunctionMetadata | undefined> {
    const { source, name: fnName } = this.parsePrefixedName(name);

    if (source) {
      // 指定了 source，直接从对应 Provider 查找
      const provider = this.findProviderBySource(source);
      return provider ? await provider.get(fnName) : undefined;
    }

    // 未指定 source，使用 first-wins 策略
    for (const provider of this.providers) {
      const fn = await provider.get(fnName);
      if (fn) {
        return fn;
      }
    }
    return undefined;
  }

  /**
   * 执行函数
   * 支持带 source 前缀的函数名格式
   */
  async execute(
    name: string,
    params: Record<string, unknown>
  ): Promise<FunctionExecutionResult> {
    const { source, name: fnName } = this.parsePrefixedName(name);

    if (source) {
      // 指定了 source，从对应 Provider 执行
      const provider = this.findProviderBySource(source);
      if (!provider) {
        return {
          success: false,
          error: `Provider not found for source: ${source}`,
          metadata: {
            provider: this.getSource(),
          },
        };
      }

      // 检查函数是否存在
      if (!(await provider.has(fnName))) {
        return {
          success: false,
          error: `Function "${fnName}" not found in provider: ${source}`,
          metadata: {
            provider: this.getSource(),
          },
        };
      }

      return provider.execute(fnName, params);
    }

    // 未指定 source，使用 first-wins 策略
    for (const provider of this.providers) {
      if (await provider.has(fnName)) {
        return provider.execute(fnName, params);
      }
    }

    return {
      success: false,
      error: `Function not found: ${fnName}`,
      metadata: {
        provider: this.getSource(),
      },
    };
  }

  /**
   * 执行函数，失败时抛出异常
   *
   * @param name - 函数名（支持前缀格式）
   * @param params - 函数参数
   * @returns 执行结果
   * @throws FunctionExecutionError - 函数执行失败时抛出
   */
  async executeOrThrow(
    name: string,
    params: Record<string, unknown>
  ): Promise<FunctionExecutionResult> {
    const result = await this.execute(name, params);

    if (!result.success) {
      throw new FunctionExecutionError(name, result);
    }

    return result;
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
   * 注册函数（委托给本地 Provider）
   */
  register(fn: FunctionDefinition): void {
    if (this.localProvider) {
      this.localProvider.register(fn);
    }
  }

  /**
   * 清空所有注册的函数（委托给本地 Provider）
   */
  clear(): void {
    if (this.localProvider) {
      this.localProvider.clear();
    }
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
