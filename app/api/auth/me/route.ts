/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';

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

    if (!context.isAuthenticated || !context.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Return user profile
    const response = NextResponse.json({
      success: true,
      data: {
        user: context.user,
      },
    });

    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', context.rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Limit', context.rateLimit.limit.toString());

    return response;
  } catch (error) {
    return handleApiError(error, 'AuthMe');
  }
}
