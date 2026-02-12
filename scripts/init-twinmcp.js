#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const child_process_1 = require("child_process");
const library_resolution_service_1 = require("../lib/services/library-resolution.service");
const vector_search_service_1 = require("../lib/services/vector-search.service");
const auth_service_1 = require("../lib/services/auth.service");
const prisma = new client_1.PrismaClient();
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
async function initializeTwinMCP() {
    console.log('🚀 Initializing TwinMCP System...');
    try {
        // 1. Vérifier la connexion à la base de données
        console.log('📊 Checking database connection...');
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        // 2. Vérifier la connexion Redis
        console.log('🔴 Checking Redis connection...');
        await redis.ping();
        console.log('✅ Redis connected successfully');
        // 3. Exécuter les migrations Prisma
        console.log('🔄 Running database migrations...');
        try {
            (0, child_process_1.execSync)('npx prisma migrate deploy', { stdio: 'inherit' });
            console.log('✅ Database migrations completed');
        }
        catch (error) {
            console.log('ℹ️  No new migrations to apply');
        }
        // 4. Seeding des données
        console.log('🌱 Seeding database...');
        try {
            (0, child_process_1.execSync)('npx tsx prisma/seed.ts', { stdio: 'inherit' });
            console.log('✅ Database seeding completed');
        }
        catch (error) {
            console.error('❌ Database seeding failed:', error.message);
        }
        // 5. Initialiser les services TwinMCP
        console.log('🔧 Initializing TwinMCP services...');
        const libraryResolutionService = new library_resolution_service_1.LibraryResolutionService(prisma, redis);
        const vectorSearchService = new vector_search_service_1.VectorSearchService(prisma, redis);
        const authService = new auth_service_1.AuthService(prisma, redis);
        // Test des services
        console.log('🧪 Testing services...');
        // Test Library Resolution
        try {
            const testResult = await libraryResolutionService.resolveLibrary({
                query: 'react',
                limit: 3
            });
            console.log(`✅ Library Resolution test: Found ${testResult.results.length} results`);
        }
        catch (error) {
            console.error('❌ Library Resolution test failed:', error.message);
        }
        // Test Vector Search
        try {
            const testResult = await vectorSearchService.searchDocuments({
                library_id: '/react/react',
                query: 'hooks',
                max_results: 3
            });
            console.log(`✅ Vector Search test: Found ${testResult.results.length} results`);
        }
        catch (error) {
            console.error('❌ Vector Search test failed:', error.message);
        }
        // 6. Créer une clé API de test
        console.log('🔑 Creating test API key...');
        try {
            const testUsers = await prisma.user.findMany({
                where: { email: 'test@twinmcp.com' }
            });
            if (testUsers.length > 0) {
                const testApiKey = await authService.generateApiKey(testUsers[0].id, 'Test API Key');
                console.log(`✅ Test API key created: ${testApiKey.apiKey}`);
                console.log(`   Prefix: ${testApiKey.prefix}`);
                console.log('   ⚠️  Save this key for testing!');
            }
        }
        catch (error) {
            console.error('❌ Failed to create test API key:', error.message);
        }
        console.log('');
        console.log('🎉 TwinMCP System initialization completed!');
        console.log('');
        console.log('📋 Available endpoints:');
        console.log('   POST   /api/mcp/resolve-library-id  - Resolve library names');
        console.log('   POST   /api/mcp/query-docs         - Search documentation');
        console.log('   GET    /api/mcp/tools              - List available tools');
        console.log('   POST   /api/mcp/call               - Execute tools (legacy)');
        console.log('');
        console.log('🔐 Authentication:');
        console.log('   Header: x-api-key: twinmcp_live_...');
        console.log('   Header: Authorization: Bearer twinmcp_live_...');
        console.log('');
        console.log('🧪 Test commands:');
        console.log(`   curl -X POST http://localhost:3000/api/mcp/resolve-library-id \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -H "x-api-key: YOUR_API_KEY" \\`);
        console.log(`     -d '{"query": "react", "limit": 3}'`);
        console.log('');
    }
    catch (error) {
        console.error('❌ TwinMCP initialization failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
        await redis.disconnect();
    }
}
// Gestion des signaux pour arrêt propre
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down TwinMCP initialization...');
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down TwinMCP initialization...');
    await prisma.$disconnect();
    await redis.disconnect();
    process.exit(0);
});
// Lancer l'initialisation
if (require.main === module) {
    initializeTwinMCP();
}
//# sourceMappingURL=init-twinmcp.js.map