import { NextRequest } from 'next/server';

// Mock LLM streaming service
async function* streamResponse(message: string, options: any) {
  const responses = [
    "Je comprends votre question. ",
    "Voici ma réponse détaillée... ",
    "Permettez-moi de développer ce point. ",
    "C'est important de noter que... ",
    "En conclusion, je dirais que..."
  ];
  
  for (const part of responses) {
    yield {
      content: part,
      metadata: {
        tokens: part.split(' ').length,
        model: 'gpt-3.5-turbo'
      }
    };
    
    // Simuler un délai de streaming
    await new Promise(resolve => setTimeout(resolve, 300));
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
    console.error('Error in stream:', error);
    return new Response('Stream error', { status: 500 });
  }
}
