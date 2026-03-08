/**
 * GET /api/auth/profile
 * Get user profile
 *
 * PUT /api/auth/profile
 * Update user profile
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { UserAuthService } from '@/lib/services/user-auth.service';
import { authenticateRequest } from '@/lib/middleware/auth-middleware';
import { updateProfileSchema, parseBody } from '@/lib/validations/api-schemas';

let authService: UserAuthService | null = null;

function getAuthService(): UserAuthService {
  if (!authService) {
    authService = new UserAuthService(prisma, redis);
  }
  return authService;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { context, error } = await authenticateRequest(request, {
      required: true,
      rateLimitConfig: 'api',
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

    return NextResponse.json({
      success: true,
      data: {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name,
        avatar: context.user.avatar,
        role: context.user.role,
        plan: context.user.plan,
        profile: context.user.profile,
        subscription: context.user.subscription,
        stats: context.user.stats,
      },
    });
  } catch (error) {
    logger.error('[Auth Profile GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate request
    const { context, error } = await authenticateRequest(request, {
      required: true,
      rateLimitConfig: 'api',
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

    // Parse and validate body with Zod
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const parsed = parseBody(updateProfileSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error, details: parsed.details, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Build update data from validated fields (only defined ones)
    const updateData: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Update profile
    const authServiceInstance = getAuthService();
    const success = await authServiceInstance.updateProfile(context.userId, updateData);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update profile', code: 'UPDATE_FAILED' },
        { status: 500 }
      );
    }

    // Get updated user
    const updatedUser = await authServiceInstance.getAuthenticatedUser(context.userId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Profile updated successfully',
        profile: updatedUser?.profile,
      },
    });
  } catch (error) {
    logger.error('[Auth Profile PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
