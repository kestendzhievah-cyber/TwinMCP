"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const mcp_tools_1 = require("@/lib/mcp-tools");
async function GET() {
    try {
        return server_1.NextResponse.json({
            status: 'MCP server initialized',
            serverInfo: {
                name: 'corel-mcp-server',
                version: '1.0.0',
                tools: mcp_tools_1.mcpTools.map(t => t.name),
                capabilities: {
                    tools: {},
                }
            }
        });
    }
    catch (error) {
        console.error('Error initializing MCP server:', error);
        return server_1.NextResponse.json({ error: 'Failed to initialize MCP server' }, { status: 500 });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { method, params } = body;
        // Handle tool calls
        if (method === 'tools/call' && params?.name) {
            const { name, arguments: args } = params;
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
            // Execute the tool
            const result = (0, mcp_tools_1.executeTool)(name, args);
            return server_1.NextResponse.json({
                result: {
                    content: [
                        {
                            type: 'text',
                            text: result,
                        },
                    ],
                }
            });
        }
        // Handle tools list
        if (method === 'tools/list') {
            return server_1.NextResponse.json({
                tools: mcp_tools_1.mcpTools.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema
                }))
            });
        }
        // Handle initialize
        if (method === 'initialize') {
            return server_1.NextResponse.json({
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: 'corel-mcp-server',
                    version: '1.0.0',
                }
            });
        }
        return server_1.NextResponse.json({
            error: 'Method not supported',
        }, { status: 400 });
    }
    catch (error) {
        console.error('Error in MCP server:', error);
        return server_1.NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map