import type { FunctionDefinition } from '../registry/types.js';
import type { ParameterDef, ReturnDef } from '../registry/types.js';

/**
 * 工具定义
 * 统一本地函数和远程函数的元数据格式
 */
export interface ToolDefinition extends Omit<FunctionDefinition, 'implementation'> {
  /** 工具唯一标识 */
  id: string;

  /** 工具类型 */
  type: 'local' | 'remote';

  /** 所属注册中心 ID（远程函数特有） */
  registryId?: string;
}

/**
 * 函数调用器
 * 封装了远程函数的调用逻辑
 */
export interface FunctionInvoker {
  /** 远程函数 ID */
  id: string;

  /** 远程函数名称 */
  name: string;

  /** 所属注册中心 ID */
  registryId: string;

  /** 调用函数 */
  invoke(params: Record<string, unknown>): Promise<unknown>;
}
