import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

// Generate response using real LLM provider when available, mock otherwise
async function generateResponse(message: string, options: any) {
  const startTime = Date.now();

  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: message }
          ],
          max_tokens: options.maxTokens || 1024,
          temperature: options.temperature ?? 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const choice = data.choices?.[0];
        return {
          content: choice?.message?.content || 'No response generated',
          metadata: {
            provider: 'openai',
            model: data.model,
            tokens: data.usage?.total_tokens || 0,
            latency: Date.now() - startTime,
            cost: (data.usage?.total_tokens || 0) * 0.000002,
          }
        };
      }
    } catch (error) {
      logger.warn('OpenAI call failed, falling back to mock:', error);
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
          model: options.model || 'claude-3-haiku-20240307',
          max_tokens: options.maxTokens || 1024,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.content?.[0]?.text || 'No response generated',
          metadata: {
            provider: 'anthropic',
            model: data.model,
            tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            latency: Date.now() - startTime,
            cost: 0,
          }
        };
      }
    } catch (error) {
      logger.warn('Anthropic call failed, falling back to mock:', error);
    }
  }

  // Fallback: mock response (development mode)
  return {
    content: `[Mode simulation] RÃ©ponse Ã : "${message.substring(0, 100)}". Configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour des rÃ©ponses rÃ©elles.`,
    metadata: {
      provider: 'mock',
      model: 'simulation',
      tokens: 0,
      latency: Date.now() - startTime,
      cost: 0,
    }
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, message, options = {} } = body;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // GÃ©nÃ©rer la rÃ©ponse
    const response = await generateResponse(message, options);

    return NextResponse.json({
      id: crypto.randomUUID(),
      content: response.content,
      metadata: response.metadata
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
