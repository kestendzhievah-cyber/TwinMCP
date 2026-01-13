"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const docs_generator_1 = require("../lib/mcp/utils/docs-generator");
async function generateDocs() {
    console.log('📚 Generating MCP documentation...');
    try {
        // Générer la documentation Markdown
        const markdown = await docs_generator_1.docsGenerator.generateMarkdown();
        // Écrire dans le README
        (0, fs_1.writeFileSync)((0, path_1.join)(process.cwd(), 'README-MCP.md'), markdown);
        // Générer OpenAPI spec
        const openapi = await docs_generator_1.docsGenerator.generateOpenAPI();
        (0, fs_1.writeFileSync)((0, path_1.join)(process.cwd(), 'openapi-spec.json'), JSON.stringify(openapi, null, 2));
        console.log('✅ Documentation generated successfully!');
        console.log('📄 README-MCP.md');
        console.log('📋 openapi-spec.json');
    }
    catch (error) {
        console.error('❌ Error generating documentation:', error);
        process.exit(1);
    }
}
generateDocs();
//# sourceMappingURL=generate-docs.js.map