import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server';

// Stream response using real LLM provider when available, simulation fallback
async function* streamResponse(message: string, options: any): AsyncGenerator<{ content?: string; done?: boolean; metadata?: any }> {
  const systemPrompt = options.systemPrompt || 'You are a helpful assistant.';

  // Try OpenAI streaming
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: options.maxTokens || 1024,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              yield { done: true };
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                yield { content: delta, metadata: { provider: 'openai', model: parsed.model } };
              }
            } catch { /* skip malformed chunk */ }
          }
        }
        yield { done: true };
        return;
      }
    } catch (error) {
      logger.warn('OpenAI streaming failed, trying fallback:', error);
    }
  }

  // Try Anthropic streaming
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
          system: systemPrompt,
          stream: true,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { content: parsed.delta.text, metadata: { provider: 'anthropic', model: options.model || 'claude-3-haiku-20240307' } };
              }
              if (parsed.type === 'message_stop') {
                yield { done: true };
                return;
              }
            } catch { /* skip malformed chunk */ }
          }
        }
        yield { done: true };
        return;
      }
    } catch (error) {
      logger.warn('Anthropic streaming failed, trying fallback:', error);
    }
  }

  // Fallback: simulation mode (no API key configured)
  const simParts = [
    `[Mode simulation] RÃ©ponse Ã : "${message.substring(0, 80)}". `,
    'Configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour des rÃ©ponses rÃ©elles. ',
  ];
  for (const part of simParts) {
    yield { content: part, metadata: { provider: 'simulation', model: 'none' } };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  yield { done: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, message, options = {} } = body;

    if (!conversationId || !message) {
      return new Response('Missing required fields', { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse(message, options)) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
            
            if (chunk.done) {
              break;
            }
          }
        } catch (error) {
          const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('Error in stream:', error);
    return new Response('Stream error', { status: 500 });
  }
}
