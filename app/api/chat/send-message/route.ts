import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getChatbot } from '@/lib/chatbot';
import { createConversation, addMessageToConversation } from '@/lib/conversation';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { sendChatMessageSchema, parseBody } from '@/lib/validations/api-schemas';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

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

const MAX_MESSAGE_LENGTH = 10000;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication — this endpoint calls paid LLM APIs
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(sendChatMessageSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const body = parsed.data;

    // Get chatbot configuration
    const chatbot = await getChatbot(body.chatbotId);

    if (chatbot?.status !== 'active') {
      return NextResponse.json({ error: 'Chatbot not found or inactive' }, { status: 404 });
    }

    // Create conversation (simplified for now)
    const visitorId = body.visitorId || userId;
    const conversationId =
      body.conversationId || (await createConversation(body.chatbotId, visitorId));

    // Add user message to conversation
    await addMessageToConversation(conversationId, {
      role: 'user',
      content: body.message,
    });

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
    return handleApiError(error, 'SendChatMessage');
  }
}

// Generate AI response using real LLM provider when available, simulation fallback
async function generateAIResponse(message: string, chatbot: any): Promise<string> {
  const systemPrompt = chatbot.systemPrompt || `Tu es ${chatbot.name}, un assistant IA utile.`;
  const model = chatbot.model || 'gpt-3.5-turbo';
  const temperature = chatbot.temperature ?? 0.7;
  const maxTokens = chatbot.maxTokens || 1024;

  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response generated';
      }
    } catch (error) {
      logger.warn('OpenAI call failed, trying fallback:', error);
    }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.startsWith('claude') ? model : 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content?.[0]?.text || 'No response generated';
      }
    } catch (error) {
      logger.warn('Anthropic call failed, trying fallback:', error);
    }
  }

  // Fallback: simulation mode
  return `[Mode simulation] Je suis ${chatbot.name}. Réponse à : "${message.substring(0, 100)}". Configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour des réponses réelles.`;
}
