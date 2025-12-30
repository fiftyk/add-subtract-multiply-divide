import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { PlannerLLMClient } from '../../interfaces/PlannerLLMClient.js';

// Create mock spawn function before importing
const mockSpawn = vi.fn();
vi.doMock('node:child_process', () => ({
  spawn: mockSpawn,
  ChildProcess: class {},
}));

// Create mock logger functions
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

// Mock logger
vi.doMock('../../../logger/index.js', () => ({
  LoggerFactory: {
    createFromEnv: vi.fn().mockReturnValue({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    }),
    create: vi.fn().mockReturnValue({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    }),
  },
}));

// Import after mocks
const { CLIPlannerLLMClient } = await import('../CLIPlannerLLMClient.js');

describe('CLIPlannerLLMClient', () => {
  let client: PlannerLLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDebug.mockClear();
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with command and args', () => {
      client = new CLIPlannerLLMClient('claude', '-p --print-result', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect(client).toBeInstanceOf(CLIPlannerLLMClient);
    });
  });

  describe('parseArgs', () => {
    it('should parse simple args', () => {
      client = new CLIPlannerLLMClient('cmd', 'arg1 arg2 arg3', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    it('should parse args with double quotes', () => {
      client = new CLIPlannerLLMClient('cmd', '--option "value with spaces"', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual(['--option', 'value with spaces']);
    });

    it('should parse args with single quotes', () => {
      client = new CLIPlannerLLMClient('cmd', "--option 'value with spaces'", {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual(['--option', 'value with spaces']);
    });

    it('should handle empty args string', () => {
      client = new CLIPlannerLLMClient('cmd', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual([]);
    });

    it('should handle multiple quoted arguments', () => {
      client = new CLIPlannerLLMClient('cmd', '--first "value1" --second "value2"', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual(['--first', 'value1', '--second', 'value2']);
    });

    it('should preserve quoted arguments with special characters', () => {
      client = new CLIPlannerLLMClient('cmd', '--json \'{"key": "value"}\'', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((client as any).args).toEqual(['--json', '{"key": "value"}']);
    });
  });

  describe('generatePlan', () => {
    it('should return plan JSON from successful CLI execution', async () => {
      client = new CLIPlannerLLMClient('echo', 'test response', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('{"plan": "data"}')), 0);
            }
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const result = await client.generatePlan('Generate a plan');

      expect(result).toBe('{"plan": "data"}');
    });

    it('should throw error when CLI exits with non-zero code', async () => {
      client = new CLIPlannerLLMClient('failing-command', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('Error: command failed'));
            }
          }),
        },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      await expect(client.generatePlan('test prompt')).rejects.toThrow(
        'failing-command exited with code 1: Error: command failed'
      );
    });

    it('should throw error when CLI process errors', async () => {
      client = new CLIPlannerLLMClient('nonexistent', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('ENOENT: command not found')), 0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      await expect(client.generatePlan('test prompt')).rejects.toThrow(
        'ENOENT: command not found'
      );
    });

    it('should send prompt to CLI stdin', async () => {
      client = new CLIPlannerLLMClient('cat', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('echo response')), 0);
            }
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      const prompt = 'test prompt content';
      await client.generatePlan(prompt);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(prompt);
      expect(mockChildProcess.stdin.end).toHaveBeenCalled();
    });

    it('should include stderr in error message', async () => {
      client = new CLIPlannerLLMClient('failing-tool', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('Specific error message from tool'));
            }
          }),
        },
        stdin: { write: vi.fn(), end: vi.fn() },
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(42), 0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      await expect(client.generatePlan('test')).rejects.toThrow(
        'failing-tool exited with code 42: Specific error message from tool'
      );
    });
  });
});
