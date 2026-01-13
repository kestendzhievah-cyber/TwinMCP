"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveLibraryIdTool = void 0;
const zod_1 = require("zod");
class ResolveLibraryIdTool {
    id = 'resolve-library-id';
    name = 'resolve-library-id';
    version = '1.0.0';
    category = 'development';
    description = 'Resolve library names and find matching software libraries';
    author = 'TwinMCP Team';
    tags = ['library', 'search', 'resolution', 'documentation'];
    requiredConfig = ['database', 'redis'];
    optionalConfig = ['openai_api_key'];
    inputSchema = zod_1.z.object({
        query: zod_1.z.string()
            .min(1, "La requête est requise")
            .max(200, "La requête est trop longue")
            .describe("Nom de la bibliothèque à rechercher (ex: 'react', 'express', 'django')"),
        context: zod_1.z.object({
            language: zod_1.z.string()
                .optional()
                .describe("Langage de programmation (ex: 'javascript', 'python', 'rust')"),
            framework: zod_1.z.string()
                .optional()
                .describe("Framework associé (ex: 'node', 'django', 'spring')"),
            ecosystem: zod_1.z.string()
                .optional()
                .describe("Écosystème (ex: 'npm', 'pip', 'cargo', 'composer')")
        }).optional()
            .describe("Contexte optionnel pour affiner la recherche"),
        limit: zod_1.z.number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe("Nombre maximum de résultats à retourner"),
        include_aliases: zod_1.z.boolean()
            .default(true)
            .describe("Inclure les alias et variantes dans la recherche")
    });
    capabilities = {
        async: true,
        batch: false,
        streaming: false,
        webhook: false
    };
    rateLimit = {
        requests: 100,
        period: '1m',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 300, // 5 minutes
        key: (args) => `resolve-library-id:${JSON.stringify(args)}`,
        strategy: 'redis'
    };
    resolutionService;
    constructor(resolutionService) {
        this.resolutionService = resolutionService;
    }
    async validate(args) {
        try {
            const validatedInput = this.inputSchema.parse(args);
            return {
                success: true,
                data: validatedInput
            };
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return {
                    success: false,
                    errors: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message
                    }))
                };
            }
            return {
                success: false,
                errors: [{ path: 'unknown', message: error.message }]
            };
        }
    }
    async execute(args, config) {
        const startTime = Date.now();
        try {
            // Valider l'entrée
            const validation = await this.validate(args);
            if (!validation.success) {
                return {
                    success: false,
                    error: 'Invalid input parameters',
                    metadata: {
                        executionTime: Date.now() - startTime,
                        cacheHit: false,
                        apiCallsCount: 0,
                        errors: validation.errors
                    }
                };
            }
            const validatedInput = validation.data;
            // Log de la requête
            console.log(`[ResolveLibraryId] Processing query: "${validatedInput.query}"`);
            // Résoudre la bibliothèque
            const result = await this.resolutionService.resolveLibrary(validatedInput);
            // Log du résultat
            console.log(`[ResolveLibraryId] Found ${result.results.length} results in ${result.processingTimeMs}ms`);
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false, // TODO: Implémenter le cache check
                    apiCallsCount: 1
                }
            };
        }
        catch (error) {
            console.error(`[ResolveLibraryId] Error: ${error.message}`, error.stack);
            return {
                success: false,
                error: 'Library resolution failed',
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 0
                }
            };
        }
    }
    async beforeExecute(args) {
        // Log avant exécution
        console.log(`[ResolveLibraryId] Starting execution with args:`, args);
        return args;
    }
    async afterExecute(result) {
        // Log après exécution
        console.log(`[ResolveLibraryId] Execution completed:`, {
            success: result.success,
            executionTime: result.metadata?.executionTime
        });
        return result;
    }
    async onError(error, args) {
        console.error(`[ResolveLibraryId] Error in execution:`, {
            error: error.message,
            stack: error.stack,
            args
        });
    }
}
exports.ResolveLibraryIdTool = ResolveLibraryIdTool;
//# sourceMappingURL=resolve-library-id.tool.js.map