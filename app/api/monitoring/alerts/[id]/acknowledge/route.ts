import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringService } from '../../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // SECURITY: Use authenticated userId instead of trusting body.userId (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const monitoringService = await getMonitoringService();
    const alertId = (await params).id;

    const alert = await monitoringService.acknowledgeAlert(alertId, userId);

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);

    if ((error as Error).message.includes('not found')) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
