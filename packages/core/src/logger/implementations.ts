import type { ILogger, LogLevel, LogEntry } from './types.js';
import { LogLevel as Level } from './types.js';

/**
 * Console logger implementation
 */
export class ConsoleLogger implements ILogger {
  constructor(
    private minLevel: LogLevel = Level.INFO,
    private prefix: string = ''
  ) {}

  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isLevelEnabled(Level.DEBUG)) {
      this.log(Level.DEBUG, message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.isLevelEnabled(Level.INFO)) {
      this.log(Level.INFO, message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.isLevelEnabled(Level.WARN)) {
      this.log(Level.WARN, message, context);
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.isLevelEnabled(Level.ERROR)) {
      this.log(Level.ERROR, message, context, error);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      level,
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formattedMessage = this.formatEntry(entry);

    switch (level) {
      case Level.DEBUG:
        console.debug(formattedMessage);
        break;
      case Level.INFO:
        console.info(formattedMessage);
        break;
      case Level.WARN:
        console.warn(formattedMessage);
        break;
      case Level.ERROR:
        console.error(formattedMessage);
        if (error?.stack) {
          console.error(error.stack);
        }
        break;
    }
  }

  private formatEntry(entry: LogEntry): string {
    const parts = [entry.message];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    return parts.join(' ');
  }
}

/**
 * No-op logger (silent mode)
 */
export class NoOpLogger implements ILogger {
  isLevelEnabled(): boolean {
    return false;
  }

  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
