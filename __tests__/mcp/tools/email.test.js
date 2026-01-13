"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const email_1 = require("../../../lib/mcp/tools/communication/email");
(0, globals_1.describe)('EmailTool', () => {
    let emailTool;
    (0, globals_1.beforeAll)(() => {
        emailTool = new email_1.EmailTool();
    });
    (0, globals_1.describe)('Validation', () => {
        (0, globals_1.it)('should validate correct email arguments', async () => {
            const args = {
                to: 'test@example.com',
                subject: 'Test Subject',
                body: 'Test body content'
            };
            const result = await emailTool.validate(args);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data).toEqual(args);
        });
        (0, globals_1.it)('should reject invalid email format', async () => {
            const args = {
                to: 'invalid-email',
                subject: 'Test Subject',
                body: 'Test body content'
            };
            const result = await emailTool.validate(args);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors?.some(e => e.message.includes('Invalid email format'))).toBe(true);
        });
        (0, globals_1.it)('should reject missing required fields', async () => {
            const args = {
                to: 'test@example.com'
                // missing subject and body
            };
            const result = await emailTool.validate(args);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors?.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should accept optional fields', async () => {
            const args = {
                to: 'test@example.com',
                subject: 'Test Subject',
                body: 'Test body content',
                cc: ['cc@example.com'],
                attachments: [{
                        filename: 'test.txt',
                        content: 'base64content',
                        type: 'text/plain'
                    }]
            };
            const result = await emailTool.validate(args);
            (0, globals_1.expect)(result.success).toBe(true);
        });
    });
    (0, globals_1.describe)('Execution', () => {
        (0, globals_1.it)('should execute successfully with valid args', async () => {
            const args = {
                to: 'test@example.com',
                subject: 'Test Subject',
                body: 'Test body content'
            };
            const config = {
                userId: 'test-user',
                permissions: [],
                rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
            };
            const result = await emailTool.execute(args, config);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data?.messageId).toBeDefined();
            (0, globals_1.expect)(result.data?.to).toBe(args.to);
            (0, globals_1.expect)(result.metadata?.executionTime).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should handle rate limiting', async () => {
            const args = {
                to: 'test@example.com',
                subject: 'Test Subject',
                body: 'Test body content'
            };
            const config = {
                userId: 'rate-limited-user',
                permissions: [],
                rateLimit: { requests: 0, period: '1h', strategy: 'sliding' }
            };
            const result = await emailTool.execute(args, config);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toContain('Rate limit exceeded');
        });
    });
    (0, globals_1.describe)('Caching', () => {
        (0, globals_1.it)('should use cache for identical requests', async () => {
            const args = {
                to: 'cache-test@example.com',
                subject: 'Cache Test',
                body: 'Cache test content'
            };
            const config = {
                userId: 'cache-user',
                permissions: [],
                rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
            };
            // First execution
            const result1 = await emailTool.execute(args, config);
            (0, globals_1.expect)(result1.success).toBe(true);
            // Second execution (should use cache)
            const result2 = await emailTool.execute(args, config);
            (0, globals_1.expect)(result2.success).toBe(true);
            (0, globals_1.expect)(result2.metadata?.cacheHit).toBe(true);
        });
    });
    (0, globals_1.describe)('Hooks', () => {
        (0, globals_1.it)('should execute before and after hooks', async () => {
            const args = {
                to: 'hook-test@example.com',
                subject: 'Hook Test',
                body: 'Hook test content'
            };
            const config = {
                userId: 'hook-user',
                permissions: [],
                rateLimit: { requests: 100, period: '1h', strategy: 'sliding' }
            };
            const consoleSpy = globals_1.jest.spyOn(console, 'log').mockImplementation(() => undefined);
            await emailTool.execute(args, config);
            (0, globals_1.expect)(consoleSpy).toHaveBeenCalledWith(globals_1.expect.stringContaining('📧 Preparing to send email'));
            (0, globals_1.expect)(consoleSpy).toHaveBeenCalledWith(globals_1.expect.stringContaining('✅ Email sent successfully'));
            consoleSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=email.test.js.map