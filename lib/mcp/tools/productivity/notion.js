"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionTool = void 0;
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
const notionCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(2000, 'Title too long'),
    content: zod_1.z.string().optional(),
    parentId: zod_1.z.string().optional(),
    databaseId: zod_1.z.string().optional(),
    properties: zod_1.z.record(zod_1.z.any()).optional(),
    children: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        content: zod_1.z.string().optional(),
        children: zod_1.z.any().optional()
    })).optional(),
    icon: zod_1.z.object({
        type: zod_1.z.enum(['emoji', 'external', 'file']),
        emoji: zod_1.z.string().optional(),
        url: zod_1.z.string().optional()
    }).optional(),
    cover: zod_1.z.object({
        type: zod_1.z.enum(['external', 'file']),
        url: zod_1.z.string().optional()
    }).optional()
});
class NotionTool {
    id = 'notion';
    name = 'Create Notion Page';
    version = '1.0.0';
    category = 'productivity';
    description = 'Create pages and databases in Notion with rich content and properties';
    author = 'MCP Team';
    tags = ['notion', 'pages', 'databases', 'productivity', 'notes'];
    requiredConfig = ['notion_api_token'];
    optionalConfig = ['default_workspace_id', 'default_database_id'];
    inputSchema = notionCreateSchema;
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: false
    };
    rateLimit = {
        requests: 50,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 1800, // 30 minutes
        key: (args) => `notion:${args.parentId || 'root'}:${args.title}`,
        strategy: 'memory'
    };
    async validate(args) {
        try {
            const validated = await this.inputSchema.parseAsync(args);
            return { success: true, data: validated };
        }
        catch (error) {
            return {
                success: false,
                errors: error.errors?.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message
                })) || [{ path: 'unknown', message: 'Validation failed' }]
            };
        }
    }
    async execute(args, config) {
        const startTime = Date.now();
        try {
            // Validation des arguments
            const validation = await this.validate(args);
            if (!validation.success) {
                throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`);
            }
            // Vérifier les rate limits
            const userLimit = await middleware_1.rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id);
            if (!userLimit) {
                throw new Error('Rate limit exceeded for Notion tool');
            }
            // Vérifier le cache
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult) {
                console.log(`📝 Notion cache hit for page: ${args.title}`);
                (0, utils_1.getMetrics)().track({
                    toolId: this.id,
                    userId: config.userId || 'anonymous',
                    timestamp: new Date(),
                    executionTime: Date.now() - startTime,
                    cacheHit: true,
                    success: true,
                    apiCallsCount: 0,
                    estimatedCost: 0
                });
                return {
                    success: true,
                    data: cachedResult,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        cacheHit: true,
                        apiCallsCount: 0,
                        cost: 0
                    }
                };
            }
            // Simulation de la création de page Notion
            const result = await this.createNotionPage(args, config);
            // Mettre en cache
            await cache.set(cacheKey, result, this.cache.ttl);
            // Tracker les métriques
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: false,
                success: true,
                apiCallsCount: 1,
                estimatedCost: 0.001 // Coût estimé par requête Notion
            });
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: 0.001
                }
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime,
                cacheHit: false,
                success: false,
                errorType: error.name || 'NotionError',
                apiCallsCount: 1,
                estimatedCost: 0
            });
            return {
                success: false,
                error: error.message,
                metadata: {
                    executionTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: 0
                }
            };
        }
    }
    async createNotionPage(args, config) {
        // Simulation de la création de page Notion
        // Dans une vraie implémentation, utiliser Notion API
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulation réseau
        const now = new Date();
        const pageId = `page_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            id: pageId,
            title: args.title,
            url: `https://notion.so/${pageId.replace('_', '-')}`,
            parent: {
                type: args.parentId ? 'page_id' : 'workspace',
                page_id: args.parentId
            },
            properties: {
                title: {
                    type: 'title',
                    title: [{ type: 'text', text: { content: args.title } }]
                },
                ...args.properties
            },
            content: args.content || '',
            children: args.children || [],
            icon: args.icon,
            cover: args.cover,
            created_time: now.toISOString(),
            last_edited_time: now.toISOString(),
            archived: false,
            metadata: {
                blocks: args.children?.length || 0,
                size: args.content?.length || 0,
                hasIcon: !!args.icon,
                hasCover: !!args.cover,
                apiCalls: 1
            }
        };
    }
    async beforeExecute(args) {
        console.log(`📝 Creating Notion page: ${args.title}`);
        return args;
    }
    async afterExecute(result) {
        if (result.success) {
            console.log(`✅ Notion page created: ${result.data?.url}`);
        }
        return result;
    }
    async onError(error) {
        console.error(`❌ Notion error: ${error.message}`);
    }
}
exports.NotionTool = NotionTool;
//# sourceMappingURL=notion.js.map