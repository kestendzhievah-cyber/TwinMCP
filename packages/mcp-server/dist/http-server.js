"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwinMCPHttpServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const logger_1 = require("./utils/logger");
const twinmcp_client_1 = require("./client/twinmcp-client");
const resolve_library_handler_1 = require("./handlers/resolve-library.handler");
const query_docs_handler_1 = require("./handlers/query-docs.handler");
class TwinMCPHttpServer {
    constructor(config, mcpConfig) {
        this.handlers = new Map();
        this.transports = new Map();
        this.config = config;
        this.logger = logger_1.MCPLogger.create('TwinMCPHttpServer');
        this.client = new twinmcp_client_1.TwinMCPClient({
            ...mcpConfig,
            logger: this.logger,
        });
        this.app = (0, express_1.default)();
        this.server = new index_js_1.Server({
            name: 'twinmcp-http-server',
            version: '1.0.0',
            description: 'TwinMCP HTTP Server with API Key Authentication',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupMiddleware();
        this.setupHandlers();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use((0, cors_1.default)({
            origin: this.config.corsOrigins ?? '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
        }));
        this.app.use((req, _res, next) => {
            req.requestId = this.generateRequestId();
            req.startTime = Date.now();
            next();
        });
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
            return { tools };
        });
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const handler = this.handlers.get(name);
            if (!handler) {
                throw new Error(`Unknown tool: ${name}`);
            }
            const context = {
                requestId: this.generateRequestId(),
                config: {},
                logger: this.logger,
            };
            const result = await handler.handler(args, context);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        });
    }
    setupRoutes() {
        // Health check (public)
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
            });
        });
        // API info (public)
        this.app.get('/api/info', (_req, res) => {
            res.json({
                name: 'TwinMCP Server',
                version: '1.0.0',
                description: 'MCP Server for documentation and code snippets',
                endpoints: {
                    health: 'GET /health',
                    info: 'GET /api/info',
                    tools: 'GET /api/mcp/tools',
                    call: 'POST /api/mcp/call',
                    sse: 'GET /api/mcp/sse',
                    usage: 'GET /api/usage',
                },
                authentication: {
                    type: 'API Key',
                    header: 'X-API-Key or Authorization: Bearer <key>',
                },
            });
        });
        // Protected routes - require API key
        this.app.use('/api/mcp', this.authMiddleware.bind(this));
        this.app.use('/api/usage', this.authMiddleware.bind(this));
        // List available tools
        this.app.get('/api/mcp/tools', async (req, res) => {
            try {
                const tools = Array.from(this.handlers.values()).map(handler => ({
                    name: handler.name,
                    description: handler.description,
                    inputSchema: handler.inputSchema,
                }));
                res.json({
                    success: true,
                    tools,
                    count: tools.length,
                });
            }
            catch (error) {
                this.handleError(res, error, req.requestId);
            }
        });
        // Call a tool
        this.app.post('/api/mcp/call', async (req, res) => {
            const startTime = req.startTime ?? Date.now();
            const { tool, arguments: args } = req.body;
            if (!tool || typeof tool !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Missing or invalid tool name',
                    code: 'INVALID_REQUEST',
                });
                return;
            }
            const handler = this.handlers.get(tool);
            if (!handler) {
                res.status(404).json({
                    success: false,
                    error: `Tool not found: ${tool}`,
                    code: 'TOOL_NOT_FOUND',
                    availableTools: Array.from(this.handlers.keys()),
                });
                return;
            }
            try {
                const context = {
                    requestId: req.requestId ?? this.generateRequestId(),
                    config: {},
                    logger: this.logger,
                    ...(req.auth?.userId && { userId: req.auth.userId }),
                    ...(req.auth?.apiKeyId && { apiKey: req.auth.apiKeyId }),
                };
                this.logger.info('Tool call started', {
                    tool,
                    requestId: context.requestId,
                    userId: req.auth?.userId,
                    apiKeyId: req.auth?.apiKeyId,
                });
                const result = await handler.handler(args ?? {}, context);
                const responseTimeMs = Date.now() - startTime;
                // Track usage
                if (req.auth?.apiKeyId && req.auth?.userId) {
                    await this.config.usageTracking({
                        apiKeyId: req.auth.apiKeyId,
                        userId: req.auth.userId,
                        toolName: tool,
                        libraryId: args?.libraryId,
                        query: args?.query,
                        tokensReturned: this.estimateTokens(result),
                        responseTimeMs,
                        success: true,
                    }).catch(err => this.logger.error('Usage tracking failed', err));
                }
                this.logger.info('Tool call completed', {
                    tool,
                    requestId: context.requestId,
                    responseTimeMs,
                });
                res.json({
                    success: true,
                    result,
                    meta: {
                        requestId: context.requestId,
                        tool,
                        responseTimeMs,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
            catch (error) {
                const responseTimeMs = Date.now() - startTime;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                // Track failed usage
                if (req.auth?.apiKeyId && req.auth?.userId) {
                    await this.config.usageTracking({
                        apiKeyId: req.auth.apiKeyId,
                        userId: req.auth.userId,
                        toolName: tool,
                        responseTimeMs,
                        success: false,
                        errorMessage,
                    }).catch(err => this.logger.error('Usage tracking failed', err));
                }
                this.handleError(res, error, req.requestId);
            }
        });
        // SSE endpoint for MCP protocol
        this.app.get('/api/mcp/sse', async (req, res) => {
            const sessionId = req.requestId ?? this.generateRequestId();
            this.logger.info('SSE connection started', { sessionId, userId: req.auth?.userId });
            const transport = new sse_js_1.SSEServerTransport('/api/mcp/messages', res);
            this.transports.set(sessionId, transport);
            res.on('close', () => {
                this.transports.delete(sessionId);
                this.logger.info('SSE connection closed', { sessionId });
            });
            await this.server.connect(transport);
        });
        // SSE messages endpoint
        this.app.post('/api/mcp/messages', async (req, res) => {
            const sessionId = req.query['sessionId'];
            const transport = this.transports.get(sessionId);
            if (!transport) {
                res.status(404).json({
                    success: false,
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND',
                });
                return;
            }
            try {
                // Cast to the expected type for handlePostMessage
                await transport.handlePostMessage(req, res);
            }
            catch (error) {
                this.handleError(res, error, req.requestId);
            }
        });
        // Get usage statistics
        this.app.get('/api/usage', async (req, res) => {
            try {
                res.json({
                    success: true,
                    usage: {
                        apiKeyId: req.auth?.apiKeyId,
                        tier: req.auth?.tier,
                        quotaDaily: req.auth?.quotaDaily,
                        quotaMonthly: req.auth?.quotaMonthly,
                        usedDaily: req.auth?.usedDaily ?? 0,
                        usedMonthly: req.auth?.usedMonthly ?? 0,
                        remainingDaily: (req.auth?.quotaDaily ?? 0) - (req.auth?.usedDaily ?? 0),
                        remainingMonthly: (req.auth?.quotaMonthly ?? 0) - (req.auth?.usedMonthly ?? 0),
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                this.handleError(res, error, req.requestId);
            }
        });
    }
    async authMiddleware(req, res, next) {
        const apiKey = this.extractApiKey(req);
        if (!apiKey) {
            res.status(401).json({
                success: false,
                error: 'API key required',
                code: 'MISSING_API_KEY',
                hint: 'Provide API key via X-API-Key header or Authorization: Bearer <key>',
            });
            return;
        }
        try {
            const validation = await this.config.apiKeyValidation(apiKey);
            if (!validation.valid) {
                this.logger.warn('Invalid API key attempt', {
                    error: validation.error,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                });
                res.status(401).json({
                    success: false,
                    error: validation.error ?? 'Invalid API key',
                    code: validation.errorCode ?? 'INVALID_API_KEY',
                });
                return;
            }
            req.auth = validation;
            next();
        }
        catch (error) {
            this.logger.error('Auth middleware error', error);
            res.status(500).json({
                success: false,
                error: 'Authentication failed',
                code: 'AUTH_ERROR',
            });
        }
    }
    extractApiKey(req) {
        const headerKey = req.headers['x-api-key'];
        if (headerKey)
            return headerKey;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        const queryKey = req.query['api_key'];
        if (queryKey)
            return queryKey;
        return null;
    }
    setupErrorHandling() {
        this.app.use((err, req, res, _next) => {
            this.logger.error('Unhandled error', err, { requestId: req.requestId });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
                requestId: req.requestId,
            });
        });
        this.server.onerror = (error) => {
            this.logger.error('MCP Server error', error);
        };
    }
    handleError(res, error, requestId) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Request error', error, { requestId });
        res.status(500).json({
            success: false,
            error: message,
            code: 'INTERNAL_ERROR',
            requestId,
        });
    }
    generateRequestId() {
        return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    estimateTokens(data) {
        try {
            const str = JSON.stringify(data);
            return Math.ceil(str.length / 4);
        }
        catch {
            return 0;
        }
    }
    async start() {
        return new Promise((resolve) => {
            this.httpServer = this.app.listen(this.config.port, this.config.host, () => {
                this.logger.info(`TwinMCP HTTP Server started on http://${this.config.host}:${this.config.port}`);
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve, reject) => {
            if (this.httpServer) {
                this.httpServer.close((err) => {
                    if (err)
                        reject(err);
                    else {
                        this.logger.info('TwinMCP HTTP Server stopped');
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    addHandler(handler) {
        this.handlers.set(handler.name, handler);
        this.logger.info('Added custom handler', { name: handler.name });
    }
    getApp() {
        return this.app;
    }
}
exports.TwinMCPHttpServer = TwinMCPHttpServer;
//# sourceMappingURL=http-server.js.map