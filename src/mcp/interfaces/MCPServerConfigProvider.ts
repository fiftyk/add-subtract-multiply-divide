/**
 * MCP Server 配置提供者接口
 *
 * 职责：
 * - 加载和管理 MCP servers 配置
 * - 从 fn-orchestrator.mcp.json 文件读取配置
 */

import type { MCPServerConfig } from '../../config/types.js';

export interface MCPServerConfigProvider {
  /**
   * 获取所有配置的 MCP servers
   */
  getServers(): MCPServerConfig[];

  /**
   * 检查 MCP 是否启用
   */
  isEnabled(): boolean;

  /**
   * 重新加载配置（用于测试或热重载）
   */
  reload(): void;
}

export const MCPServerConfigProvider = Symbol('MCPServerConfigProvider');
