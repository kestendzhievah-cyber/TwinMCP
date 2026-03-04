import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { prisma } from '@/lib/prisma';
import { streamResponse, estimateTokens } from '@/lib/services/llm-gateway.service';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { conversationId, message, options = {} } = body;

    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: conversationId, message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Persist the user message
    try {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
        },
      });
    } catch (e) {
      logger.warn('Failed to persist user message:', e);
    }

    const startTime = Date.now();
    let fullContent = '';
    let provider = 'simulation';
    let model = 'none';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse(message, options)) {
            if (chunk.content) {
              fullContent += chunk.content;
            }
            if (chunk.metadata?.provider) {
              provider = chunk.metadata.provider;
            }
            if (chunk.metadata?.model) {
              model = chunk.metadata.model;
            }

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

          // Persist assistant message and track usage (fire-and-forget)
          const latencyMs = Date.now() - startTime;
          const estimatedTokens = estimateTokens(fullContent);

          Promise.all([
            prisma.message.create({
              data: {
                conversationId,
                role: 'assistant',
                content: fullContent,
              },
            }),
            prisma.usageLog.create({
              data: {
                userId,
                toolName: `chat/stream:${provider}:${model}`,
                tokensReturned: estimatedTokens,
                responseTimeMs: latencyMs,
                success: fullContent.length > 0,
              },
            }),
            prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            }),
          ]).catch(e => logger.warn('Failed to persist stream results:', e));
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('Error in stream:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
