import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { deleteAgent } from '@/lib/agents';
import { updateUserAgentsCount, countActiveAgents } from '@/lib/user-limits';

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const url = new URL(request.url);
    const chatbotId = url.searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 });
    }

    // Verify ownership before deleting
    const { getAgent } = await import('@/lib/agents');
    const agent = await getAgent(chatbotId);
    if (!agent || agent.userId !== userId) {
      return NextResponse.json({ error: 'Chatbot not found or not owned by you' }, { status: 404 });
    }

    // Delete the agent
    await deleteAgent(chatbotId);

    // Update user agents count
    const newCount = await countActiveAgents(userId);
    await updateUserAgentsCount(userId, newCount);

    return NextResponse.json({
      success: true,
      message: 'Agent supprimé avec succès',
      newCount,
      remainingSlots:
        newCount > 0 ? 'Vous pouvez maintenant créer un nouvel agent' : 'Aucun agent restant',
    });
  } catch (error) {
    logger.error('Error deleting chatbot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
