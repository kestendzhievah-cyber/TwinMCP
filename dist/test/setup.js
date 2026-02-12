"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Configuration globale pour les tests
require("jest-extended");
// Mock console methods pour les tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Timeout étendu pour les tests asynchrones
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map