/**
 * MCP Server 配置提供者实现
 *
 * 从 fn-orchestrator.mcp.json 文件加载 MCP servers 配置
 */

import 'reflect-metadata';
import { injectable, unmanaged } from 'inversify';
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

  constructor(@unmanaged() configPath?: string) {
    // 如果提供了明确的路径，直接使用
    if (configPath) {
      this.configPath = configPath;
    } else {
      // 否则，从当前目录开始向上查找 fn-orchestrator.mcp.json
      this.configPath = this.findConfigFile();
    }
    this.loadConfig();
  }

  /**
   * 从当前目录向上查找配置文件
   */
  private findConfigFile(): string {
    const configFileName = 'fn-orchestrator.mcp.json';
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    // 向上查找，直到找到配置文件或到达根目录
    while (currentDir !== root) {
      const configPath = path.join(currentDir, configFileName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
      // 移动到父目录
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // 已到达根目录
        break;
      }
      currentDir = parentDir;
    }

    // 如果没找到，返回当前目录的默认路径
    return path.join(process.cwd(), configFileName);
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
