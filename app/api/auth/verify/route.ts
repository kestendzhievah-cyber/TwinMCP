/**
 * POST /api/auth/verify
 * Verify Firebase token and return/create user session
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { UserAuthService } from '@/lib/services/user-auth.service';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIdentifier, createRateLimitResponse } from '@/lib/middleware/rate-limiter';

let authService: UserAuthService | null = null;

function getAuthService(): UserAuthService {
  if (!authService) {
    authService = new UserAuthService(prisma, redis);
  }
  return authService;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const redisClient = redis;
    const identifier = getClientIdentifier(request);
    
    try {
      const rateLimitResult = await checkRateLimit(
        redisClient,
        identifier,
        RATE_LIMIT_CONFIGS.auth
      );
      
      if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult, RATE_LIMIT_CONFIGS.auth.message);
      }
    } catch {
      // Continue on rate limit error
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'idToken is required', code: 'MISSING_TOKEN' },
        { status: 400 }
      );
    }

    // Verify token and get/create user
    const authServiceInstance = getAuthService();
    const result = await authServiceInstance.verifyToken(idToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Authentication failed',
          code: result.code || 'AUTH_FAILED'
        },
        { status: 401 }
      );
    }

    // Return user and session
    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        session: result.session
      }
    });

  } catch (error) {
    logger.error('[Auth Verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
