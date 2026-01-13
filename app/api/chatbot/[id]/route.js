"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PUT = PUT;
const server_1 = require("next/server");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("@/lib/firebase/admin");
// Initialisation de Firebase Admin
try {
    (0, admin_1.getFirebaseAdminApp)();
}
catch (error) {
    console.error('Firebase Admin initialization error', error);
}
const db = (0, firestore_1.getFirestore)();
// GET /api/chatbot/[id]
async function GET(request, { params }) {
    try {
        const { id } = params;
        if (!id) {
            return server_1.NextResponse.json({ error: 'ID du chatbot manquant' }, { status: 400 });
        }
        const docRef = db.collection('chatbots').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return server_1.NextResponse.json({ error: 'Chatbot non trouvé' }, { status: 404 });
        }
        const data = doc.data();
        // Formater les données pour correspondre à l'interface Chatbot
        const chatbot = {
            id: doc.id,
            name: data?.name || '',
            description: data?.description || '',
            model: data?.model || 'gpt-3.5-turbo',
            systemPrompt: data?.systemPrompt || '',
            temperature: data?.temperature ?? 0.7,
            maxTokens: data?.maxTokens ?? 1000,
            isActive: data?.isActive ?? true,
            conversationsCount: data?.conversationsCount ?? 0,
            createdAt: data?.createdAt?.toDate()?.toISOString(),
            updatedAt: data?.updatedAt?.toDate()?.toISOString(),
        };
        return server_1.NextResponse.json(chatbot);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du chatbot:', error);
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
// PUT /api/chatbot/[id]
async function PUT(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();
        if (!id) {
            return server_1.NextResponse.json({ error: 'ID du chatbot manquant' }, { status: 400 });
        }
        // Validation des données
        const updateData = {};
        if (body.name !== undefined)
            updateData.name = body.name;
        if (body.description !== undefined)
            updateData.description = body.description;
        if (body.model !== undefined)
            updateData.model = body.model;
        if (body.systemPrompt !== undefined)
            updateData.systemPrompt = body.systemPrompt;
        if (body.temperature !== undefined)
            updateData.temperature = parseFloat(body.temperature);
        if (body.maxTokens !== undefined)
            updateData.maxTokens = parseInt(body.maxTokens, 10);
        if (body.isActive !== undefined)
            updateData.isActive = Boolean(body.isActive);
        // Ajout de la date de mise à jour
        updateData.updatedAt = new Date();
        const docRef = db.collection('chatbots').doc(id);
        // Vérifier si le document existe
        const doc = await docRef.get();
        if (!doc.exists) {
            return server_1.NextResponse.json({ error: 'Chatbot non trouvé' }, { status: 404 });
        }
        // Mise à jour du document
        await docRef.update(updateData);
        // Récupérer le document mis à jour
        const updatedDoc = await docRef.get();
        const updatedData = updatedDoc.data();
        const updatedChatbot = {
            id: updatedDoc.id,
            name: updatedData?.name || '',
            description: updatedData?.description || '',
            model: updatedData?.model || 'gpt-3.5-turbo',
            systemPrompt: updatedData?.systemPrompt || '',
            temperature: updatedData?.temperature ?? 0.7,
            maxTokens: updatedData?.maxTokens ?? 1000,
            isActive: updatedData?.isActive ?? true,
            conversationsCount: updatedData?.conversationsCount ?? 0,
            createdAt: updatedData?.createdAt?.toDate()?.toISOString(),
            updatedAt: updatedData?.updatedAt?.toDate()?.toISOString(),
        };
        return server_1.NextResponse.json(updatedChatbot);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du chatbot:', error);
        return server_1.NextResponse.json({ error: 'Erreur lors de la mise à jour du chatbot' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map