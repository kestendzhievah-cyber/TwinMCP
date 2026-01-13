"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressApp = void 0;
const express_1 = __importDefault(require("express"));
// Créer une instance Express pour les API personnalisées
const app = (0, express_1.default)();
exports.expressApp = app;
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes d'exemple
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'AgentFlow API is running',
        timestamp: new Date().toISOString()
    });
});
app.get('/api/agents/status', (req, res) => {
    res.json({
        agents: [
            { id: 1, name: 'Support Agent', status: 'active' },
            { id: 2, name: 'Sales Agent', status: 'active' },
            { id: 3, name: 'Analytics Agent', status: 'idle' }
        ],
        total: 3
    });
});
app.post('/api/agents/create', (req, res) => {
    const { name, type, model } = req.body;
    if (!name || !type) {
        return res.status(400).json({
            error: 'Name and type are required'
        });
    }
    res.json({
        success: true,
        agent: {
            id: Date.now(),
            name,
            type,
            model: model || 'gpt-4',
            status: 'creating',
            createdAt: new Date().toISOString()
        }
    });
});
// Export pour utilisation dans Next.js
exports.default = app;
//# sourceMappingURL=express-server.js.map