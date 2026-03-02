import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { updateChatbot } from '@/lib/chatbot';

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { chatbotId, ...updates } = body;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      );
    }

    // Update the chatbot
    await updateChatbot(chatbotId, updates);

    return NextResponse.json({
      success: true,
      message: 'Chatbot mis Ã  jour avec succÃ¨s'
    });
  } catch (error) {
    logger.error('Error updating chatbot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
