import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { UsageService } from '@/lib/services/usage.service';
import { createHash } from 'crypto';
import { trackUsageSchema, parseBody } from '@/lib/validations/api-schemas';

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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(trackUsageSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { toolName, success, responseTimeMs, libraryId, query, tokensReturned } = parsed.data;

    const usageService = new UsageService(prisma, redis);
    
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
    logger.error('Usage tracking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
