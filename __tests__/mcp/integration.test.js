"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const init_1 = require("../../lib/mcp/init");
const createMockRequest = (url, options = {}) => {
    return {
        url,
        headers: new Map(Object.entries(options.headers || {})),
        body: options.body,
        method: options.method || 'GET'
    };
};
(0, globals_1.describe)('MCP API Integration', () => {
    (0, globals_1.beforeAll)(async () => {
        await (0, init_1.initializeMCP)();
    });
    (0, globals_1.afterAll)(async () => {
        // Cleanup if needed
    });
    (0, globals_1.describe)('Tools API', () => {
        (0, globals_1.it)('should list all available tools', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/tools');
            const response = await fetch(request.url);
            const data = await response.json();
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(data.tools).toBeDefined();
            (0, globals_1.expect)(Array.isArray(data.tools)).toBe(true);
            (0, globals_1.expect)(data.totalCount).toBeGreaterThan(0);
            (0, globals_1.expect)(data.apiVersion).toBe('v1');
        });
        (0, globals_1.it)('should execute email tool', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args: {
                        to: 'test@example.com',
                        subject: 'Test Email',
                        body: 'This is a test email'
                    }
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            const data = await response.json();
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(data.success).toBe(true);
            (0, globals_1.expect)(data.result).toBeDefined();
            (0, globals_1.expect)(data.result.messageId).toBeDefined();
            (0, globals_1.expect)(data.apiVersion).toBe('v1');
        });
        (0, globals_1.it)('should validate email arguments', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args: {
                        to: 'invalid-email',
                        subject: 'Test Email'
                        // missing body
                    }
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            (0, globals_1.expect)(response.status).toBe(400);
            const data = await response.json();
            (0, globals_1.expect)(data.error).toContain('Validation failed');
        });
        (0, globals_1.it)('should enforce rate limiting', async () => {
            const requests = [];
            // Make multiple rapid requests
            for (let i = 0; i < 5; i++) {
                const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': 'mcp-default-key-12345'
                    },
                    body: JSON.stringify({
                        toolId: 'email',
                        args: {
                            to: 'ratelimit@example.com',
                            subject: `Rate Limit Test ${i}`,
                            body: 'Rate limit test email'
                        }
                    })
                });
                requests.push(fetch(request.url, {
                    method: 'POST',
                    headers: Object.fromEntries(request.headers),
                    body: request.body
                }));
            }
            const responses = await Promise.all(requests);
            const rateLimited = responses.some(r => r.status === 429);
            // At least one should be rate limited (depending on implementation)
            (0, globals_1.expect)(rateLimited).toBe(true);
        });
    });
    (0, globals_1.describe)('Health Check', () => {
        (0, globals_1.it)('should return healthy status', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/health');
            const response = await fetch(request.url);
            const data = await response.json();
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(data.status).toBe('healthy');
            (0, globals_1.expect)(data.apiVersion).toBe('v1');
            (0, globals_1.expect)(data.services.registry.status).toBe('healthy');
            (0, globals_1.expect)(data.services.queue.status).toBe('healthy');
        });
    });
    (0, globals_1.describe)('Authentication', () => {
        (0, globals_1.it)('should require authentication for protected endpoints', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args: {
                        to: 'test@example.com',
                        subject: 'Test',
                        body: 'Test'
                    }
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            (0, globals_1.expect)(response.status).toBe(401);
        });
        (0, globals_1.it)('should accept valid API key', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args: {
                        to: 'test@example.com',
                        subject: 'Test',
                        body: 'Test'
                    }
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            (0, globals_1.expect)(response.status).toBe(200);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle unknown tool', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'unknown-tool',
                    args: {}
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            (0, globals_1.expect)(response.status).toBe(404);
            const data = await response.json();
            (0, globals_1.expect)(data.error).toContain('not found');
        });
        (0, globals_1.it)('should handle missing required arguments', async () => {
            const request = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args: {
                        to: 'test@example.com'
                        // missing subject and body
                    }
                })
            });
            const response = await fetch(request.url, {
                method: 'POST',
                headers: Object.fromEntries(request.headers),
                body: request.body
            });
            (0, globals_1.expect)(response.status).toBe(400);
            const data = await response.json();
            (0, globals_1.expect)(data.error).toContain('Validation failed');
        });
    });
    (0, globals_1.describe)('Caching', () => {
        (0, globals_1.it)('should cache identical requests', async () => {
            const args = {
                to: 'cache-test@example.com',
                subject: 'Cache Test',
                body: 'Cache test content'
            };
            // First request
            const request1 = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args
                })
            });
            const response1 = await fetch(request1.url, {
                method: 'POST',
                headers: Object.fromEntries(request1.headers),
                body: request1.body
            });
            (0, globals_1.expect)(response1.status).toBe(200);
            const data1 = await response1.json();
            (0, globals_1.expect)(data1.metadata.cacheHit).toBe(false);
            // Second request (should be cached)
            const request2 = createMockRequest('http://localhost:3000/api/v1/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'mcp-default-key-12345'
                },
                body: JSON.stringify({
                    toolId: 'email',
                    args
                })
            });
            const response2 = await fetch(request2.url, {
                method: 'POST',
                headers: Object.fromEntries(request2.headers),
                body: request2.body
            });
            (0, globals_1.expect)(response2.status).toBe(200);
            const data2 = await response2.json();
            (0, globals_1.expect)(data2.metadata.cacheHit).toBe(true);
        });
    });
});
//# sourceMappingURL=integration.test.js.map