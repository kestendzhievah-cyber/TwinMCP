"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
// Interface de base pour tous les outils MCP
class BaseTool {
    // Hooks par défaut (peuvent être surchargés)
    async beforeExecute(args) {
        return args;
    }
    async afterExecute(result) {
        return result;
    }
    async onError(error) {
        console.error(`Error in ${this.name}:`, error);
    }
}
exports.BaseTool = BaseTool;
//# sourceMappingURL=tool-interface.js.map