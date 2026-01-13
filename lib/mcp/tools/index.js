"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.allTools = exports.QueryDocsTool = exports.ResolveLibraryIdTool = exports.GitHubTool = exports.FirebaseTool = exports.NotionTool = exports.CalendarTool = exports.SlackTool = exports.EmailTool = void 0;
exports.initializeTools = initializeTools;
exports.getTool = getTool;
exports.getAllTools = getAllTools;
exports.searchTools = searchTools;
exports.getToolsByCategory = getToolsByCategory;
// Export centralisé de tous les outils MCP
var email_1 = require("./communication/email");
Object.defineProperty(exports, "EmailTool", { enumerable: true, get: function () { return email_1.EmailTool; } });
var slack_1 = require("./communication/slack");
Object.defineProperty(exports, "SlackTool", { enumerable: true, get: function () { return slack_1.SlackTool; } });
var calendar_1 = require("./productivity/calendar");
Object.defineProperty(exports, "CalendarTool", { enumerable: true, get: function () { return calendar_1.CalendarTool; } });
var notion_1 = require("./productivity/notion");
Object.defineProperty(exports, "NotionTool", { enumerable: true, get: function () { return notion_1.NotionTool; } });
var firebase_1 = require("./data/firebase");
Object.defineProperty(exports, "FirebaseTool", { enumerable: true, get: function () { return firebase_1.FirebaseTool; } });
var github_1 = require("./development/github");
Object.defineProperty(exports, "GitHubTool", { enumerable: true, get: function () { return github_1.GitHubTool; } });
// Outils TwinMCP principaux
var resolve_library_id_tool_1 = require("./resolve-library-id.tool");
Object.defineProperty(exports, "ResolveLibraryIdTool", { enumerable: true, get: function () { return resolve_library_id_tool_1.ResolveLibraryIdTool; } });
var query_docs_tool_1 = require("./query-docs.tool");
Object.defineProperty(exports, "QueryDocsTool", { enumerable: true, get: function () { return query_docs_tool_1.QueryDocsTool; } });
// Import du registry pour l'enregistrement automatique
const registry_1 = require("../core/registry");
const email_2 = require("./communication/email");
const slack_2 = require("./communication/slack");
const calendar_2 = require("./productivity/calendar");
const notion_2 = require("./productivity/notion");
const firebase_2 = require("./data/firebase");
const github_2 = require("./development/github");
const resolve_library_id_tool_2 = require("./resolve-library-id.tool");
const query_docs_tool_2 = require("./query-docs.tool");
// Liste de tous les outils disponibles
exports.allTools = [
    // Outils TwinMCP principaux (priorité haute)
    new resolve_library_id_tool_2.ResolveLibraryIdTool(null), // Sera initialisé plus tard
    new query_docs_tool_2.QueryDocsTool(null), // Sera initialisé plus tard
    // Outils de productivité existants
    new email_2.EmailTool(),
    new slack_2.SlackTool(),
    new calendar_2.CalendarTool(),
    new notion_2.NotionTool(),
    new firebase_2.FirebaseTool(),
    new github_2.GitHubTool()
];
// Fonction d'initialisation - enregistre tous les outils
async function initializeTools(services = {}) {
    console.log('🔧 Initializing MCP Tools...');
    // Initialiser les services TwinMCP
    const { libraryResolutionService, vectorSearchService } = services;
    // Créer les instances avec les services
    const twinmcpTools = [
        new resolve_library_id_tool_2.ResolveLibraryIdTool(libraryResolutionService),
        new query_docs_tool_2.QueryDocsTool(vectorSearchService)
    ];
    // Enregistrer les outils TwinMCP en premier
    for (const tool of twinmcpTools) {
        try {
            registry_1.registry.register(tool);
            console.log(`✅ Registered TwinMCP tool: ${tool.name} (${tool.category})`);
        }
        catch (error) {
            console.error(`❌ Failed to register TwinMCP tool ${tool.name}:`, error);
        }
    }
    // Enregistrer les autres outils
    const otherTools = [
        new email_2.EmailTool(),
        new slack_2.SlackTool(),
        new calendar_2.CalendarTool(),
        new notion_2.NotionTool(),
        new firebase_2.FirebaseTool(),
        new github_2.GitHubTool()
    ];
    for (const tool of otherTools) {
        try {
            registry_1.registry.register(tool);
            console.log(`✅ Registered tool: ${tool.name} (${tool.category})`);
        }
        catch (error) {
            console.error(`❌ Failed to register tool ${tool.name}:`, error);
        }
    }
    const stats = registry_1.registry.getStats();
    console.log(`📊 Registry initialized with ${stats.totalTools} tools`);
    console.log(`   📁 Categories: ${Object.entries(stats.toolsByCategory).map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
    console.log(`   ⚡ Async tools: ${stats.asyncTools}`);
    console.log(`   🎯 Tools with rate limits: ${stats.toolsWithRateLimit}`);
    console.log(`   💾 Tools with cache: ${stats.toolsWithCache}`);
    console.log(`   🔗 Tools with webhooks: ${stats.toolsWithWebhooks}`);
}
// Fonction pour obtenir un outil par ID
function getTool(toolId) {
    return registry_1.registry.get(toolId);
}
// Fonction pour obtenir tous les outils
function getAllTools() {
    return registry_1.registry.getAll();
}
// Fonction pour rechercher des outils
function searchTools(query, filters) {
    return registry_1.registry.search(query, filters);
}
// Fonction pour obtenir les outils par catégorie
function getToolsByCategory(category) {
    return registry_1.registry.getByCategory(category);
}
// Export du registry pour un accès direct si nécessaire
var registry_2 = require("../core/registry");
Object.defineProperty(exports, "registry", { enumerable: true, get: function () { return registry_2.registry; } });
//# sourceMappingURL=index.js.map