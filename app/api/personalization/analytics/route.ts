import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const analytics = await personalizationService.getAnalytics(userId);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}
