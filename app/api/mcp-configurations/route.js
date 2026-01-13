"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const firebase_admin_1 = require("@/lib/firebase-admin");
// Fonction helper pour vérifier le token d'authentification
async function getAuthenticatedUserId(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Token d\'authentification manquant ou invalide');
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        return decodedToken.uid;
    }
    catch (error) {
        throw new Error('Token invalide');
    }
}
// GET /api/mcp-configurations - Récupérer toutes les configurations de l'utilisateur
async function GET(request) {
    try {
        const userId = await getAuthenticatedUserId(request);
        // Temporairement retourner des configurations mockées
        // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
        const configurations = [
            {
                id: '1',
                name: 'Configuration Test 1',
                description: 'Première configuration MCP',
                configData: '{"test": "data"}',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                product: { name: 'Produit Test' }
            },
            {
                id: '2',
                name: 'Configuration Test 2',
                description: 'Deuxième configuration MCP',
                configData: '{"test": "data2"}',
                status: 'INACTIVE',
                createdAt: new Date().toISOString(),
                product: { name: 'Produit Test 2' }
            }
        ];
        return server_1.NextResponse.json(configurations);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des configurations:', error);
        if (error instanceof Error && error.message.includes('Token')) {
            return server_1.NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
// POST /api/mcp-configurations - Créer une nouvelle configuration
async function POST(request) {
    try {
        const userId = await getAuthenticatedUserId(request);
        const body = await request.json();
        const { name, description, configData, productId } = body;
        if (!name || !configData) {
            return server_1.NextResponse.json({ error: 'Nom et données de configuration requis' }, { status: 400 });
        }
        // Temporairement retourner une configuration créée mockée
        // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
        const configuration = {
            id: Date.now().toString(),
            name,
            description,
            configData,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            product: { name: 'Produit Test' }
        };
        return server_1.NextResponse.json(configuration, { status: 201 });
    }
    catch (error) {
        console.error('Erreur lors de la création de la configuration:', error);
        if (error instanceof Error && error.message.includes('Token')) {
            return server_1.NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map