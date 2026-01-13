"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackTool = void 0;
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
const slackSendSchema = zod_1.z.object({
    channel: zod_1.z.string().min(1, 'Channel is required'),
    text: zod_1.z.string().min(1, 'Message text is required').max(4000, 'Message too long'),
    thread_ts: zod_1.z.string().optional(),
    blocks: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        text: zod_1.z.object({
            type: zod_1.z.literal('plain_text').or(zod_1.z.literal('mrkdwn')),
            text: zod_1.z.string()
        }).optional(),
        elements: zod_1.z.any().optional()
    })).optional(),
    attachments: zod_1.z.array(zod_1.z.object({
        color: zod_1.z.string().optional(),
        title: zod_1.z.string().optional(),
        text: zod_1.z.string().optional(),
        fields: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            value: zod_1.z.string(),
            short: zod_1.z.boolean().optional()
        })).optional()
    })).optional(),
    username: zod_1.z.string().optional(),
    icon_emoji: zod_1.z.string().optional(),
    icon_url: zod_1.z.string().url().optional()
});
class SlackTool {
    id = 'slack';
    name = 'Send Slack Message';
    version = '1.0.0';
    category = 'communication';
    description = 'Send messages to Slack channels with rich formatting and attachments';
    author = 'MCP Team';
    tags = ['slack', 'messaging', 'communication', 'chat', 'notification'];
    requiredConfig = ['slack_bot_token', 'slack_channel'];
    optionalConfig = ['default_username', 'default_icon'];
    inputSchema = slackSendSchema;
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: true
    };
    rateLimit = {
        requests: 200,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 60, // 1 minute
        key: (args) => `slack:${args.channel}:${args.text.slice(0, 50)}`,
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
                throw new Error('Rate limit exceeded for Slack tool');
            }
            // Vérifier le cache
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult) {
                console.log(`💬 Slack cache hit for channel ${args.channel}`);
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
            // Simulation de l'envoi Slack
            const result = await this.sendSlackMessage(args, config);
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
                estimatedCost: 0.0001 // Coût très bas pour Slack
            });
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: 0.0001
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
                errorType: error.name || 'SlackError',
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
    async sendSlackMessage(args, config) {
        // Simulation de l'envoi Slack
        // Dans une vraie implémentation, utiliser Slack Web API
        await new Promise(resolve => setTimeout(resolve, 120)); // Simulation réseau
        const timestamp = Date.now() / 1000;
        const ts = args.thread_ts || timestamp.toString();
        return {
            ok: true,
            channel: args.channel,
            ts: ts.toString(),
            message: {
                type: 'message',
                subtype: undefined,
                text: args.text,
                ts: ts.toString(),
                username: args.username || config.default_username || 'MCP Bot',
                bot_id: `B${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                attachments: args.attachments || [],
                blocks: args.blocks || [],
                thread_ts: args.thread_ts
            },
            metadata: {
                apiCallsCount: 1,
                size: args.text.length,
                hasAttachments: !!(args.attachments && args.attachments.length > 0),
                hasBlocks: !!(args.blocks && args.blocks.length > 0),
                timestamp: new Date().toISOString()
            }
        };
    }
    async beforeExecute(args) {
        console.log(`💬 Sending Slack message to ${args.channel}`);
        return args;
    }
    async afterExecute(result) {
        if (result.success) {
            console.log(`✅ Slack message sent to ${result.data?.channel}: ${result.data?.ts}`);
        }
        return result;
    }
    async onError(error) {
        console.error(`❌ Slack error: ${error.message}`);
    }
}
exports.SlackTool = SlackTool;
//# sourceMappingURL=slack.js.map