/**
 * Authentication Middleware
 * Centralized authentication for all API routes
 * Supports Firebase tokens and API keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { UserAuthService, AuthenticatedUser } from '@/lib/services/user-auth.service';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getClientIdentifier, createRateLimitResponse, RateLimitResult } from './rate-limiter';
import { createHash } from 'crypto';

// Singleton instances
let prisma: PrismaClient;
let redis: Redis;
let authService: UserAuthService;

// Initialize services lazily
function getServices() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true
    });
    
    redis.on('error', (err) => {
      console.warn('[Auth Middleware] Redis connection error:', err.message);
    });
  }
  
  if (!authService) {
    authService = new UserAuthService(prisma, redis);
  }
  
  return { prisma, redis, authService };
}

export interface AuthContext {
  user: AuthenticatedUser | null;
  userId: string | null;
  email: string | null;
  plan: string;
  isAuthenticated: boolean;
  authMethod: 'bearer' | 'api-key' | 'none';
  rateLimit: RateLimitResult;
}

export interface AuthMiddlewareOptions {
  required?: boolean;           // Is authentication required?
  allowApiKey?: boolean;        // Allow API key authentication?
  rateLimitConfig?: 'auth' | 'api' | 'heavy';  // Rate limit config to use
  skipRateLimit?: boolean;      // Skip rate limiting?
}

const DEFAULT_OPTIONS: AuthMiddlewareOptions = {
  required: true,
  allowApiKey: true,
  rateLimitConfig: 'api',
  skipRateLimit: false
};

/**
 * Main authentication middleware
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{ context: AuthContext; error?: NextResponse }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { prisma, redis, authService } = getServices();
  
  // Default context
  const context: AuthContext = {
    user: null,
    userId: null,
    email: null,
    plan: 'free',
    isAuthenticated: false,
    authMethod: 'none',
    rateLimit: { success: true, remaining: 60, resetTime: Date.now() + 60000, limit: 60 }
  };

  // Check rate limit first
  if (!opts.skipRateLimit) {
    const rateLimitConfig = RATE_LIMIT_CONFIGS[opts.rateLimitConfig || 'api'];
    const identifier = getClientIdentifier(request);
    
    try {
      const rateLimitResult = await checkRateLimit(redis, identifier, rateLimitConfig);
      context.rateLimit = rateLimitResult;
      
      if (!rateLimitResult.success) {
        return {
          context,
          error: createRateLimitResponse(rateLimitResult, rateLimitConfig.message)
        };
      }
    } catch (e) {
      // Continue on rate limit error (fail open)
      console.warn('[Auth Middleware] Rate limit check failed:', e);
    }
  }

  // Try Bearer token authentication
  const authHeader = request.headers.get('authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Check if it's a Firebase token or API key
    if (token.startsWith('twinmcp_')) {
      // API Key authentication
      if (opts.allowApiKey) {
        const apiKeyAuth = await authenticateWithApiKey(prisma, token);
        if (apiKeyAuth.success && apiKeyAuth.userId) {
          context.userId = apiKeyAuth.userId;
          context.plan = apiKeyAuth.plan || 'free';
          context.isAuthenticated = true;
          context.authMethod = 'api-key';
          
          // Get full user if needed
          const user = await authService.getAuthenticatedUser(apiKeyAuth.userId);
          context.user = user;
          context.email = user?.email || null;
        }
      }
    } else {
      // Firebase token authentication
      const authResult = await authService.verifyToken(token);
      if (authResult.success && authResult.user) {
        context.user = authResult.user;
        context.userId = authResult.user.id;
        context.email = authResult.user.email;
        context.plan = authResult.user.plan;
        context.isAuthenticated = true;
        context.authMethod = 'bearer';
      }
    }
  }

  // Try X-API-Key header
  if (!context.isAuthenticated && opts.allowApiKey) {
    const apiKeyHeader = request.headers.get('x-api-key');
    if (apiKeyHeader) {
      const apiKeyAuth = await authenticateWithApiKey(prisma, apiKeyHeader);
      if (apiKeyAuth.success && apiKeyAuth.userId) {
        context.userId = apiKeyAuth.userId;
        context.plan = apiKeyAuth.plan || 'free';
        context.isAuthenticated = true;
        context.authMethod = 'api-key';
        
        const user = await authService.getAuthenticatedUser(apiKeyAuth.userId);
        context.user = user;
        context.email = user?.email || null;
      }
    }
  }

  // Check if authentication is required
  if (opts.required && !context.isAuthenticated) {
    return {
      context,
      error: NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    };
  }

  return { context };
}

/**
 * Authenticate with API key
 */
async function authenticateWithApiKey(
  prisma: PrismaClient,
  apiKey: string
): Promise<{ success: boolean; userId?: string; plan?: string }> {
  try {
    if (!apiKey.startsWith('twinmcp_')) {
      return { success: false };
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: { id: true }
        }
      }
    });

    if (!key || !key.isActive || key.revokedAt) {
      return { success: false };
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      return { success: false };
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      success: true,
      userId: key.userId,
      plan: key.tier
    };
    
  } catch (error) {
    console.error('[Auth Middleware] API key auth error:', error);
    return { success: false };
  }
}

/**
 * Helper to extract token from request
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return request.headers.get('x-api-key');
}

/**
 * Create standardized error response
 */
export function createAuthErrorResponse(
  message: string,
  code: string,
  status: number = 401
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code
    },
    { status }
  );
}

/**
 * Get user ID from various sources
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const { context } = await authenticateRequest(request, { required: false });
  return context.userId;
}
