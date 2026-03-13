import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { updateChatbot } from '@/lib/chatbot';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError();
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;

    const adminAuth = await getFirebaseAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { chatbotId, ...updates } = body;

    if (!chatbotId || typeof chatbotId !== 'string') {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 });
    }

    // SECURITY: Verify ownership before updating
    const { getAgent } = await import('@/lib/agents');
    const agent = await getAgent(chatbotId);
    if (!agent || agent.userId !== userId) {
      return NextResponse.json({ error: 'Chatbot not found or not owned by you' }, { status: 404 });
    }

    // Update the chatbot
    await updateChatbot(chatbotId, updates);

    return NextResponse.json({
      success: true,
      message: 'Chatbot mis Ã  jour avec succès',
    });
  } catch (error) {
    return handleApiError(error, 'UpdateChatbot');
  }
}
