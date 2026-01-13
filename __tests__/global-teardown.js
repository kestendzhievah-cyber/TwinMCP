"use strict";
// Teardown global pour tous les tests MCP
module.exports = async () => {
    console.log('🛑 Cleaning up MCP test environment...');
    try {
        const { shutdownMCP } = require('../lib/mcp/init');
        await shutdownMCP();
        console.log('✅ MCP test environment cleaned');
    }
    catch (error) {
        console.error('❌ Error during MCP test cleanup:', error);
    }
};
//# sourceMappingURL=global-teardown.js.map