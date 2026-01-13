"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const conversation_1 = require("@/lib/conversation");
async function GET(request) {
    try {
        const url = new URL(request.url);
        const conversationId = url.searchParams.get('conversationId');
        if (!conversationId) {
            return server_1.NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
        }
        const conversation = await (0, conversation_1.getConversationHistory)(conversationId);
        if (!conversation) {
            return server_1.NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }
        return server_1.NextResponse.json({
            success: true,
            conversation,
        });
    }
    catch (error) {
        console.error('Error getting conversation history:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map