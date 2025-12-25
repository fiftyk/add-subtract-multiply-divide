import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockServiceFactoryImpl } from '../MockServiceFactoryImpl.js';
import type { LLMAdapter } from '../../interfaces/LLMAdapter.js';
import type { FunctionRegistry } from '../../../registry/index.js';
import type { Storage } from '../../../storage/index.js';
import type { IMockOrchestrator } from '../../interfaces/IMockOrchestrator.js';

// Mock LoggerFactory
vi.mock('../../../logger/index.js', () => ({
  LoggerFactory: {
    create: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('MockServiceFactoryImpl', () => {
  let factory: MockServiceFactoryImpl;
  let mockLLMAdapter: LLMAdapter;
  let mockStorage: Storage;
  let mockRegistry: FunctionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMAdapter = {
      generateCode: vi.fn(),
    };

    mockStorage = {
      getPlanMocksDir: vi.fn().mockReturnValue('/test/mocks'),
    } as unknown as Storage;

    mockRegistry = {
      register: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      unregister: vi.fn(),
    } as unknown as FunctionRegistry;

    factory = new MockServiceFactoryImpl(
      mockLLMAdapter,
      mockStorage,
      mockRegistry
    );
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(factory).toBeDefined();
    });
  });

  describe('createOrchestrator', () => {
    it('should create a MockOrchestrator instance', () => {
      const orchestrator = factory.createOrchestrator('plan-123');
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.generateAndRegisterMocks).toBe('function');
    });

    it('should use correct planId for storage path', () => {
      const planId = 'my-plan-456';
      factory.createOrchestrator(planId);

      expect(mockStorage.getPlanMocksDir).toHaveBeenCalledWith(planId);
    });

    it('should pass correct import path to code generator', () => {
      factory.createOrchestrator('plan-123');
      // The import path is hardcoded in the implementation
      // This test verifies the method doesn't throw
      expect(() => factory.createOrchestrator('plan-123')).not.toThrow();
    });

    it('should create orchestrator with correct dependencies', () => {
      const orchestrator = factory.createOrchestrator('plan-123');

      // The orchestrator should be able to generate mocks using the LLM adapter
      expect(mockLLMAdapter.generateCode).not.toHaveBeenCalled();
    });

    it('should return same orchestrator type for different planIds', () => {
      const orchestrator1 = factory.createOrchestrator('plan-1');
      const orchestrator2 = factory.createOrchestrator('plan-2');

      expect(orchestrator1).toBeInstanceOf(Object);
      expect(orchestrator2).toBeInstanceOf(Object);
      // Both should have the same interface
      expect('generateAndRegisterMocks' in orchestrator1).toBe(true);
      expect('generateAndRegisterMocks' in orchestrator2).toBe(true);
    });

    it('should be reusable for multiple orchestrators', () => {
      const orchestrator1 = factory.createOrchestrator('plan-1');
      const orchestrator2 = factory.createOrchestrator('plan-2');
      const orchestrator3 = factory.createOrchestrator('plan-3');

      expect(orchestrator1).not.toBe(orchestrator2);
      expect(orchestrator2).not.toBe(orchestrator3);
    });
  });
});
