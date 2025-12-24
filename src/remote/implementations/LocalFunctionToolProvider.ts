import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { FunctionRegistry } from '../../registry/index.js';
import { ToolProvider } from '../interfaces/tool-provider.js';
import type { ToolDefinition } from '../types.js';

/**
 * 本地函数工具提供者
 * 将 FunctionRegistry 中的本地函数转换为 ToolDefinition 格式
 */
@injectable()
export class LocalFunctionToolProvider implements ToolProvider {
  constructor(@inject(FunctionRegistry) private registry: FunctionRegistry) {}

  /**
   * 查询所有可用工具（本地函数）
   */
  searchTools(): ToolDefinition[] {
    const functions = this.registry.getAll();
    return functions.map((fn) => this.toToolDefinition(fn));
  }

  /**
   * 将 FunctionDefinition 转换为 ToolDefinition
   */
  private toToolDefinition(fn: { name: string; description: string; scenario: string; parameters: unknown[]; returns: { type: unknown; description: unknown } }): ToolDefinition {
    return {
      id: fn.name, // 本地函数使用 name 作为 id
      type: 'local',
      name: fn.name,
      description: fn.description,
      scenario: fn.scenario,
      parameters: fn.parameters as ToolDefinition['parameters'],
      returns: fn.returns as ToolDefinition['returns'],
    };
  }
}
