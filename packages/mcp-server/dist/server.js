"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwinMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const logger_1 = require("./utils/logger");
const twinmcp_client_1 = require("./client/twinmcp-client");
const resolve_library_handler_1 = require("./handlers/resolve-library.handler");
const query_docs_handler_1 = require("./handlers/query-docs.handler");
class TwinMCPServer {
    constructor(options = {}) {
        this.handlers = new Map();
        this.logger = options.logger || logger_1.MCPLogger.create('TwinMCPServer');
        this.client = new twinmcp_client_1.TwinMCPClient({
            ...options.config,
            logger: this.logger,
        });
        this.server = new index_js_1.Server({
            name: 'twinmcp-server',
            version: '1.0.0',
            description: 'TwinMCP Server - Documentation and code snippets for any library',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
        this.setupErrorHandling();
    }
    setupHandlers() {
        const resolveHandler = new resolve_library_handler_1.ResolveLibraryHandler(this.client);
        const queryHandler = new query_docs_handler_1.QueryDocsHandler(this.client);
        this.handlers.set(resolveHandler.name, resolveHandler);
        this.handlers.set(queryHandler.name, queryHandler);
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const tools = Array.from(this.handlers.values()).map(handler => ({
                name: handler.name,
                description: handler.description,
                inputSchema: handler.inputSchema,
            }));
            this.logger.debug('Listed tools', { count: tools.length });
            return { tools };
        });
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const requestId = this.generateRequestId();
            this.logger.info('Tool call received', { name, requestId });
            const handler = this.handlers.get(name);
            if (!handler) {
                throw new Error(`Unknown tool: ${name}`);
            }
            try {
                const context = {
                    requestId,
                    config: {},
                    logger: this.logger,
                };
                const result = await handler.handler(args, context);
                this.logger.info('Tool call successful', { name, requestId });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                this.logger.error('Tool call failed', error, { name, requestId });
                throw error;
            }
        });
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            this.logger.error('MCP Server error', error);
        };
        process.on('SIGINT', async () => {
            this.logger.info('Received SIGINT, shutting down gracefully');
            await this.close();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            this.logger.info('Received SIGTERM, shutting down gracefully');
            await this.close();
            process.exit(0);
        });
    }
    async run() {
        this.logger.info('Starting TwinMCP Server...');
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('TwinMCP Server started successfully');
    }
    async close() {
        this.logger.info('Closing TwinMCP Server...');
        await this.server.close();
        this.logger.info('TwinMCP Server closed');
    }
    generateRequestId() {
        return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    addHandler(handler) {
        this.handlers.set(handler.name, handler);
        this.logger.info('Added custom handler', { name: handler.name });
    }
    getClient() {
        return this.client;
    }
}
exports.TwinMCPServer = TwinMCPServer;
//# sourceMappingURL=server.js.map