import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringService } from '../../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const monitoringService = await getMonitoringService();
    const alertId = (await params).id;
    const body = await request.json();
    
    if (!body.userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    const alert = await monitoringService.acknowledgeAlert(alertId, body.userId);

    return NextResponse.json({
      success: true,
      alert
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
