import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

/**
 * Search-specific rate limiter for Next.js API routes.
 * Each method returns null if allowed, or a 429 NextResponse if blocked.
 */
export class SearchRateLimitMiddleware {
  constructor(private redis: Redis) {}

  private getClientIp(request: NextRequest): string {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'
    );
  }

  private async check(
    key: string,
    limit: number,
    windowSec: number,
    errorMsg: string
  ): Promise<NextResponse | null> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, windowSec);
    }
    if (current > limit) {
      return NextResponse.json(
        { success: false, error: errorMsg, retryAfter: windowSec },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': windowSec.toString(),
          },
        }
      );
    }
    return null;
  }

  async search(request: NextRequest, isAuthenticated: boolean): Promise<NextResponse | null> {
    const ip = this.getClientIp(request);
    const limit = isAuthenticated ? 1000 : 100;
    return this.check(`rate-limit:search:${ip}`, limit, 60, 'Too many search requests');
  }

  async autocomplete(request: NextRequest, isAuthenticated: boolean): Promise<NextResponse | null> {
    const ip = this.getClientIp(request);
    const limit = isAuthenticated ? 500 : 50;
    return this.check(`rate-limit:autocomplete:${ip}`, limit, 60, 'Too many autocomplete requests');
  }

  async libraryDetail(request: NextRequest, isAuthenticated: boolean): Promise<NextResponse | null> {
    const ip = this.getClientIp(request);
    const limit = isAuthenticated ? 2000 : 200;
    return this.check(`rate-limit:detail:${ip}`, limit, 60, 'Too many detail requests');
  }

  async suggestions(request: NextRequest, userId?: string): Promise<NextResponse | null> {
    const identifier = userId || this.getClientIp(request);
    return this.check(`rate-limit:suggestions:${identifier}`, 100, 300, 'Too many suggestion requests');
  }

  async exportLimit(userId: string): Promise<NextResponse | null> {
    return this.check(`rate-limit:export:${userId}`, 10, 3600, 'Export limit exceeded');
  }
}
