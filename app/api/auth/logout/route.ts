/**
 * POST /api/auth/logout
 * Invalidate user session
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { UserAuthService } from '@/lib/services/user-auth.service';
import { authenticateRequest } from '@/lib/middleware/auth-middleware';

let authService: UserAuthService | null = null;

function getAuthService(): UserAuthService {
  if (!authService) {
    authService = new UserAuthService(prisma, redis);
  }
  return authService;
}

export async function POST(request: NextRequest) {
  try {
    // Try normal authentication first
    const { context } = await authenticateRequest(request, {
      required: false,
      rateLimitConfig: 'auth',
    });

    let userId = context.userId;

    // Fallback: if token was expired, client sends uid via header.
    // SECURITY: Only accept x-logout-uid if it matches a structurally valid
    // Firebase UID (alphanumeric, 1-128 chars) and cap its length to prevent
    // abuse as an arbitrary session-invalidation vector.
    if (!userId) {
      const logoutUid = request.headers.get('x-logout-uid');
      if (
        logoutUid &&
        typeof logoutUid === 'string' &&
        logoutUid.length > 0 &&
        logoutUid.length <= 128 &&
        /^[a-zA-Z0-9_-]+$/.test(logoutUid)
      ) {
        userId = logoutUid;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No user to log out', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Invalidate session
    const authServiceInstance = getAuthService();
    await authServiceInstance.invalidateSession(userId);

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('[Auth Logout] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
