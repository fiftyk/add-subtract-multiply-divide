import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { FunctionRegistry } from '../registry/interfaces/FunctionRegistry.js';
import { ToolProvider } from './interfaces/ToolProvider.js';
import type { FunctionMetadata } from '../function-provider/types.js';

/**
 * 本地函数工具提供者
 * 将 FunctionRegistry 中的本地函数转换为 FunctionMetadata 格式
 */
@injectable()
export class LocalFunctionToolProvider implements ToolProvider {
  constructor(@inject(FunctionRegistry) private registry: FunctionRegistry) {}

  /**
   * 查询所有可用工具（本地函数）
   * 异步实现以符合接口设计（本地操作无需真正异步）
   */
  async searchTools(): Promise<FunctionMetadata[]> {
    const functions = this.registry.getAll();
    return functions.map((fn) => this.toFunctionMetadata(fn));
  }

  /**
   * 验证工具是否存在
   * 异步实现以符合接口设计（本地操作无需真正异步）
   */
  async hasTool(id: string): Promise<boolean> {
    return this.registry.has(id);
  }

  /**
   * 将 FunctionDefinition 转换为 FunctionMetadata
   */
  private toFunctionMetadata(fn: { name: string; description: string; scenario: string; parameters: unknown[]; returns: { type: unknown; description: unknown } }): FunctionMetadata {
    return {
      id: fn.name, // 本地函数使用 name 作为 id
      type: 'local',
      name: fn.name,
      description: fn.description,
      scenario: fn.scenario,
      parameters: fn.parameters as FunctionMetadata['parameters'],
      returns: fn.returns as FunctionMetadata['returns'],
      source: 'local',
    };
  }
}
