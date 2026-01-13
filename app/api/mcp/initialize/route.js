"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const mcp_tools_1 = require("@/lib/mcp-tools");
const loadClientConfig_1 = require("@/lib/loadClientConfig");
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientName = searchParams.get('clientName') || 'Axe Wash';
        // Charger la configuration du client
        const config = await (0, loadClientConfig_1.loadClientConfig)(clientName);
        // Initialiser le serveur MCP
        const initializedServer = {
            ...mcp_tools_1.serverInfo,
            client: {
                name: config.name,
                activeModules: config.modules,
                apiKeysConfigured: Object.keys(config.apiKeys).length,
                settings: config.settings,
            },
            timestamp: new Date().toISOString(),
        };
        return server_1.NextResponse.json({
            success: true,
            message: `MCP Server initialisé pour le client ${config.name}`,
            data: initializedServer,
        });
    }
    catch (error) {
        console.error('Erreur lors de l\'initialisation du serveur MCP:', error);
        return server_1.NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        }, { status: 500 });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { clientName } = body;
        // Charger la configuration du client
        const config = await (0, loadClientConfig_1.loadClientConfig)(clientName || 'Axe Wash');
        // Initialiser le serveur MCP avec configuration complète
        const initializedServer = {
            ...mcp_tools_1.serverInfo,
            client: {
                name: config.name,
                activeModules: config.modules,
                apiKeysConfigured: Object.keys(config.apiKeys).length,
                settings: config.settings,
                timestamp: new Date().toISOString(),
            },
            availableTools: mcp_tools_1.mcpTools.map(tool => tool.name),
        };
        return server_1.NextResponse.json({
            success: true,
            message: `MCP Server initialisé avec succès pour ${config.name}`,
            data: initializedServer,
        });
    }
    catch (error) {
        console.error('Erreur lors de l\'initialisation du serveur MCP:', error);
        return server_1.NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map