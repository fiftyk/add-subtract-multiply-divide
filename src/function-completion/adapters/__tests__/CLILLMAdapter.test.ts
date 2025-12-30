import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LLMAdapter } from '../../interfaces/LLMAdapter.js';

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
const { CLILLMAdapter } = await import('../CLILLMAdapter.js');

describe('CLILLMAdapter', () => {
  let adapter: LLMAdapter;

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
    it('should create adapter with command and args', () => {
      adapter = new CLILLMAdapter('claude', '-p --print-result', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect(adapter).toBeInstanceOf(CLILLMAdapter);
    });
  });

  describe('parseArgs', () => {
    it('should parse simple args', () => {
      adapter = new CLILLMAdapter('cmd', 'arg1 arg2 arg3', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    it('should parse args with double quotes', () => {
      adapter = new CLILLMAdapter('cmd', '--option "value with spaces"', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['--option', 'value with spaces']);
    });

    it('should parse args with single quotes', () => {
      adapter = new CLILLMAdapter('cmd', "--option 'value with spaces'", {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['--option', 'value with spaces']);
    });

    it('should handle empty args string', () => {
      adapter = new CLILLMAdapter('cmd', '', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual([]);
    });

    it('should handle multiple quoted arguments', () => {
      adapter = new CLILLMAdapter('cmd', '--first "value1" --second "value2"', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['--first', 'value1', '--second', 'value2']);
    });

    it('should preserve quoted arguments with special characters', () => {
      adapter = new CLILLMAdapter('cmd', '--json \'{"key": "value"}\'', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['--json', '{"key": "value"}']);
    });

    it('should handle trailing spaces', () => {
      adapter = new CLILLMAdapter('cmd', 'arg1  ', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['arg1']);
    });

    it('should handle consecutive spaces between args', () => {
      adapter = new CLILLMAdapter('cmd', 'arg1   arg2', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);
      expect((adapter as any).args).toEqual(['arg1', 'arg2']);
    });
  });

  describe('generateCode', () => {
    it('should return code from successful CLI execution', async () => {
      adapter = new CLILLMAdapter('echo', 'test response', {
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
      } as any);

      const mockChildProcess = {
        stdout: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('export const test = 42;')), 0);
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

      const result = await adapter.generateCode('test prompt');

      expect(result).toBe('export const test = 42;');
    });

    it('should throw error when CLI exits with non-zero code', async () => {
      adapter = new CLILLMAdapter('failing-command', '', {
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

      await expect(adapter.generateCode('test prompt')).rejects.toThrow(
        'failing-command exited with code 1: Error: command failed'
      );
    });

    it('should throw error when CLI process errors', async () => {
      adapter = new CLILLMAdapter('nonexistent', '', {
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

      await expect(adapter.generateCode('test prompt')).rejects.toThrow(
        'ENOENT: command not found'
      );
    });

    it('should send prompt to CLI stdin', async () => {
      adapter = new CLILLMAdapter('cat', '', {
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
      await adapter.generateCode(prompt);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(prompt);
      expect(mockChildProcess.stdin.end).toHaveBeenCalled();
    });

    it('should include stderr in error message', async () => {
      adapter = new CLILLMAdapter('failing-tool', '', {
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
              callback(Buffer.from('Specific error message'));
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

      await expect(adapter.generateCode('test')).rejects.toThrow(
        'failing-tool exited with code 42: Specific error message'
      );
    });
  });
});
