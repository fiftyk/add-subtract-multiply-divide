/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log entry with metadata
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger interface (DIP)
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean;
}
