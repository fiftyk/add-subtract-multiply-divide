/**
 * MCP Client 单元测试
 * 测试使用官方 @modelcontextprotocol/sdk 的 MCPClient
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPClient, type MCPClientConfig } from '../MCPClient.js';
import { NoOpRemoteFunctionRegistry } from '../NoOpRemoteFunctionRegistry.js';

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

  describe('NoOpRemoteFunctionRegistry', () => {
    it('should return correct type', () => {
      const registry = new NoOpRemoteFunctionRegistry();

      expect(registry.getType()).toBe('remote');
      expect(registry.getServerName()).toBe('none');
    });

    it('should return empty list for list()', async () => {
      const registry = new NoOpRemoteFunctionRegistry();

      const tools = await registry.list();

      expect(tools).toEqual([]);
    });

    it('should return false for has()', async () => {
      const registry = new NoOpRemoteFunctionRegistry();

      const result = await registry.has('any-tool');

      expect(result).toBe(false);
    });

    it('should return undefined for get()', async () => {
      const registry = new NoOpRemoteFunctionRegistry();

      const result = await registry.get('any-tool');

      expect(result).toBeUndefined();
    });

    it('should return failure result for execute()', async () => {
      const registry = new NoOpRemoteFunctionRegistry();

      const result = await registry.execute('any-tool', { param: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('MCP is not configured');
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
