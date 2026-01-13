"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const server_1 = require("next/server");
const firebase_admin_1 = require("@/lib/firebase-admin");
const agents_1 = require("@/lib/agents");
const user_limits_1 = require("@/lib/user-limits");
async function DELETE(request) {
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
        const url = new URL(request.url);
        const chatbotId = url.searchParams.get('chatbotId');
        if (!chatbotId) {
            return server_1.NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 });
        }
        // Delete the agent
        await (0, agents_1.deleteAgent)(chatbotId);
        // Update user agents count
        const newCount = await (0, user_limits_1.countActiveAgents)(userId);
        await (0, user_limits_1.updateUserAgentsCount)(userId, newCount);
        return server_1.NextResponse.json({
            success: true,
            message: 'Agent supprimé avec succès',
            newCount,
            remainingSlots: newCount > 0 ? 'Vous pouvez maintenant créer un nouvel agent' : 'Aucun agent restant'
        });
    }
    catch (error) {
        console.error('Error deleting chatbot:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map