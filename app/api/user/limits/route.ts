import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { getUserLimits, UserLimitsResponse } from '@/lib/user-limits';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  const start = Date.now();
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

    // Get user limits and usage
    const limitsData = await getUserLimits(userId);

    return NextResponse.json(limitsData, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=15',
        'X-Response-Time': `${Date.now() - start}ms`,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GetUserLimits');
  }
}
