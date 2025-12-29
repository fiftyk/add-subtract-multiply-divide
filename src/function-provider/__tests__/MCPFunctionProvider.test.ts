/**
 * MCPFunctionProvider 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FunctionMetadata, FunctionExecutionResult } from '../types.js';

// Mock RemoteFunctionRegistry 接口
interface MockRemoteFunctionRegistry {
  getType(): 'remote';
  getServerName(): string;
  has(name: string): Promise<boolean>;
  list(): Promise<Array<{
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
    outputSchema?: {
      type: 'object';
      properties?: Record<string, { type: string; description?: string }>;
    };
  }>>;
  get(name: string): Promise<undefined | {
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
    outputSchema?: {
      type: 'object';
      properties?: Record<string, { type: string; description?: string }>;
    };
  }>;
  execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

describe('MCPFunctionProvider', () => {
  // 创建 mock MCP client
  const createMockClient = (overrides: Partial<MockRemoteFunctionRegistry> = {}): MockRemoteFunctionRegistry => ({
    getType: () => 'remote',
    getServerName: () => 'test-server',
    has: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([
      {
        name: 'mcp_add',
        description: 'Add two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'mcp_subtract',
        description: 'Subtract two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
    ]),
    get: vi.fn().mockImplementation((name: string) => {
      if (name === 'mcp_add') {
        return Promise.resolve({
          name: 'mcp_add',
          description: 'Add two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['a', 'b'],
          },
        });
      }
      return Promise.resolve(undefined);
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: 8,
      metadata: { executionTime: 5, provider: 'mcp://test-server' },
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
    ...overrides,
  });

  describe('getType', () => {
    it('should return "remote" as provider type', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);
      expect(provider.getType()).toBe('remote');
    });
  });

  describe('getSource', () => {
    it('should return mcp://server-name as source', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient({ getServerName: () => 'my-server' });
      const provider = new MCPFunctionProvider(mockClient as any);
      expect(provider.getSource()).toBe('mcp://my-server');
    });
  });

  describe('list', () => {
    it('should return empty array when no tools available', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient({ list: vi.fn().mockResolvedValue([]) });
      const provider = new MCPFunctionProvider(mockClient as any);

      const functions = await provider.list();
      expect(functions).toEqual([]);
    });

    it('should return FunctionMetadata for all MCP tools', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const functions = await provider.list();
      expect(functions).toHaveLength(2);
      expect(functions[0]).toMatchObject({
        name: 'mcp_add',
        description: 'Add two numbers',
        type: 'remote',
        source: 'mcp://test-server',
      });
    });

    it('should convert inputSchema to parameters', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const functions = await provider.list();
      const addFn = functions.find(f => f.name === 'mcp_add');

      expect(addFn).toBeDefined();
      expect(addFn!.parameters).toEqual([
        { name: 'a', type: 'number', description: 'First number', required: true },
        { name: 'b', type: 'number', description: 'Second number', required: true },
      ]);
    });
  });

  describe('has', () => {
    it('should return false for nonexistent tool', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient({ has: vi.fn().mockResolvedValue(false) });
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.has('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true for existing tool', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.has('mcp_add');
      expect(result).toBe(true);
    });
  });

  describe('get', () => {
    it('should return undefined for nonexistent tool', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient({ get: vi.fn().mockResolvedValue(undefined) });
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return FunctionMetadata for existing tool', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.get('mcp_add');
      expect(result).toBeDefined();
      expect(result!.name).toBe('mcp_add');
      expect(result!.type).toBe('remote');
      expect(result!.source).toBe('mcp://test-server');
    });
  });

  describe('execute', () => {
    it('should return success=false when tool execution fails', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient({
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: 'Tool execution failed',
        }),
      });
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.execute('mcp_add', { a: 3, b: 5 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });

    it('should return success=true when tool execution succeeds', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.execute('mcp_add', { a: 3, b: 5 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(8);
    });

    it('should include metadata in result', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      const result = await provider.execute('mcp_add', { a: 3, b: 5 });
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.provider).toBe('mcp://test-server');
    });
  });

  describe('initialize', () => {
    it('should call connect on client', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      await provider.initialize!();

      expect(mockClient.connect).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should call disconnect on client', async () => {
      const { MCPFunctionProvider } = await import('../remote/MCPFunctionProvider.js');
      const mockClient = createMockClient();
      const provider = new MCPFunctionProvider(mockClient as any);

      await provider.dispose!();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });
});
