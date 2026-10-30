/**
 * SIP Logger
 *
 * Lightweight logger abstraction for the SIP module.
 * Provides consistent logging with configurable levels.
 *
 * @module lib/sip/logger
 */

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Log level priorities (lower = more verbose)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Prefix for all log messages */
  prefix: string;
  /** Enable timestamps in logs */
  timestamps: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  prefix: '[SipManager]',
  timestamps: false,
};

/**
 * SIP Logger class
 */
class SipLogger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format log message
   */
  private format(message: string): string {
    const parts: string[] = [];

    if (this.config.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(this.config.prefix);
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Debug level log
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.format(message), ...args);
    }
  }

  /**
   * Info level log
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.format(message), ...args);
    }
  }

  /**
   * Warning level log
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format(message), ...args);
    }
  }

  /**
   * Error level log
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format(message), ...args);
    }
  }
}

/**
 * Shared SIP logger instance
 */
export const sipLogger = new SipLogger();

/**
 * Create a child logger with a custom prefix
 */
export function createSipLogger(prefix: string): SipLogger {
  return new SipLogger({ prefix: `[${prefix}]` });
}
