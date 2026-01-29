import { Logger } from '../types/mcp';
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class MCPLogger implements Logger {
    private level;
    private prefix;
    constructor(prefix?: string, level?: LogLevel);
    private shouldLog;
    private formatMessage;
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, error?: any, meta?: any): void;
    static create(context: string, level?: LogLevel): MCPLogger;
}
export declare const defaultLogger: MCPLogger;
//# sourceMappingURL=logger.d.ts.map