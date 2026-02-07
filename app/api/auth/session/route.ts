/**
 * GET /api/auth/session
 * Get current session info
 * 
 * POST /api/auth/session
 * Refresh session
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { UserAuthService } from '@/lib/services/user-auth.service';
import { authenticateRequest } from '@/lib/middleware/auth-middleware';

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
    redis.on('error', () => {});
  }
  return redis;
}

function getAuthService(): UserAuthService {
  if (!authService) {
    authService = new UserAuthService(prisma, getRedis());
  }
  return authService;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { context, error } = await authenticateRequest(request, {
      required: false,
      rateLimitConfig: 'api'
    });

    if (error) {
      return error;
    }

    if (!context.isAuthenticated || !context.userId) {
      return NextResponse.json({
        success: true,
        data: {
          authenticated: false,
          session: null,
          user: null
        }
      });
    }

    // Get session
    const authServiceInstance = getAuthService();
    const session = await authServiceInstance.getSession(context.userId);

    return NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        session,
        user: context.user ? {
          id: context.user.id,
          email: context.user.email,
          name: context.user.name,
          avatar: context.user.avatar,
          plan: context.user.plan,
          role: context.user.role
        } : null
      }
    });

  } catch (error) {
    console.error('[Auth Session GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
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

    if (!context.user) {
      return NextResponse.json(
        { success: false, error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Refresh session
    const authServiceInstance = getAuthService();
    const session = await authServiceInstance.createSession({
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
      avatar: context.user.avatar,
      role: context.user.role
    });

    return NextResponse.json({
      success: true,
      data: {
        session,
        user: {
          id: context.user.id,
          email: context.user.email,
          name: context.user.name,
          avatar: context.user.avatar,
          plan: context.user.plan,
          role: context.user.role
        }
      }
    });

  } catch (error) {
    console.error('[Auth Session POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
