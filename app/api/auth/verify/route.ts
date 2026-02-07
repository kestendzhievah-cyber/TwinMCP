/**
 * POST /api/auth/verify
 * Verify Firebase token and return/create user session
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { UserAuthService } from '@/lib/services/user-auth.service';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIdentifier, createRateLimitResponse } from '@/lib/middleware/rate-limiter';

// Singleton instances
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let redis: Redis | null = null;
let authService: UserAuthService | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true
    });
    redis.on('error', () => {}); // Suppress connection errors
  }
  return redis;
}

function getAuthService(): UserAuthService {
  if (!authService) {
    authService = new UserAuthService(prisma, getRedis());
  }
  return authService;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const redisClient = getRedis();
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
    console.error('[Auth Verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
