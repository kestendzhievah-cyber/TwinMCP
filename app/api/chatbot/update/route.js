"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = PUT;
const server_1 = require("next/server");
const firebase_admin_1 = require("@/lib/firebase-admin");
const chatbot_1 = require("@/lib/chatbot");
async function PUT(request) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        }
        catch (error) {
            return server_1.NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const body = await request.json();
        const { chatbotId, ...updates } = body;
        if (!chatbotId) {
            return server_1.NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 });
        }
        // Update the chatbot
        await (0, chatbot_1.updateChatbot)(chatbotId, updates);
        return server_1.NextResponse.json({
            success: true,
            message: 'Chatbot mis à jour avec succès'
        });
    }
    catch (error) {
        console.error('Error updating chatbot:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map