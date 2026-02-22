/**
 * POST /api/auth/logout
 * Invalidate user session
 */

import { logger } from '@/lib/logger'
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
    // Authenticate request
    const { context, error } = await authenticateRequest(request, {
      required: true,
      rateLimitConfig: 'auth'
    });

    if (error) {
      return error;
    }

    if (!context.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Invalidate session
    const authServiceInstance = getAuthService();
    await authServiceInstance.invalidateSession(context.userId);

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('[Auth Logout] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
