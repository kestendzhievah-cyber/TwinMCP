"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const docs_generator_1 = require("@/lib/mcp/utils/docs-generator");
// GET /api/v1/mcp/docs - Générer la documentation
async function GET(request) {
    const startTime = Date.now();
    try {
        const url = new URL(request.url);
        const format = url.searchParams.get('format') || 'markdown';
        if (format === 'openapi') {
            const openapi = await docs_generator_1.docsGenerator.generateOpenAPI();
            return server_1.NextResponse.json(openapi);
        }
        else {
            const markdown = await docs_generator_1.docsGenerator.generateMarkdown();
            return new server_1.NextResponse(markdown, {
                headers: {
                    'Content-Type': 'text/markdown',
                    'Content-Disposition': 'attachment; filename="mcp-api-docs.md"'
                }
            });
        }
    }
    catch (error) {
        console.error('Documentation generation error:', error);
        return server_1.NextResponse.json({ error: error.message || 'Failed to generate documentation' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map