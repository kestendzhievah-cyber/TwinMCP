"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTool = void 0;
const googleapis_1 = require("googleapis");
const nodemailer_1 = __importDefault(require("nodemailer"));
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
const sendEmailSchema = zod_1.z.object({
    to: zod_1.z.string().email('Invalid email format'),
    subject: zod_1.z.string().min(1, 'Subject is required'),
    body: zod_1.z.string().min(1, 'Body is required'),
    from: zod_1.z.string().email().optional(),
    cc: zod_1.z.array(zod_1.z.string().email()).optional(),
    bcc: zod_1.z.array(zod_1.z.string().email()).optional(),
    attachments: zod_1.z.array(zod_1.z.object({
        filename: zod_1.z.string(),
        content: zod_1.z.string(),
        type: zod_1.z.string()
    })).optional()
});
class EmailTool {
    id = 'email';
    name = 'Send Email';
    version = '1.0.0';
    category = 'communication';
    description = 'Send emails via Gmail or SMTP with advanced features';
    author = 'MCP Team';
    tags = ['email', 'gmail', 'smtp', 'communication'];
    // Configuration OAuth2
    requiredConfig = [
        'email_credentials.client_id',
        'email_credentials.client_secret',
        'email_credentials.refresh_token',
        'email_credentials.email'
    ];
    optionalConfig = [
        'email_credentials.access_token',
        'email_credentials.name',
        'smtp_host',
        'smtp_port',
        'default_from'
    ];
    inputSchema = sendEmailSchema;
    // Ajoutez ces propriétés manquantes
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: false
    };
    rateLimit = {
        requests: 100,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 300, // 5 minutes
        key: (args) => `email:${args.to}:${args.subject}`,
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
                throw new Error('Rate limit exceeded for email tool');
            }
            // Vérifier le cache
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult) {
                console.log(`📧 Email cache hit for ${args.to}`);
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
            // Simulation de l'envoi d'email (à remplacer par une vraie implémentation)
            const result = await this.sendEmail(args, config);
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
                estimatedCost: 0.001 // Coût estimé par email
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
                errorType: error.name || 'EmailError',
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
    async sendEmail(args, config) {
        try {
            // Configuration OAuth2
            const oauth2Client = new googleapis_1.google.auth.OAuth2(config.email_credentials.client_id, config.email_credentials.client_secret, 'https://developers.google.com/oauthplayground' // URL de redirection
            );
            // Définir les tokens d'accès
            oauth2Client.setCredentials({
                refresh_token: config.email_credentials.refresh_token,
                access_token: config.email_credentials.access_token
            });
            // Créer le transporteur Nodemailer avec OAuth2
            const transporter = nodemailer_1.default.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: config.email_credentials.email,
                    clientId: config.email_credentials.client_id,
                    clientSecret: config.email_credentials.client_secret,
                    refreshToken: config.email_credentials.refresh_token,
                    accessToken: (await oauth2Client.getAccessToken()).token
                }
            });
            // Options de l'email
            const mailOptions = {
                from: args.from || `"${config.email_credentials.name || 'MCP'}" <${config.email_credentials.email}>`,
                to: args.to,
                subject: args.subject,
                text: args.body,
                html: `<div>${args.body}</div>`,
                cc: args.cc,
                bcc: args.bcc,
                attachments: args.attachments?.map((a) => ({
                    filename: a.filename,
                    content: Buffer.from(a.content, 'base64'),
                    contentType: a.type
                }))
            };
            // Envoi de l'email
            const info = await transporter.sendMail(mailOptions);
            return {
                messageId: info.messageId,
                to: args.to,
                subject: args.subject,
                status: 'sent',
                timestamp: new Date().toISOString(),
                provider: 'gmail',
                metadata: {
                    size: args.body.length,
                    attachments: args.attachments?.length || 0,
                    priority: args.priority || 'normal',
                    response: info.response
                }
            };
        }
        catch (error) {
            console.error('Erreur lors de l\'envoi de l\'email:', error);
            throw new Error(`Échec de l'envoi de l'email: ${error.message}`);
        }
    }
}
exports.EmailTool = EmailTool;
//# sourceMappingURL=email.js.map