"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
// Configuration pour ES modules
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'AgentFlow Express Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.get('/api/agents', (req, res) => {
    res.json({
        agents: [
            {
                id: 1,
                name: 'Support Agent',
                status: 'active',
                model: 'gpt-4',
                conversations: 1250
            },
            {
                id: 2,
                name: 'Sales Agent',
                status: 'active',
                model: 'claude-3',
                conversations: 890
            }
        ],
        total: 2
    });
});
app.post('/api/agents', (req, res) => {
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
            status: 'created',
            createdAt: new Date().toISOString()
        }
    });
});
// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 AgentFlow Express Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Agents API: http://localhost:${PORT}/api/agents`);
});
//# sourceMappingURL=server.js.map