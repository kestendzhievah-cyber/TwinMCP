import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { deleteAgent } from '@/lib/agents';
import { updateUserAgentsCount, countActiveAgents } from '@/lib/user-limits';

export async function DELETE(request: NextRequest) {
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

    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const url = new URL(request.url);
    const chatbotId = url.searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      );
    }

    // Delete the agent
    await deleteAgent(chatbotId);

    // Update user agents count
    const newCount = await countActiveAgents(userId);
    await updateUserAgentsCount(userId, newCount);

    return NextResponse.json({
      success: true,
      message: 'Agent supprimÃ© avec succÃ¨s',
      newCount,
      remainingSlots: newCount > 0 ? 'Vous pouvez maintenant crÃ©er un nouvel agent' : 'Aucun agent restant'
    });
  } catch (error) {
    logger.error('Error deleting chatbot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
