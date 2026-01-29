"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLogger = exports.MCPLogger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class MCPLogger {
    constructor(prefix = 'TwinMCP', level = LogLevel.INFO) {
        this.prefix = prefix;
        this.level = level;
    }
    shouldLog(level) {
        return level >= this.level;
    }
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] [${this.prefix}] ${message}${metaStr}`;
    }
    debug(message, meta) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.error(this.formatMessage('DEBUG', message, meta));
        }
    }
    info(message, meta) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(this.formatMessage('INFO', message, meta));
        }
    }
    warn(message, meta) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, meta));
        }
    }
    error(message, error, meta) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMeta = error ? { error: error.message || error, stack: error.stack, ...meta } : meta;
            console.error(this.formatMessage('ERROR', message, errorMeta));
        }
    }
    static create(context, level = LogLevel.INFO) {
        return new MCPLogger(context, level);
    }
}
exports.MCPLogger = MCPLogger;
exports.defaultLogger = new MCPLogger();
//# sourceMappingURL=logger.js.map