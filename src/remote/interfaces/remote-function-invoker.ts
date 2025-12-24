import type { FunctionInvoker } from '../types.js';

/**
 * 远程函数调用器接口
 * 提供远程函数的调用能力
 */
export interface RemoteFunctionInvoker {
  /**
   * 根据 ID 获取调用器
   */
  getInvoker(id: string): FunctionInvoker | undefined;
}
