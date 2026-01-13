"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSchemas = exports.validator = exports.InputValidator = void 0;
const zod_1 = require("zod");
class InputValidator {
    schemas = new Map();
    globalSchemas = new Map();
    // Enregistrer un schema pour un outil spécifique
    registerSchema(toolId, schema) {
        this.schemas.set(toolId, schema);
        console.log(`📋 Schema registered for tool: ${toolId}`);
    }
    // Enregistrer un schema global (ex: pour l'authentification)
    registerGlobalSchema(name, schema) {
        this.globalSchemas.set(name, schema);
        console.log(`📋 Global schema registered: ${name}`);
    }
    // Valider les arguments d'un outil
    async validate(toolId, args) {
        const schema = this.schemas.get(toolId);
        if (!schema) {
            return {
                success: false,
                errors: [{
                        path: 'tool',
                        message: `No validation schema found for tool: ${toolId}`
                    }]
            };
        }
        try {
            const validated = await schema.parseAsync(args);
            return { success: true, data: validated };
        }
        catch (error) {
            return {
                success: false,
                errors: error.errors?.map((e) => ({
                    path: e.path.join('.'),
                    message: this.formatValidationMessage(e)
                })) || [{
                        path: 'unknown',
                        message: 'Validation failed'
                    }]
            };
        }
    }
    // Validation globale (ex: pour les requêtes API)
    async validateGlobal(name, data) {
        const schema = this.globalSchemas.get(name);
        if (!schema) {
            return {
                success: false,
                errors: [{
                        path: 'schema',
                        message: `No global schema found: ${name}`
                    }]
            };
        }
        try {
            const validated = await schema.parseAsync(data);
            return { success: true, data: validated };
        }
        catch (error) {
            return {
                success: false,
                errors: error.errors?.map((e) => ({
                    path: e.path.join('.'),
                    message: this.formatValidationMessage(e)
                })) || [{
                        path: 'unknown',
                        message: 'Global validation failed'
                    }]
            };
        }
    }
    // Sanitisation des entrées
    sanitize(input) {
        if (typeof input === 'string') {
            return this.sanitizeString(input);
        }
        if (Array.isArray(input)) {
            return input.map(item => this.sanitize(item));
        }
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitize(value);
            }
            return sanitized;
        }
        return input;
    }
    // Validation de sécurité (XSS, injection SQL, etc.)
    async securityValidate(input) {
        const issues = [];
        this.checkForSecurityIssues(input, '', issues);
        return {
            success: issues.length === 0,
            errors: issues.length > 0 ? issues : undefined
        };
    }
    checkForSecurityIssues(obj, path, issues) {
        if (typeof obj === 'string') {
            // Vérifier les scripts XSS
            if (this.containsScript(obj)) {
                issues.push({
                    path,
                    message: 'Potentially dangerous script content detected'
                });
            }
            // Vérifier les injections SQL
            if (this.containsSQLInjection(obj)) {
                issues.push({
                    path,
                    message: 'Potential SQL injection detected'
                });
            }
            // Vérifier les paths traversant
            if (this.containsPathTraversal(obj)) {
                issues.push({
                    path,
                    message: 'Path traversal attempt detected'
                });
            }
        }
        else if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.checkForSecurityIssues(item, `${path}[${index}]`, issues);
            });
        }
        else if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                this.checkForSecurityIssues(value, path ? `${path}.${key}` : key, issues);
            }
        }
    }
    containsScript(str) {
        const scriptPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /on\w+\s*=/gi,
            /<iframe\b/gi,
            /<object\b/gi,
            /<embed\b/gi
        ];
        return scriptPatterns.some(pattern => pattern.test(str));
    }
    containsSQLInjection(str) {
        const sqlPatterns = [
            /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b)/gi,
            /('|(\\')|(;)|(\|)|(\*)|(%)|(\+)|(\-)|(\?)|(\()|(\))|(\[)|(\])|(\{)|(\}))/g,
            /--/g,
            /\/\*/g,
            /\*\//g
        ];
        return sqlPatterns.some(pattern => pattern.test(str));
    }
    containsPathTraversal(str) {
        const traversalPatterns = [
            /\.\.[\/\\]/g,
            /\.\.%2f/gi,
            /\.\.%5c/gi,
            /%2e%2e%2f/gi,
            /%2e%2e%5c/gi
        ];
        return traversalPatterns.some(pattern => pattern.test(str));
    }
    sanitizeString(str) {
        // Supprimer les caractères de contrôle
        return str.replace(/[\x00-\x1F\x7F]/g, '').trim();
    }
    formatValidationMessage(error) {
        switch (error.code) {
            case 'invalid_type':
                return `Expected ${error.expected}, received ${error.received}`;
            case 'invalid_string':
                if (error.validation === 'email')
                    return 'Invalid email format';
                if (error.validation === 'url')
                    return 'Invalid URL format';
                return 'Invalid string format';
            case 'too_small':
                return `Value is too small (minimum: ${error.minimum})`;
            case 'too_big':
                return `Value is too large (maximum: ${error.maximum})`;
            case 'invalid_enum_value':
                return `Invalid value. Expected one of: ${error.options.join(', ')}`;
            default:
                return error.message || 'Validation failed';
        }
    }
    // Validation de batch (pour plusieurs outils à la fois)
    async validateBatch(toolArgs) {
        const results = await Promise.all(toolArgs.map(async ({ toolId, args }) => ({
            toolId,
            validation: await this.validate(toolId, args)
        })));
        const overallSuccess = results.every(result => result.validation.success);
        return {
            results,
            overallSuccess
        };
    }
    // Obtenir le schema d'un outil (pour la documentation)
    getSchema(toolId) {
        return this.schemas.get(toolId) || null;
    }
    // Obtenir tous les schemas (pour la documentation)
    getAllSchemas() {
        return Array.from(this.schemas.entries()).map(([toolId, schema]) => ({
            toolId,
            schema
        }));
    }
    // Nettoyer les schemas
    clearSchemas() {
        this.schemas.clear();
        this.globalSchemas.clear();
        console.log('🧹 Validation schemas cleared');
    }
}
exports.InputValidator = InputValidator;
// Instance globale
exports.validator = new InputValidator();
// Schémas globaux couramment utilisés
exports.globalSchemas = {
    pagination: zod_1.z.object({
        limit: zod_1.z.number().min(1).max(100).default(20),
        offset: zod_1.z.number().min(0).default(0),
        sort: zod_1.z.string().optional(),
        order: zod_1.z.enum(['asc', 'desc']).default('asc')
    }),
    dateRange: zod_1.z.object({
        startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
        message: "Start date must be before end date",
        path: ["endDate"]
    }),
    contactInfo: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
        company: zod_1.z.string().max(100).optional()
    }),
    apiKey: zod_1.z.string().min(10).regex(/^[a-zA-Z0-9_-]+$/),
    jwt: zod_1.z.string().min(10).regex(/^Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
};
// Enregistrer les schémas globaux
Object.entries(exports.globalSchemas).forEach(([name, schema]) => {
    exports.validator.registerGlobalSchema(name, schema);
});
//# sourceMappingURL=validator.js.map