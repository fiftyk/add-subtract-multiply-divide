/**
 * CompositeFunctionProvider 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { FunctionMetadata, FunctionExecutionResult } from '../types.js';
import type { FunctionProvider } from '../interfaces/FunctionProvider.js';

// Mock FunctionProvider
const createMockProvider = (
  name: string,
  providerType: 'local' | 'remote',
  functions: FunctionMetadata[]
): FunctionProvider => ({
  getType: () => providerType,
  getSource: () => name,
  list: vi.fn().mockResolvedValue(functions),
  has: vi.fn().mockImplementation(async (n: string) =>
    functions.some(f => f.name === n)
  ),
  get: vi.fn().mockImplementation(async (n: string) =>
    functions.find(f => f.name === n)
  ),
  execute: vi.fn().mockImplementation(async (n: string, params: Record<string, unknown>) => ({
    success: true,
    result: `${name}-${n}-result`,
    metadata: { provider: name },
  })),
});

describe('CompositeFunctionProvider', () => {
  describe('getType', () => {
    it('should return "composite" as provider type', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', []);
      const provider = new CompositeFunctionProvider([localProvider]);

      expect(provider.getType()).toBe('composite');
    });
  });

  describe('getSource', () => {
    it('should return "composite" as source', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', []);
      const provider = new CompositeFunctionProvider([localProvider]);

      expect(provider.getSource()).toBe('composite');
    });
  });

  describe('list', () => {
    it('should return empty array when no providers', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider = new CompositeFunctionProvider([]);

      const functions = await provider.list();
      expect(functions).toEqual([]);
    });

    it('should merge functions from all providers', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'localFn1', name: 'localFn1', description: 'Local 1', scenario: 'Scenario 1', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
        { id: 'localFn2', name: 'localFn2', description: 'Local 2', scenario: 'Scenario 2', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'remoteFn1', name: 'remoteFn1', description: 'Remote 1', scenario: 'Scenario 3', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      const functions = await provider.list();
      expect(functions).toHaveLength(3);
    });

    it('should deduplicate functions with same name', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'duplicate', name: 'duplicate', description: 'Local', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'duplicate', name: 'duplicate', description: 'Remote', scenario: 'Remote', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      const functions = await provider.list();
      // 默认策略：第一个优先，所以应该只有 local 的版本
      expect(functions).toHaveLength(1);
      expect(functions[0].source).toBe('local');
    });
  });

  describe('has', () => {
    it('should return false when no providers', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider = new CompositeFunctionProvider([]);

      const result = await provider.has('test');
      expect(result).toBe(false);
    });

    it('should check all providers in order', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'localOnly', name: 'localOnly', description: 'Local', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'remoteOnly', name: 'remoteOnly', description: 'Remote', scenario: 'Remote', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      expect(await provider.has('localOnly')).toBe(true);
      expect(await provider.has('remoteOnly')).toBe(true);
      expect(await provider.has('nonexistent')).toBe(false);
    });

    it('should return true when any provider has the function', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider1 = createMockProvider('p1', 'local', []);
      const provider2 = createMockProvider('p2', 'remote', [
        { id: 'found', name: 'found', description: 'Found', scenario: 'Found', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'p2' },
      ]);
      const provider = new CompositeFunctionProvider([provider1, provider2]);

      const result = await provider.has('found');
      expect(result).toBe(true);
    });
  });

  describe('get', () => {
    it('should return undefined when no providers', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider = new CompositeFunctionProvider([]);

      const result = await provider.get('test');
      expect(result).toBeUndefined();
    });

    it('should return first match from providers', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'findMe', name: 'findMe', description: 'Local', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'findMe', name: 'findMe', description: 'Remote', scenario: 'Remote', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      const result = await provider.get('findMe');
      expect(result).toBeDefined();
      expect(result!.source).toBe('local');
    });
  });

  describe('execute', () => {
    it('should return success=false when function not found', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider = new CompositeFunctionProvider([]);

      const result = await provider.execute('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Function not found');
    });

    it('should execute function from first provider that has it', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'execMe', name: 'execMe', description: 'Local', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'execMe', name: 'execMe', description: 'Remote', scenario: 'Remote', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      const result = await provider.execute('execMe', { x: 1 });
      expect(result.success).toBe(true);
      expect(result.result).toBe('local-execMe-result');
    });

    it('should route to correct provider', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const localProvider = createMockProvider('local', 'local', [
        { id: 'localFn', name: 'localFn', description: 'Local', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
      ]);
      const remoteProvider = createMockProvider('mcp://server', 'remote', [
        { id: 'remoteFn', name: 'remoteFn', description: 'Remote', scenario: 'Remote', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
      ]);
      const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

      const localResult = await provider.execute('localFn', {});
      const remoteResult = await provider.execute('remoteFn', {});

      expect(localResult.result).toBe('local-localFn-result');
      expect(remoteResult.result).toBe('mcp://server-remoteFn-result');
    });
  });

  describe('priority', () => {
    it('should prioritize first provider when merging lists', async () => {
      const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
      const provider1 = createMockProvider('p1', 'local', [
        { id: 'shared', name: 'shared', description: 'P1', scenario: 'P1', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'p1' },
      ]);
      const provider2 = createMockProvider('p2', 'remote', [
        { id: 'shared', name: 'shared', description: 'P2', scenario: 'P2', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'p2' },
      ]);
      const provider = new CompositeFunctionProvider([provider1, provider2]);

      const functions = await provider.list();
      const shared = functions.find(f => f.name === 'shared');

      expect(shared).toBeDefined();
      expect(shared!.source).toBe('p1');
    });
  });

  describe('source-prefixed function names', () => {
    describe('local: prefix', () => {
      it('should execute local function with local: prefix', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', [
          { id: 'search', name: 'search', description: 'Local search', scenario: 'Local search', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
        ]);
        const remoteProvider = createMockProvider('mcp://server', 'remote', [
          { id: 'search', name: 'search', description: 'Remote search', scenario: 'Remote search', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
        ]);
        const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

        const result = await provider.execute('local:search', {});
        expect(result.success).toBe(true);
        expect(result.result).toBe('local-search-result');
      });

      it('should check local function existence with local: prefix', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', [
          { id: 'localOnly', name: 'localOnly', description: 'Local only', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
        ]);
        const remoteProvider = createMockProvider('mcp://server', 'remote', []);
        const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

        expect(await provider.has('local:localOnly')).toBe(true);
        expect(await provider.has('local:nonexistent')).toBe(false);
      });

      it('should get local function metadata with local: prefix', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', [
          { id: 'getData', name: 'getData', description: 'Local getData', scenario: 'Local', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
        ]);
        const provider = new CompositeFunctionProvider([localProvider]);

        const result = await provider.get('local:getData');
        expect(result).toBeDefined();
        expect(result!.source).toBe('local');
      });
    });

    describe('mcp: prefix', () => {
      it('should execute MCP function with mcp:serverName: prefix', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', []);
        const remoteProvider = createMockProvider('mcp://server', 'remote', [
          { id: 'search_patents', name: 'search_patents', description: 'Search patents', scenario: 'Patent search', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
        ]);
        const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

        const result = await provider.execute('mcp:server:search_patents', {});
        expect(result.success).toBe(true);
        expect(result.result).toBe('mcp://server-search_patents-result');
      });

      it('should execute MCP function with mcp: prefix (no server)', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', []);
        const remoteProvider = createMockProvider('mcp://server', 'remote', [
          { id: 'get_details', name: 'get_details', description: 'Get details', scenario: 'Details', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
        ]);
        const provider = new CompositeFunctionProvider([localProvider, remoteProvider]);

        const result = await provider.execute('mcp:get_details', {});
        expect(result.success).toBe(true);
        expect(result.result).toBe('mcp://server-get_details-result');
      });

      it('should return error when MCP provider not found', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', []);
        const provider = new CompositeFunctionProvider([localProvider]);

        const result = await provider.execute('mcp:nonexistent:func', {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('Provider not found');
      });

      it('should return error when MCP function not found in provider', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const remoteProvider = createMockProvider('mcp://server', 'remote', [
          { id: 'existing', name: 'existing', description: 'Existing', scenario: 'Existing', parameters: [], returns: { type: 'void', description: '' }, type: 'remote', source: 'mcp://server' },
        ]);
        const provider = new CompositeFunctionProvider([remoteProvider]);

        const result = await provider.execute('mcp:server:nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('Function "nonexistent" not found');
      });
    });

    describe('function name with colons', () => {
      it('should handle function names containing colons', async () => {
        const { CompositeFunctionProvider } = await import('../CompositeFunctionProvider.js');
        const localProvider = createMockProvider('local', 'local', [
          { id: 'ns:func', name: 'ns:func', description: 'Namespaced function', scenario: 'Namespace', parameters: [], returns: { type: 'void', description: '' }, type: 'local', source: 'local' },
        ]);
        const provider = new CompositeFunctionProvider([localProvider]);

        const result = await provider.execute('ns:func', {});
        expect(result.success).toBe(true);
        expect(result.result).toBe('local-ns:func-result');
      });
    });
  });
});
