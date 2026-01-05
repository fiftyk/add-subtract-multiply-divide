/**
 * MCP Server 配置提供者实现
 *
 * 从 fn-orchestrator.mcp.json 文件加载 MCP servers 配置
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import type { MCPServerConfigProvider } from './interfaces/MCPServerConfigProvider.js';
import type { MCPServerConfig } from '../config/types.js';

interface MCPConfigFile {
  enabled: boolean;
  servers: MCPServerConfig[];
}

@injectable()
export class MCPServerConfigProviderImpl implements MCPServerConfigProvider {
  private config: MCPConfigFile | null = null;
  private readonly configPath: string;

  constructor(configPath?: string) {
    // 默认从项目根目录加载配置文件
    this.configPath = configPath || path.resolve(process.cwd(), 'fn-orchestrator.mcp.json');
    this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): void {
    // 跳过测试环境或文件不存在的情况
    if (process.env.NODE_ENV === 'test' || !fs.existsSync(this.configPath)) {
      this.config = {
        enabled: false,
        servers: [],
      };
      return;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const json = JSON.parse(content);

      // 验证基本结构
      if (typeof json !== 'object' || json === null) {
        console.warn('Warning: fn-orchestrator.mcp.json must be an object, using default config');
        this.config = { enabled: false, servers: [] };
        return;
      }

      this.config = {
        enabled: json.enabled !== false, // 默认启用
        servers: Array.isArray(json.servers) ? json.servers : [],
      };
    } catch (error) {
      console.warn(
        `Warning: Failed to load fn-orchestrator.mcp.json: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.config = {
        enabled: false,
        servers: [],
      };
    }
  }

  /**
   * 获取所有配置的 MCP servers
   */
  getServers(): MCPServerConfig[] {
    return this.config?.servers || [];
  }

  /**
   * 检查 MCP 是否启用
   */
  isEnabled(): boolean {
    return this.config?.enabled || false;
  }

  /**
   * 重新加载配置（用于测试或热重载）
   */
  reload(): void {
    this.loadConfig();
  }
}
