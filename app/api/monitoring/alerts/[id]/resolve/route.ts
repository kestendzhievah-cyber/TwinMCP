import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringService } from '../../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // SECURITY: Use authenticated userId instead of trusting body.userId (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const monitoringService = await getMonitoringService();
    const alertId = (await params).id;

    const alert = await monitoringService.resolveAlert(alertId, userId);

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }
    return handleApiError(error, 'ResolveAlert');
  }
}
