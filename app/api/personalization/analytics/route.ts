import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const analytics = await personalizationService.getAnalytics(userId);

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error getting analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
