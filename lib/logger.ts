/**
 * Lightweight logger for lib/ and app/ code.
 * Uses console methods under the hood but:
 * - Suppresses debug/info in production unless LOG_LEVEL is set
 * - Adds a consistent prefix for grep-ability
 * - Can be silenced entirely with LOG_LEVEL=silent
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

// Cache resolved level at module load to avoid process.env lookup on every call
const _cachedLevel = LEVEL_PRIORITY[getLogLevel()];

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= _cachedLevel;
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog('debug')) console.debug(`[MCP:debug] ${message}`, ...args);
  },
  info(message: string, ...args: unknown[]) {
    if (shouldLog('info')) console.info(`[MCP] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    if (shouldLog('warn')) console.warn(`[MCP:warn] ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]) {
    if (shouldLog('error')) console.error(`[MCP:error] ${message}`, ...args);
  },
};
