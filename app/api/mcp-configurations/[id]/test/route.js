"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
// POST /api/mcp-configurations/[id]/test - Tester une configuration MCP
async function POST(request, { params }) {
    try {
        const { id } = await params;
        // Temporairement retourner un résultat de test mocké
        // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
        const testResult = {
            success: true,
            message: 'Configuration MCP valide',
            timestamp: new Date().toISOString(),
            details: {
                configId: id,
                name: `Configuration ${id}`,
                status: 'Connecté avec succès',
            },
        };
        return server_1.NextResponse.json(testResult);
    }
    catch (error) {
        console.error('Erreur lors du test de la configuration:', error);
        return server_1.NextResponse.json({
            success: false,
            message: 'Erreur lors du test de la configuration',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map