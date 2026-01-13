"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryDocsTool = void 0;
const zod_1 = require("zod");
class QueryDocsTool {
    id = 'query-docs';
    name = 'query-docs';
    version = '1.0.0';
    category = 'development';
    description = 'Search documentation for a specific library';
    author = 'TwinMCP Team';
    tags = ['documentation', 'search', 'vector', 'query'];
    requiredConfig = ['database', 'redis', 'vector_store'];
    optionalConfig = ['openai_api_key'];
    inputSchema = zod_1.z.object({
        library_id: zod_1.z.string()
            .min(1, "L'ID de bibliothèque est requis")
            .describe("Identifiant unique de la bibliothèque (ex: 'react', 'nodejs')"),
        query: zod_1.z.string()
            .min(1, "La requête est requise")
            .max(1000, "La requête est trop longue")
            .describe("Question ou recherche sur la documentation"),
        version: zod_1.z.string()
            .optional()
            .describe("Version spécifique de la bibliothèque"),
        max_results: zod_1.z.number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe("Nombre maximum de résultats à retourner"),
        include_code: zod_1.z.boolean()
            .default(true)
            .describe("Inclure les snippets de code dans les résultats"),
        context_limit: zod_1.z.number()
            .int()
            .min(1000)
            .max(8000)
            .default(4000)
            .describe("Limite de tokens pour le contexte")
    });
    capabilities = {
        async: true,
        batch: false,
        streaming: false,
        webhook: false
    };
    rateLimit = {
        requests: 50,
        period: '1m',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 600, // 10 minutes
        key: (args) => `query-docs:${JSON.stringify(args)}`,
        strategy: 'redis'
    };
    vectorSearchService;
    constructor(vectorSearchService) {
        this.vectorSearchService = vectorSearchService;
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
            console.log(`[QueryDocs] Processing query for library "${validatedInput.library_id}": "${validatedInput.query}"`);
            // Rechercher les documents
            const result = await this.vectorSearchService.searchDocuments(validatedInput);
            // Log du résultat
            console.log(`[QueryDocs] Found ${result.results.length} results in ${Date.now() - startTime}ms`);
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false, // TODO: Implémenter le cache check
                    apiCallsCount: 1,
                    tokensReturned: result.totalTokens
                }
            };
        }
        catch (error) {
            console.error(`[QueryDocs] Error: ${error.message}`, error.stack);
            return {
                success: false,
                error: 'Documentation search failed',
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
        console.log(`[QueryDocs] Starting execution with args:`, args);
        return args;
    }
    async afterExecute(result) {
        // Log après exécution
        console.log(`[QueryDocs] Execution completed:`, {
            success: result.success,
            executionTime: result.metadata?.executionTime,
            tokensReturned: result.metadata?.tokensReturned
        });
        return result;
    }
    async onError(error, args) {
        console.error(`[QueryDocs] Error in execution:`, {
            error: error.message,
            stack: error.stack,
            args
        });
    }
}
exports.QueryDocsTool = QueryDocsTool;
//# sourceMappingURL=query-docs.tool.js.map