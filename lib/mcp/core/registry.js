"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.MCPRegistry = void 0;
class MCPRegistry {
    tools = new Map();
    plugins = new Map();
    toolsByCategory = new Map();
    // Enregistrer un outil
    register(tool) {
        this.validateTool(tool);
        this.tools.set(tool.id, tool);
        // Indexer par catégorie
        if (!this.toolsByCategory.has(tool.category)) {
            this.toolsByCategory.set(tool.category, new Set());
        }
        this.toolsByCategory.get(tool.category).add(tool.id);
        console.log(`✅ Tool registered: ${tool.id} (${tool.category})`);
    }
    // Désenregistrer un outil
    unregister(toolId) {
        const tool = this.tools.get(toolId);
        if (tool) {
            this.tools.delete(toolId);
            this.toolsByCategory.get(tool.category)?.delete(toolId);
            if (this.toolsByCategory.get(tool.category)?.size === 0) {
                this.toolsByCategory.delete(tool.category);
            }
            console.log(`❌ Tool unregistered: ${toolId}`);
        }
    }
    // Obtenir un outil par ID
    get(toolId) {
        return this.tools.get(toolId);
    }
    // Obtenir tous les outils
    getAll() {
        return Array.from(this.tools.values());
    }
    // Obtenir les outils d'une catégorie
    getByCategory(category) {
        const toolIds = this.toolsByCategory.get(category);
        if (!toolIds)
            return [];
        return Array.from(toolIds)
            .map(id => this.tools.get(id))
            .filter((tool) => tool !== undefined);
    }
    // Rechercher des outils avec des filtres
    search(query, filters) {
        let results = Array.from(this.tools.values());
        // Filtrer par requête textuelle
        if (query.trim()) {
            const searchTerm = query.toLowerCase();
            results = results.filter(tool => tool.name.toLowerCase().includes(searchTerm) ||
                tool.description.toLowerCase().includes(searchTerm) ||
                tool.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
        }
        // Appliquer les filtres
        if (filters) {
            if (filters.category) {
                results = results.filter(tool => tool.category === filters.category);
            }
            if (filters.tags && filters.tags.length > 0) {
                results = results.filter(tool => filters.tags.some(tag => tool.tags.includes(tag)));
            }
            if (filters.capabilities) {
                results = results.filter(tool => {
                    const caps = filters.capabilities;
                    return ((!caps.async || tool.capabilities.async === caps.async) &&
                        (!caps.batch || tool.capabilities.batch === caps.batch) &&
                        (!caps.streaming || tool.capabilities.streaming === caps.streaming) &&
                        (!caps.webhook || tool.capabilities.webhook === caps.webhook));
                });
            }
            if (filters.hasRateLimit !== undefined) {
                results = results.filter(tool => filters.hasRateLimit ? !!tool.rateLimit : !tool.rateLimit);
            }
            if (filters.hasCache !== undefined) {
                results = results.filter(tool => filters.hasCache ? !!tool.cache : !tool.cache);
            }
        }
        return results;
    }
    // Vérifier si un outil existe
    exists(toolId) {
        return this.tools.has(toolId);
    }
    // Obtenir les statistiques du registry
    getStats() {
        const tools = Array.from(this.tools.values());
        const stats = {
            totalTools: tools.length,
            toolsByCategory: {},
            toolsWithRateLimit: 0,
            toolsWithCache: 0,
            toolsWithWebhooks: 0,
            asyncTools: 0,
            streamingTools: 0
        };
        tools.forEach(tool => {
            // Par catégorie
            stats.toolsByCategory[tool.category] =
                (stats.toolsByCategory[tool.category] || 0) + 1;
            // Capacités
            if (tool.rateLimit)
                stats.toolsWithRateLimit++;
            if (tool.cache)
                stats.toolsWithCache++;
            if (tool.capabilities.webhook)
                stats.toolsWithWebhooks++;
            if (tool.capabilities.async)
                stats.asyncTools++;
            if (tool.capabilities.streaming)
                stats.streamingTools++;
        });
        return stats;
    }
    // Validation d'un outil avant enregistrement
    validateTool(tool) {
        if (!tool.id || !tool.name) {
            throw new Error('Tool must have id and name');
        }
        if (this.tools.has(tool.id)) {
            throw new Error(`Tool with id '${tool.id}' already exists`);
        }
        if (!tool.category) {
            throw new Error('Tool must have a category');
        }
        if (!['communication', 'productivity', 'development', 'data'].includes(tool.category)) {
            throw new Error(`Invalid category: ${tool.category}`);
        }
        // Validation du schema Zod
        if (!tool.inputSchema) {
            throw new Error('Tool must have an inputSchema');
        }
        // Validation des méthodes
        if (typeof tool.validate !== 'function') {
            throw new Error('Tool must have a validate method');
        }
        if (typeof tool.execute !== 'function') {
            throw new Error('Tool must have an execute method');
        }
    }
    // Charger un plugin
    loadPlugin(plugin) {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin '${plugin.id}' already loaded`);
        }
        // Validation des dépendances
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Missing dependency: ${dep}`);
                }
            }
        }
        // Enregistrer tous les outils du plugin
        plugin.tools.forEach(tool => this.register(tool));
        // Stocker le plugin
        this.plugins.set(plugin.id, plugin);
        console.log(`🔌 Plugin loaded: ${plugin.id} (${plugin.tools.length} tools)`);
    }
    // Décharger un plugin
    unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            // Désenregistrer tous les outils du plugin
            plugin.tools.forEach(tool => this.unregister(tool.id));
            // Supprimer le plugin
            this.plugins.delete(pluginId);
            console.log(`🔌 Plugin unloaded: ${pluginId}`);
        }
    }
    // Obtenir tous les plugins
    getPlugins() {
        return Array.from(this.plugins.values());
    }
    // Exporter la configuration du registry
    exportConfig() {
        return {
            tools: Array.from(this.tools.values()).map(tool => ({
                id: tool.id,
                name: tool.name,
                version: tool.version,
                category: tool.category,
                description: tool.description,
                tags: tool.tags,
                capabilities: tool.capabilities,
                rateLimit: tool.rateLimit,
                cache: tool.cache
            })),
            plugins: Array.from(this.plugins.values()).map(plugin => ({
                id: plugin.id,
                name: plugin.name,
                version: plugin.version,
                tools: plugin.tools.map(t => t.id)
            })),
            stats: this.getStats()
        };
    }
    // Nettoyer le registry
    clear() {
        this.tools.clear();
        this.plugins.clear();
        this.toolsByCategory.clear();
        console.log('🧹 Registry cleared');
    }
}
exports.MCPRegistry = MCPRegistry;
// Instance globale du registry
exports.registry = new MCPRegistry();
//# sourceMappingURL=registry.js.map