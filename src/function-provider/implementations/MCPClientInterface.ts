/**
 * MCP FunctionProvider 接口定义
 */

import type { FunctionMetadata } from '../types.js';
import type { ParameterDef } from '../../registry/types.js';
import type { RemoteFunctionResult } from '../transports/MCPClient.js';

/**
 * 远程函数信息（MCP 格式）
 */
export interface MCPFunctionInfo {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, { type: string; description?: string; enum?: unknown[] }>;
    required?: string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, { type: string; description?: string }>;
  };
}

/**
 * MCP 客户端接口
 * 抽象 MCP 通信能力，便于测试时 mock
 */
export interface MCPClientInterface {
  getType(): 'remote';
  getServerName(): string;
  has(name: string): Promise<boolean>;
  list(): Promise<MCPFunctionInfo[]>;
  get(name: string): Promise<MCPFunctionInfo | undefined>;
  execute(name: string, params: Record<string, unknown>): Promise<RemoteFunctionResult>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * MCPFunctionProvider 客户端符号（与接口同名）
 */
export const MCPClientInterface = Symbol('MCPClientInterface');
