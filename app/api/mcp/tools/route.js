"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const mcp_tools_1 = require("@/lib/mcp-tools");
async function GET(request) {
    try {
        return server_1.NextResponse.json({
            tools: mcp_tools_1.mcpTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            })),
            serverInfo: {
                name: mcp_tools_1.serverInfo.name,
                version: mcp_tools_1.serverInfo.version,
            }
        });
    }
    catch (error) {
        console.error('Error listing MCP tools:', error);
        return server_1.NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map