"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseTool = void 0;
const zod_1 = require("zod");
const core_1 = require("../../core");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../utils");
// Schema pour la lecture Firebase
const firebaseReadSchema = zod_1.z.object({
    collection: zod_1.z.string().min(1, 'Collection name is required'),
    documentId: zod_1.z.string().optional(),
    where: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.enum(['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains']),
        value: zod_1.z.any()
    })).optional(),
    orderBy: zod_1.z.object({
        field: zod_1.z.string(),
        direction: zod_1.z.enum(['asc', 'desc']).default('asc')
    }).optional(),
    limit: zod_1.z.number().min(1).max(100).default(50),
    select: zod_1.z.array(zod_1.z.string()).optional()
});
// Schema pour l'écriture Firebase
const firebaseWriteSchema = zod_1.z.object({
    collection: zod_1.z.string().min(1, 'Collection name is required'),
    documentId: zod_1.z.string().optional(),
    data: zod_1.z.record(zod_1.z.any()).refine(data => Object.keys(data).length > 0, 'Data cannot be empty'),
    merge: zod_1.z.boolean().default(true),
    timestamp: zod_1.z.boolean().default(true)
});
class FirebaseTool {
    id = 'firebase';
    name = 'Firebase Database';
    version = '1.0.0';
    category = 'data';
    description = 'Read and write data to Firebase Firestore with advanced querying';
    author = 'MCP Team';
    tags = ['firebase', 'firestore', 'database', 'data', 'nosql'];
    requiredConfig = ['firebase_project_id', 'firebase_service_account'];
    optionalConfig = ['firebase_database_url', 'default_collection'];
    inputSchema = zod_1.z.discriminatedUnion('operation', [
        zod_1.z.object({
            operation: zod_1.z.literal('read'),
            ...firebaseReadSchema.shape
        }),
        zod_1.z.object({
            operation: zod_1.z.literal('write'),
            ...firebaseWriteSchema.shape
        })
    ]);
    capabilities = {
        async: false,
        batch: true,
        streaming: false,
        webhook: false
    };
    rateLimit = {
        requests: 1000,
        period: '1h',
        strategy: 'sliding'
    };
    cache = {
        enabled: true,
        ttl: 300, // 5 minutes
        key: (args) => `firebase:${args.operation}:${args.collection}:${args.documentId || 'list'}`,
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
                throw new Error('Rate limit exceeded for Firebase tool');
            }
            // Vérifier le cache
            const cache = (0, core_1.getCache)();
            const cacheKey = this.cache.key(args);
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult && args.operation === 'read') {
                console.log(`🔥 Firebase cache hit for ${args.collection}`);
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
            // Exécuter l'opération Firebase
            let result;
            if (args.operation === 'read') {
                result = await this.readFirebase(args, config);
            }
            else {
                result = await this.writeFirebase(args, config);
            }
            // Mettre en cache (seulement pour les lectures)
            if (args.operation === 'read') {
                await cache.set(cacheKey, result, this.cache.ttl);
            }
            // Tracker les métriques
            (0, utils_1.getMetrics)().track({
                toolId: this.id,
                userId: config.userId || 'anonymous',
                timestamp: new Date(),
                executionTime: Date.now() - startTime,
                cacheHit: false,
                success: true,
                apiCallsCount: 1,
                estimatedCost: args.operation === 'write' ? 0.002 : 0.001 // Coût plus élevé pour l'écriture
            });
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    cacheHit: false,
                    apiCallsCount: 1,
                    cost: args.operation === 'write' ? 0.002 : 0.001
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
                errorType: error.name || 'FirebaseError',
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
    async readFirebase(args, config) {
        // Simulation de la lecture Firebase
        // Dans une vraie implémentation, utiliser Firebase Admin SDK
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulation réseau
        if (args.documentId) {
            // Lecture d'un document spécifique
            return {
                id: args.documentId,
                collection: args.collection,
                data: {
                    name: `Document ${args.documentId}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...this.generateMockData()
                },
                exists: true,
                metadata: {
                    readTime: new Date().toISOString(),
                    apiCalls: 1
                }
            };
        }
        else {
            // Lecture de la collection
            const documents = [];
            const numDocs = Math.floor(Math.random() * args.limit) + 1;
            for (let i = 0; i < numDocs; i++) {
                documents.push({
                    id: `doc_${i + 1}`,
                    data: {
                        name: `Document ${i + 1}`,
                        value: Math.floor(Math.random() * 1000),
                        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                        ...this.generateMockData()
                    }
                });
            }
            return {
                documents,
                totalCount: numDocs,
                collection: args.collection,
                hasMore: numDocs >= args.limit,
                metadata: {
                    queryTime: 100,
                    apiCalls: 1,
                    filtered: !!args.where
                }
            };
        }
    }
    async writeFirebase(args, config) {
        // Simulation de l'écriture Firebase
        await new Promise(resolve => setTimeout(resolve, 150)); // Simulation réseau
        const documentId = args.documentId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            id: documentId,
            collection: args.collection,
            data: args.data,
            writeTime: new Date().toISOString(),
            operation: args.merge ? 'merge' : 'create',
            metadata: {
                apiCalls: 1,
                size: JSON.stringify(args.data).length,
                timestamped: args.timestamp
            }
        };
    }
    generateMockData() {
        return {
            status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
            category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
            tags: ['tag1', 'tag2', 'tag3'].filter(() => Math.random() > 0.5),
            metadata: {
                version: Math.floor(Math.random() * 10) + 1,
                lastModified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        };
    }
    async beforeExecute(args) {
        if (args.operation === 'write') {
            console.log(`🔥 Writing to Firebase: ${args.collection}/${args.documentId || 'auto'}`);
        }
        else {
            console.log(`🔥 Reading from Firebase: ${args.collection}${args.documentId ? `/${args.documentId}` : ''}`);
        }
        return args;
    }
    async afterExecute(result) {
        if (result.success) {
            if (result.data?.operation === 'merge' || result.data?.operation === 'create') {
                console.log(`✅ Firebase write successful: ${result.data?.id}`);
            }
            else {
                console.log(`✅ Firebase read successful: ${result.data?.totalCount || 1} documents`);
            }
        }
        return result;
    }
    async onError(error) {
        console.error(`❌ Firebase error: ${error.message}`);
    }
}
exports.FirebaseTool = FirebaseTool;
//# sourceMappingURL=firebase.js.map