import { NextRequest, NextResponse } from 'next/server';
import { RateLimitingService } from './rate-limiting.service';
import { QuotaService } from './quota.service';
import { RATE_LIMIT_CONFIGS, QUOTA_PLANS } from './plans';
import { RequestContext } from './types';

/**
 * Rate-limiting middleware adapted for Next.js API routes.
 * Each method returns null if the request is allowed, or a NextResponse (429/402) if blocked.
 */
export class RateLimitingMiddleware {
  constructor(
    private rateLimitingService: RateLimitingService,
    private quotaService: QuotaService
  ) {}

  private getClientIp(request: NextRequest): string {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'
    );
  }

  private buildBlockedResponse(message: string, retryAfter: number | undefined, headers: Record<string, string>): NextResponse {
    const res = NextResponse.json(
      { error: 'Too Many Requests', message, retryAfter },
      { status: 429 }
    );
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  async ipRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip = this.getClientIp(request);
    const result = await this.rateLimitingService.checkRateLimit(ip, RATE_LIMIT_CONFIGS.ip);
    if (!result.allowed) {
      return this.buildBlockedResponse('Rate limit exceeded', result.retryAfter, result.headers);
    }
    return null;
  }

  async userRateLimit(ctx: RequestContext): Promise<NextResponse | null> {
    if (!ctx.user) return null;
    const result = await this.rateLimitingService.checkRateLimit(ctx.user.id, RATE_LIMIT_CONFIGS.user);
    if (!result.allowed) {
      return this.buildBlockedResponse('User rate limit exceeded', result.retryAfter, result.headers);
    }
    return null;
  }

  async apiKeyRateLimit(ctx: RequestContext): Promise<NextResponse | null> {
    if (!ctx.apiKey) return null;
    const result = await this.rateLimitingService.checkRateLimit(ctx.apiKey.id, RATE_LIMIT_CONFIGS.api_key);
    if (!result.allowed) {
      return this.buildBlockedResponse('API key rate limit exceeded', result.retryAfter, result.headers);
    }
    return null;
  }

  async quotaCheck(ctx: RequestContext): Promise<NextResponse | null> {
    if (!ctx.user) return null;
    const quotaResult = await this.quotaService.checkUserQuota(
      ctx.user.id,
      ctx.user.plan as keyof typeof QUOTA_PLANS
    );
    if (!quotaResult.allowed) {
      const res = NextResponse.json(
        { error: 'Payment Required', message: 'Quota exceeded', quotaType: quotaResult.headers['X-Quota-Exceeded'] },
        { status: 402 }
      );
      Object.entries(quotaResult.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    await this.quotaService.incrementUsage(ctx.user.id);
    return null;
  }

  async checkAll(request: NextRequest, ctx: RequestContext): Promise<NextResponse | null> {
    const ipBlock = await this.ipRateLimit(request);
    if (ipBlock) return ipBlock;

    const userBlock = await this.userRateLimit(ctx);
    if (userBlock) return userBlock;

    const keyBlock = await this.apiKeyRateLimit(ctx);
    if (keyBlock) return keyBlock;

    const quotaBlock = await this.quotaCheck(ctx);
    if (quotaBlock) return quotaBlock;

    return null;
  }
}
