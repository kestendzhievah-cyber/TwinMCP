import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { UsageService } from '@/lib/services/usage.service';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Helper to get Redis client (optional)
async function getRedisClient() {
  try {
    if (process.env.REDIS_URL) {
      const Redis = (await import('ioredis')).default;
      return new Redis(process.env.REDIS_URL);
    }
  } catch (error) {
    console.warn('Redis not available');
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key required' },
        { status: 401 }
      );
    }

    // Validate API key
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const key = await prisma.apiKey.findUnique({
      where: { keyHash }
    });

    if (!key || !key.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { toolName, success, responseTimeMs, libraryId, query, tokensReturned } = body;

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: 'toolName is required' },
        { status: 400 }
      );
    }

    const redis = await getRedisClient();
    const usageService = new UsageService(prisma, redis || undefined);
    
    const result = await usageService.trackUsage(
      key.id,
      toolName,
      success !== false,
      responseTimeMs || 0,
      key.userId,
      libraryId,
      query,
      tokensReturned
    );

    if (redis) {
      await redis.quit();
    }

    if (!result.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Daily quota exceeded',
          remaining: 0
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      remaining: result.remaining
    });

  } catch (error) {
    console.error('Usage tracking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
