import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { getUserLimits, UserLimitsResponse } from '@/lib/user-limits';

export async function GET(request: NextRequest) {
  const start = Date.now();
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

    // Get user limits and usage
    const limitsData = await getUserLimits(userId);

    return NextResponse.json(limitsData, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=15',
        'X-Response-Time': `${Date.now() - start}ms`,
      },
    });
  } catch (error) {
    logger.error('Error getting user limits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
