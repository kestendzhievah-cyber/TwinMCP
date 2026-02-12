import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { PLAN_LIMITS } from '@/lib/services/usage.service';
import { prisma } from '@/lib/prisma';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  tier: string;
  error?: string;
}

// In-memory rate limiter (for production, use Redis)
const rateLimitCache = new Map<string, { count: number; resetAt: Date }>();

export async function validateAndTrackApiKey(
  apiKey: string,
  toolName: string
): Promise<RateLimitResult> {
  try {
    // Hash the API key
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Find the API key
    const key = await prisma.apiKey.findUnique({
      where: { keyHash }
    });

    if (!key) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        tier: 'unknown',
        error: 'Invalid API key'
      };
    }

    if (!key.isActive) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        tier: key.tier,
        error: 'API key has been revoked'
      };
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        tier: key.tier,
        error: 'API key has expired'
      };
    }

    const tier = (key.tier || 'free') as 'free' | 'pro' | 'enterprise';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

    // Check rate limit (requests per minute)
    const now = new Date();
    const minuteKey = `${key.id}:${Math.floor(now.getTime() / 60000)}`;
    
    let rateLimit = rateLimitCache.get(minuteKey);
    if (!rateLimit || rateLimit.resetAt < now) {
      rateLimit = { count: 0, resetAt: new Date(now.getTime() + 60000) };
    }

    if (rateLimit.count >= limits.rateLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: rateLimit.resetAt,
        tier,
        error: `Rate limit exceeded. Maximum ${limits.rateLimit} requests per minute.`
      };
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyUsage = await prisma.usageLog.count({
      where: {
        apiKeyId: key.id,
        createdAt: { gte: today }
      }
    });

    if (dailyUsage >= limits.dailyLimit) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: tomorrow,
        tier,
        error: `Daily quota exceeded. Maximum ${limits.dailyLimit} requests per day for ${tier} plan.`
      };
    }

    // Increment rate limit counter
    rateLimit.count++;
    rateLimitCache.set(minuteKey, rateLimit);

    // Clean old cache entries periodically
    if (Math.random() < 0.01) {
      const cutoff = now.getTime() - 120000; // 2 minutes ago
      for (const [cacheKey, value] of rateLimitCache.entries()) {
        if (value.resetAt.getTime() < cutoff) {
          rateLimitCache.delete(cacheKey);
        }
      }
    }

    // Log the usage
    await prisma.usageLog.create({
      data: {
        apiKeyId: key.id,
        userId: key.userId,
        toolName,
        success: true
      }
    });

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: now }
    });

    return {
      allowed: true,
      remaining: limits.dailyLimit - dailyUsage - 1,
      resetAt: new Date(today.getTime() + 86400000), // Tomorrow
      tier
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open in case of errors (or fail closed for stricter security)
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(),
      tier: 'unknown',
      error: 'Rate limit check failed'
    };
  }
}

// Middleware wrapper for API routes
export function withRateLimit(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const apiKey = req.headers.get('x-api-key') || 
                   req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required', code: 'MISSING_API_KEY' },
        { status: 401 }
      );
    }

    const toolName = req.nextUrl.pathname.split('/').pop() || 'unknown';
    const result = await validateAndTrackApiKey(apiKey, toolName);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.error?.includes('Rate limit') ? 'RATE_LIMITED' : 'QUOTA_EXCEEDED',
          tier: result.tier,
          resetAt: result.resetAt.toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toISOString(),
            'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = await handler(req);
    
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());
    response.headers.set('X-RateLimit-Tier', result.tier);

    return response;
  };
}
