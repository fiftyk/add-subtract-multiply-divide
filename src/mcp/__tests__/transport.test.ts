/**
 * MCP Client 单元测试
 * 测试使用官方 @modelcontextprotocol/sdk 的 MCPClient
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPClient, type MCPClientConfig } from '../MCPClient.js';

describe('MCPClient', () => {
  describe('constructor', () => {
    it('should create client with config', () => {
      const config: MCPClientConfig = {
        name: 'test-server',
        transportType: 'stdio',
        transportConfig: {
          command: 'test-command',
        },
      };

      const client = new MCPClient(config);

      expect(client).toBeDefined();
      expect(client.getType()).toBe('remote');
      expect(client.getServerName()).toBe('test-server');
    });

    it('should create client without logger (uses default)', () => {
      const config: MCPClientConfig = {
        name: 'test-server',
        transportType: 'stdio',
        transportConfig: {
          command: 'test-command',
        },
      };

      const client = new MCPClient(config);

      expect(client).toBeDefined();
    });
  });

  describe('connection state', () => {
    it('should start disconnected', () => {
      const config: MCPClientConfig = {
        name: 'test-server',
        transportType: 'stdio',
        transportConfig: {
          command: 'test-command',
        },
      };

      const client = new MCPClient(config);

      expect(client.isConnected()).toBe(false);
    });
  });
});

describe('MCPClientConfig type tests', () => {
  it('should accept stdio transport config', () => {
    const config: MCPClientConfig = {
      name: 'filesystem',
      transportType: 'stdio',
      transportConfig: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { NODE_ENV: 'test' },
        cwd: '/home/user',
      },
    };

    expect(config.transportType).toBe('stdio');
    expect((config.transportConfig as any).command).toBe('npx');
  });

  it('should accept http transport config', () => {
    const config: MCPClientConfig = {
      name: 'remote-server',
      transportType: 'http',
      transportConfig: {
        url: 'http://localhost:3000/mcp',
        accessToken: 'test-token',
      },
    };

    expect(config.transportType).toBe('http');
    expect((config.transportConfig as any).url).toBe('http://localhost:3000/mcp');
  });
});
