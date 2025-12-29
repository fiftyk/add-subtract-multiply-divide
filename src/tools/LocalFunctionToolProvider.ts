import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ToolProvider } from './interfaces/ToolProvider.js';
import type { FunctionMetadata } from '../function-provider/types.js';
import type { LocalFunctionProvider } from '../function-provider/LocalFunctionProvider.js';
import { LocalFunctionProviderSymbol } from '../function-provider/symbols.js';

/**
 * 本地函数工具提供者
 * 将 LocalFunctionProvider 中的本地函数转换为 FunctionMetadata 格式
 */
@injectable()
export class LocalFunctionToolProvider implements ToolProvider {
  constructor(@inject(LocalFunctionProviderSymbol) private functionProvider: LocalFunctionProvider) {}

  /**
   * 查询所有可用工具（本地函数）
   */
  async searchTools(): Promise<FunctionMetadata[]> {
    return this.functionProvider.list();
  }

  /**
   * 验证工具是否存在
   */
  async hasTool(id: string): Promise<boolean> {
    return this.functionProvider.has(id);
  }
}
