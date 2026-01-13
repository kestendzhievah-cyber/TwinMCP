"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const mcp_tools_1 = require("@/lib/mcp-tools");
// Simulate tool execution results
const getToolResult = (toolName, args) => {
    return (0, mcp_tools_1.executeTool)(toolName, args);
};
async function POST(request) {
    try {
        const body = await request.json();
        const { name, arguments: args } = body;
        // Validate required parameters
        if (!name) {
            return server_1.NextResponse.json({
                error: 'Tool name is required',
            }, { status: 400 });
        }
        // Find the tool
        const tool = mcp_tools_1.mcpTools.find(t => t.name === name);
        if (!tool) {
            return server_1.NextResponse.json({
                error: `Tool '${name}' not found`,
            }, { status: 404 });
        }
        // Validate required arguments
        const missingArgs = (0, mcp_tools_1.validateToolArgs)(tool, args);
        if (missingArgs.length > 0) {
            return server_1.NextResponse.json({
                error: `Missing required arguments: ${missingArgs.join(', ')}`,
            }, { status: 400 });
        }
        // Execute the tool (simulation)
        const result = getToolResult(name, args);
        return server_1.NextResponse.json({
            content: [
                {
                    type: 'text',
                    text: result,
                },
            ],
        });
    }
    catch (error) {
        console.error('Error executing MCP tool:', error);
        return server_1.NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map