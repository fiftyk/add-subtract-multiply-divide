import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerFactory, LogLevel, ConsoleLogger, NoOpLogger } from '../index.js';

describe('Logger System', () => {
  const originalEnv = process.env;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('ConsoleLogger', () => {
    it('should log info messages by default', () => {
      const logger = new ConsoleLogger();
      logger.info('test message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('test message');
    });

    it('should include context in log output', () => {
      const logger = new ConsoleLogger();
      logger.info('test message', { userId: 123 });

      expect(consoleInfoSpy).toHaveBeenCalledWith('test message {"userId":123}');
    });

    it('should respect minimum log level', () => {
      const logger = new ConsoleLogger(LogLevel.WARN);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('warn');
    });

    it('should log errors with stack traces', () => {
      const logger = new ConsoleLogger();
      const error = new Error('test error');

      logger.error('error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('error occurred');
      expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack);
    });

    it('should add prefix to messages', () => {
      const logger = new ConsoleLogger(LogLevel.INFO, 'MyModule');

      logger.info('test');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[MyModule] test');
    });

    it('should check if log level is enabled', () => {
      const logger = new ConsoleLogger(LogLevel.WARN);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
    });
  });

  describe('NoOpLogger', () => {
    it('should not log anything', () => {
      const logger = new NoOpLogger();

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error', new Error());

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should always return false for isLevelEnabled', () => {
      const logger = new NoOpLogger();

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(false);
    });
  });

  describe('LoggerFactory', () => {
    it('should create ConsoleLogger by default', () => {
      const logger = LoggerFactory.create();

      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should create NoOpLogger for SILENT level', () => {
      const logger = LoggerFactory.create(LogLevel.SILENT);

      expect(logger).toBeInstanceOf(NoOpLogger);
    });

    it('should create logger with prefix', () => {
      const logger = LoggerFactory.create(LogLevel.INFO, 'TestPrefix');

      logger.info('test');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[TestPrefix] test');
    });

    it('should create logger from LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const logger = LoggerFactory.createFromEnv();

      logger.debug('debug message');

      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should default to INFO if LOG_LEVEL is invalid', () => {
      process.env.LOG_LEVEL = 'INVALID';
      const logger = LoggerFactory.createFromEnv();

      logger.debug('debug');
      logger.info('info');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should create silent logger from env', () => {
      process.env.LOG_LEVEL = 'SILENT';
      const logger = LoggerFactory.createFromEnv();

      expect(logger).toBeInstanceOf(NoOpLogger);
    });
  });
});
