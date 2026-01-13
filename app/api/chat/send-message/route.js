"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const chatbot_1 = require("@/lib/chatbot");
const conversation_1 = require("@/lib/conversation");
async function POST(request) {
    try {
        const body = await request.json();
        // Validate required fields
        if (!body.chatbotId || !body.message || !body.visitorId) {
            return server_1.NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        // Get chatbot configuration
        const chatbot = await (0, chatbot_1.getChatbot)(body.chatbotId);
        if (!chatbot || chatbot.status !== 'active') {
            return server_1.NextResponse.json({ error: 'Chatbot not found or inactive' }, { status: 404 });
        }
        // Create conversation (simplified for now)
        const conversationId = body.conversationId ||
            await (0, conversation_1.createConversation)(body.chatbotId, body.visitorId);
        // Add user message to conversation
        await (0, conversation_1.addMessageToConversation)(conversationId, {
            role: 'user',
            content: body.message,
        });
        // TODO: Integrate with AI service to generate response
        // For now, return a placeholder response
        const aiResponse = await generateAIResponse(body.message, chatbot);
        // Add AI response to conversation
        await (0, conversation_1.addMessageToConversation)(conversationId, {
            role: 'assistant',
            content: aiResponse,
        });
        const response = {
            reply: aiResponse,
            conversationId,
        };
        return server_1.NextResponse.json(response);
    }
    catch (error) {
        console.error('Error sending message:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// Placeholder AI response generation - replace with actual AI integration
async function generateAIResponse(message, chatbot) {
    // This is a placeholder - in a real implementation, you would:
    // 1. Call your AI service (OpenAI, Claude, Gemini, etc.)
    // 2. Use the chatbot's system prompt and model configuration
    // 3. Return the AI-generated response
    return `Merci pour votre message: "${message}". Je suis ${chatbot.name}, votre assistant IA. Comment puis-je vous aider davantage ?`;
}
//# sourceMappingURL=route.js.map