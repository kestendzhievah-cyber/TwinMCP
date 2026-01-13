"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const init_1 = require("../lib/mcp/init");
// Setup global pour les tests
beforeAll(async () => {
    await (0, init_1.initializeMCP)();
});
afterAll(async () => {
    // Cleanup après tous les tests
});
//# sourceMappingURL=setup.js.map