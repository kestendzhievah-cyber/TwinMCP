import { NextRequest, NextResponse } from 'next/server';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import {
  ensureUser,
  getKeyUsageHistory,
  getKeyUsageAnalytics,
} from '@/lib/services/api-key.service';

type RouteContext = { params: Promise<{ id: string }> };

// GET — Per-key usage history + analytics
// Query params: ?days=30 (default 30, max 90)
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const authResult = await validateAuthWithApiKey(
      request.headers.get('authorization'),
      request.headers.get('x-api-key')
    );
    if (!authResult.valid) throw new AuthenticationError();

    const user = await ensureUser(authResult.userId, authResult.email);
    const { id } = await params;

    // Parse days param (clamped 1-90)
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 1), 90);

    const [history, analytics] = await Promise.all([
      getKeyUsageHistory(id, user.id, days),
      getKeyUsageAnalytics(id, user.id),
    ]);

    if (!analytics) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        history,
        analytics,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GetKeyUsage');
  }
}
