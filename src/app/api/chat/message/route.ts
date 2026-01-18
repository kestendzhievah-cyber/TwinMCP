import { NextRequest, NextResponse } from 'next/server';

// Mock LLM service - remplacer avec un vrai service
async function generateResponse(message: string, options: any) {
  // Simuler un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const responses = [
    "Je comprends votre question. Voici ma réponse...",
    "C'est une excellente question! Permettez-moi de vous aider...",
    "Voici ce que je peux vous dire à ce sujet...",
    "Intéressant! Voici mes pensées sur ce sujet..."
  ];
  
  return {
    content: responses[Math.floor(Math.random() * responses.length)],
    metadata: {
      tokens: Math.floor(Math.random() * 100) + 50,
      latency: Math.floor(Math.random() * 500) + 200,
      cost: Math.random() * 0.01
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

    // Générer la réponse
    const response = await generateResponse(message, options);

    return NextResponse.json({
      id: crypto.randomUUID(),
      content: response.content,
      metadata: response.metadata
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
