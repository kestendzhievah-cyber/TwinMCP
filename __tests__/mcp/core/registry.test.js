"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const registry_1 = require("../../../lib/mcp/core/registry");
const email_1 = require("../../../lib/mcp/tools/communication/email");
const slack_1 = require("../../../lib/mcp/tools/communication/slack");
(0, globals_1.describe)('MCP Registry', () => {
    (0, globals_1.beforeEach)(() => {
        registry_1.registry.clear();
    });
    (0, globals_1.afterEach)(() => {
        registry_1.registry.clear();
    });
    (0, globals_1.describe)('Tool Registration', () => {
        (0, globals_1.it)('should register a tool successfully', () => {
            const emailTool = new email_1.EmailTool();
            registry_1.registry.register(emailTool);
            (0, globals_1.expect)(registry_1.registry.exists('email')).toBe(true);
            (0, globals_1.expect)(registry_1.registry.get('email')).toBe(emailTool);
        });
        (0, globals_1.it)('should unregister a tool', () => {
            const emailTool = new email_1.EmailTool();
            registry_1.registry.register(emailTool);
            (0, globals_1.expect)(registry_1.registry.exists('email')).toBe(true);
            registry_1.registry.unregister('email');
            (0, globals_1.expect)(registry_1.registry.exists('email')).toBe(false);
        });
        (0, globals_1.it)('should prevent duplicate registration', () => {
            const emailTool1 = new email_1.EmailTool();
            const emailTool2 = new email_1.EmailTool();
            registry_1.registry.register(emailTool1);
            (0, globals_1.expect)(() => {
                registry_1.registry.register(emailTool2);
            }).toThrow('Tool with id \'email\' already exists');
        });
        (0, globals_1.it)('should validate tool before registration', () => {
            const invalidTool = {
                id: 'invalid',
                name: '',
                version: '1.0.0',
                category: 'communication',
                description: 'Invalid tool',
                author: 'Test',
                tags: ['test'],
                requiredConfig: ['test'],
                optionalConfig: [],
                inputSchema: {},
                validate: () => Promise.resolve({ success: true }),
                execute: () => Promise.resolve({ success: true }),
                capabilities: {
                    async: false,
                    batch: false,
                    streaming: false,
                    webhook: false
                }
            };
            (0, globals_1.expect)(() => {
                registry_1.registry.register(invalidTool);
            }).toThrow();
        });
    });
    (0, globals_1.describe)('Tool Search', () => {
        (0, globals_1.beforeEach)(() => {
            registry_1.registry.register(new email_1.EmailTool());
            registry_1.registry.register(new slack_1.SlackTool());
        });
        (0, globals_1.it)('should find tools by category', () => {
            const communicationTools = registry_1.registry.getByCategory('communication');
            (0, globals_1.expect)(communicationTools.length).toBe(2);
            (0, globals_1.expect)(communicationTools.every(t => t.category === 'communication')).toBe(true);
        });
        (0, globals_1.it)('should search tools by query', () => {
            const results = registry_1.registry.search('email');
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            (0, globals_1.expect)(results.some(t => t.id === 'email')).toBe(true);
        });
        (0, globals_1.it)('should filter tools by capabilities', () => {
            const asyncTools = registry_1.registry.search('', {
                capabilities: { async: true }
            });
            (0, globals_1.expect)(asyncTools.every(t => t.capabilities.async)).toBe(true);
        });
        (0, globals_1.it)('should filter tools by rate limit', () => {
            const rateLimitedTools = registry_1.registry.search('', {
                hasRateLimit: true
            });
            (0, globals_1.expect)(rateLimitedTools.every(t => !!t.rateLimit)).toBe(true);
        });
    });
    (0, globals_1.describe)('Statistics', () => {
        (0, globals_1.beforeEach)(() => {
            registry_1.registry.register(new email_1.EmailTool());
            registry_1.registry.register(new slack_1.SlackTool());
        });
        (0, globals_1.it)('should provide accurate statistics', () => {
            const stats = registry_1.registry.getStats();
            (0, globals_1.expect)(stats.totalTools).toBe(2);
            (0, globals_1.expect)(stats.toolsByCategory.communication).toBe(2);
            (0, globals_1.expect)(stats.toolsWithRateLimit).toBe(2);
            (0, globals_1.expect)(stats.toolsWithCache).toBe(2);
            (0, globals_1.expect)(stats.asyncTools).toBe(0);
        });
    });
    (0, globals_1.describe)('Plugin System', () => {
        (0, globals_1.it)('should load plugin tools', () => {
            const mockPlugin = {
                id: 'test-plugin',
                name: 'Test Plugin',
                version: '1.0.0',
                description: 'Test plugin',
                tools: [new email_1.EmailTool()],
                dependencies: [],
                config: {}
            };
            registry_1.registry.loadPlugin(mockPlugin);
            (0, globals_1.expect)(registry_1.registry.exists('email')).toBe(true);
            (0, globals_1.expect)(registry_1.registry.getPlugins().length).toBe(1);
        });
        (0, globals_1.it)('should handle plugin dependencies', () => {
            const plugin1 = {
                id: 'plugin1',
                name: 'Plugin 1',
                version: '1.0.0',
                description: 'First plugin',
                tools: [],
                dependencies: [],
                config: {}
            };
            const plugin2 = {
                id: 'plugin2',
                name: 'Plugin 2',
                version: '1.0.0',
                description: 'Second plugin',
                tools: [new email_1.EmailTool()],
                dependencies: ['plugin1'],
                config: {}
            };
            registry_1.registry.loadPlugin(plugin1);
            (0, globals_1.expect)(() => {
                registry_1.registry.loadPlugin(plugin2);
            }).not.toThrow();
            (0, globals_1.expect)(registry_1.registry.exists('email')).toBe(true);
        });
    });
});
//# sourceMappingURL=registry.test.js.map