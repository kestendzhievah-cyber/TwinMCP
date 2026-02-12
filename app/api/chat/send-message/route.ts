import { NextRequest, NextResponse } from 'next/server';
import { getChatbot } from '@/lib/chatbot';
import { createConversation, addMessageToConversation } from '@/lib/conversation';

interface SendMessageRequest {
  chatbotId: string;
  message: string;
  conversationId?: string;
  visitorId: string;
}

interface SendMessageResponse {
  reply: string;
  conversationId: string;
  messageId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();

    // Validate required fields
    if (!body.chatbotId || !body.message || !body.visitorId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get chatbot configuration
    const chatbot = await getChatbot(body.chatbotId);

    if (!chatbot || chatbot.status !== 'active') {
      return NextResponse.json(
        { error: 'Chatbot not found or inactive' },
        { status: 404 }
      );
    }

    // Create conversation (simplified for now)
    const conversationId = body.conversationId ||
      await createConversation(body.chatbotId, body.visitorId);

    // Add user message to conversation
    await addMessageToConversation(conversationId, {
      role: 'user',
      content: body.message,
    });

    // TODO: Integrate with AI service to generate response
    // For now, return a placeholder response
    const aiResponse = await generateAIResponse(body.message, chatbot);

    // Add AI response to conversation
    await addMessageToConversation(conversationId, {
      role: 'assistant',
      content: aiResponse,
    });

    const response: SendMessageResponse = {
      reply: aiResponse,
      conversationId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Placeholder AI response generation - replace with actual AI integration
async function generateAIResponse(message: string, chatbot: any): Promise<string> {
  // This is a placeholder - in a real implementation, you would:
  // 1. Call your AI service (OpenAI, Claude, Gemini, etc.)
  // 2. Use the chatbot's system prompt and model configuration
  // 3. Return the AI-generated response

  return `Merci pour votre message: "${message}". Je suis ${chatbot.name}, votre assistant IA. Comment puis-je vous aider davantage ?`;
}
