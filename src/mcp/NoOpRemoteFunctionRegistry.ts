/**
 * No-Op Remote Function Registry
 * 当没有配置 MCP 服务器时使用的空实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type {
  RemoteFunctionRegistry,
  RemoteFunctionInfo,
  RemoteFunctionResult,
} from './interfaces/RemoteFunctionRegistry.js';

/**
 * No-Op 实现
 * 所有操作都是空操作，返回空结果或抛出错误
 */
@injectable()
export class NoOpRemoteFunctionRegistry implements RemoteFunctionRegistry {
  getType(): 'remote' {
    return 'remote';
  }

  getServerName(): string {
    return 'none';
  }

  async has(_name: string): Promise<boolean> {
    return false;
  }

  async list(): Promise<RemoteFunctionInfo[]> {
    return [];
  }

  async get(_name: string): Promise<RemoteFunctionInfo | undefined> {
    return undefined;
  }

  async execute(_name: string, _params: Record<string, unknown>): Promise<RemoteFunctionResult> {
    return {
      success: false,
      error: 'MCP is not configured',
    };
  }

  async connect(): Promise<void> {
    // No-op
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  isConnected(): boolean {
    return false;
  }
}
