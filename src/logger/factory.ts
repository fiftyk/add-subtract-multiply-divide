import type { ILogger } from './types.js';
import { LogLevel } from './types.js';
import { ConsoleLogger, NoOpLogger } from './implementations.js';

/**
 * Logger factory
 */
export class LoggerFactory {
  /**
   * Create a logger based on configuration
   */
  static create(
    level: LogLevel = LogLevel.INFO,
    prefix?: string
  ): ILogger {
    if (level === LogLevel.SILENT) {
      return new NoOpLogger();
    }

    return new ConsoleLogger(level, prefix);
  }

  /**
   * Create logger from environment variable
   */
  static createFromEnv(prefix?: string): ILogger {
    const levelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    const level = this.parseLogLevel(levelStr);
    return this.create(level, prefix);
  }

  private static parseLogLevel(level: string): LogLevel {
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'SILENT':
        return LogLevel.SILENT;
      default:
        return LogLevel.INFO;
    }
  }
}
