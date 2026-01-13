"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// Configuration centralisée
exports.config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    // TODO: Ajouter les autres configurations
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map