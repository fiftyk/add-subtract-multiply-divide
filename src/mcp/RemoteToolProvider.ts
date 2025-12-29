/**
 * Remote Tool Provider
 * 将 MCP Server 的工具转换为 FunctionMetadata 格式
 */

import 'reflect-metadata';
import { injectable, inject, optional, unmanaged } from 'inversify';
import { ToolProvider } from '../tools/interfaces/ToolProvider.js';
import type { FunctionMetadata } from '../function-provider/types.js';
import type { ParameterDef } from '../registry/types.js';
import type { RemoteFunctionInfo } from './index.js';
import { RemoteFunctionRegistry } from './interfaces/RemoteFunctionRegistry.js';
import { LoggerFactory, type ILogger } from '../logger/index.js';

/**
 * 远程工具提供者
 * 将 RemoteFunctionRegistry 中的远程函数转换为 FunctionMetadata 格式
 */
@injectable()
export class RemoteToolProvider implements ToolProvider {
  private logger: ILogger;

  constructor(
    @inject(RemoteFunctionRegistry) @optional() private remoteRegistry?: RemoteFunctionRegistry,
    @unmanaged() config?: { logger?: ILogger }
  ) {
    this.logger = config?.logger ?? LoggerFactory.create();
  }

  /**
   * 查询所有可用工具（远程函数）
   */
  async searchTools(): Promise<FunctionMetadata[]> {
    if (!this.remoteRegistry) {
      this.logger.debug('No remote registry available');
      return [];
    }

    try {
      const functions = await this.remoteRegistry.list();
      return functions.map((fn) => this.toFunctionMetadata(fn));
    } catch (error) {
      this.logger.error('Failed to search remote tools', error as Error);
      return [];
    }
  }

  /**
   * 验证工具是否存在
   */
  async hasTool(id: string): Promise<boolean> {
    if (!this.remoteRegistry) {
      return false;
    }

    try {
      return await this.remoteRegistry.has(id);
    } catch (error) {
      this.logger.error('Failed to check remote tool existence', error as Error);
      return false;
    }
  }

  /**
   * 将 RemoteFunctionInfo 转换为 FunctionMetadata
   */
  private toFunctionMetadata(fn: RemoteFunctionInfo): FunctionMetadata {
    // 转换 inputSchema 为 parameters 格式
    const parameters = this.convertInputSchema(fn.inputSchema);

    // 从 outputSchema 构建返回值描述
    const returnsDescription = this.formatOutputSchema(fn.outputSchema);

    return {
      id: fn.name,
      type: 'remote',
      name: fn.name,
      description: fn.description,
      scenario: fn.description, // 使用 description 作为 scenario
      parameters,
      returns: {
        type: 'object' as const,
        description: returnsDescription,
      },
      source: `mcp://${this.remoteRegistry?.getServerName() || 'unknown'}`,
    };
  }

  /**
   * 将 JSON Schema 转换为 parameters 格式
   */
  private convertInputSchema(
    inputSchema: RemoteFunctionInfo['inputSchema']
  ): ParameterDef[] {
    const parameters: ParameterDef[] = [];

    if (!inputSchema.properties) {
      return parameters;
    }

    for (const [name, prop] of Object.entries(inputSchema.properties)) {
      const propSchema = prop as { type?: string; description?: string; enum?: unknown[] };
      parameters.push({
        name,
        type: this.mapJsonSchemaType(propSchema.type || 'string'),
        description: propSchema.description || '',
        required: inputSchema.required?.includes(name) ?? false,
      });
    }

    return parameters;
  }

  /**
   * 格式化输出模式为描述字符串
   */
  private formatOutputSchema(outputSchema?: RemoteFunctionInfo['outputSchema']): string {
    if (!outputSchema || !outputSchema.properties) {
      return 'object - Function result';
    }

    const props = Object.entries(outputSchema.properties)
      .map(([name, prop]) => {
        const type = prop.type || 'unknown';
        const desc = prop.description ? ` - ${prop.description}` : '';
        return `  - ${name} (${type})${desc}`;
      })
      .join('\n');

    return `object - Function result with properties:\n${props}`;
  }

  /**
   * 映射 JSON Schema 类型到内部类型
   */
  private mapJsonSchemaType(jsonType: string): ParameterDef['type'] {
    const typeMap: Record<string, ParameterDef['type']> = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      array: 'array',
      object: 'object',
      null: 'string',
    };

    return typeMap[jsonType] || 'string';
  }
}
