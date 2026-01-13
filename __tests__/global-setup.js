"use strict";
// Setup global pour tous les tests MCP
module.exports = async () => {
    console.log('🚀 Setting up MCP test environment...');
    // Initialiser le système MCP pour les tests
    const { initializeMCP } = require('../lib/mcp/init');
    try {
        await initializeMCP();
        console.log('✅ MCP test environment ready');
    }
    catch (error) {
        console.error('❌ Failed to setup MCP test environment:', error);
        throw error;
    }
};
//# sourceMappingURL=global-setup.js.map