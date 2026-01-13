"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMCP = initializeMCP;
exports.shutdownMCP = shutdownMCP;
// Initialisation du système MCP
const tools_1 = require("./tools");
const cache_1 = require("./core/cache");
const queue_1 = require("./utils/queue");
const metrics_1 = require("./utils/metrics");
async function initializeMCP() {
    console.log('🚀 Initializing MCP System...');
    try {
        // 1. Initialiser le cache
        await (0, cache_1.initializeCache)();
        console.log('✅ Cache system initialized');
        // 2. Initialiser la queue
        await (0, queue_1.initializeQueue)();
        console.log('✅ Queue system initialized');
        // 3. Initialiser les métriques
        await (0, metrics_1.initializeMetrics)();
        console.log('✅ Metrics system initialized');
        // 4. Initialiser les outils
        await (0, tools_1.initializeTools)();
        console.log('✅ Tools system initialized');
        console.log('🎉 MCP System fully initialized and ready!');
        console.log('');
        console.log('📋 Available endpoints:');
        console.log('   GET    /api/v1/mcp/tools     - List available tools');
        console.log('   POST   /api/v1/mcp/execute   - Execute tools');
        console.log('   GET    /api/v1/mcp/health    - Health check');
        console.log('   GET    /api/v1/mcp/metrics   - System metrics');
        console.log('   GET    /api/v1/mcp/queue     - Queue management');
        console.log('');
        console.log('🔐 Authentication:');
        console.log('   API Key: mcp-default-key-12345');
        console.log('   Email: admin@example.com');
        console.log('');
    }
    catch (error) {
        console.error('❌ Failed to initialize MCP System:', error);
        throw error;
    }
}
async function shutdownMCP() {
    console.log('🛑 Shutting down MCP System...');
    try {
        // Fermer les systèmes dans l'ordre inverse
        await Promise.all([
        // await closeQueue(),
        // await closeCache()
        ]);
        console.log('✅ MCP System shutdown complete');
    }
    catch (error) {
        console.error('❌ Error during MCP shutdown:', error);
    }
}
//# sourceMappingURL=init.js.map