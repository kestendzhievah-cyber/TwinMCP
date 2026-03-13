/**
 * User Authentication Service
 * Handles Firebase token verification and user management
 * Optimized for scalability with Redis caching
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';

// Types
export interface UserSession {
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  plan: string;
  role: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  plan: string;
  clientId: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
  } | null;
  stats: {
    apiKeysCount: number;
    requestsToday: number;
    requestsMonth: number;
  };
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  session?: UserSession;
  error?: string;
  code?: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'USER_DISABLED' | 'DB_ERROR' | 'UNAUTHORIZED';
}

// Session TTL (24 hours)
const SESSION_TTL = 24 * 60 * 60;

// User cache TTL (5 minutes)
const USER_CACHE_TTL = 5 * 60;

export class UserAuthService {
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Verify Firebase ID token and return/create user.
   * SECURITY: Only accepts tokens verified by Firebase Admin SDK.
   * In development without Firebase Admin, falls back to unverified
   * JWT extraction ONLY if ALLOW_INSECURE_DEV_AUTH=true.
   */
  async verifyToken(idToken: string): Promise<AuthResult> {
    try {
      let uid: string;
      let email: string;
      let name: string | null = null;
      let picture: string | null = null;

      // Get Firebase Admin auth instance (shared singleton)
      const adminAuth = await getFirebaseAdminAuth();

      if (adminAuth) {
        // PRODUCTION PATH: Verify token cryptographically via Firebase Admin
        try {
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          uid = decodedToken.uid;
          email = decodedToken.email || `user-${uid}@twinmcp.local`;
          name = decodedToken.name || null;
          picture = decodedToken.picture || null;
        } catch (firebaseError: any) {
          const code = firebaseError.code === 'auth/id-token-expired'
            ? 'EXPIRED_TOKEN' as const
            : 'INVALID_TOKEN' as const;
          return {
            success: false,
            error: code === 'EXPIRED_TOKEN' ? 'Token expired' : 'Invalid token',
            code,
          };
        }
      } else {
        // DEV-ONLY FALLBACK: Extract payload without verification
        // SECURITY: Triple-guard — non-production + explicit opt-in + localhost DB only
        const isDevFallbackAllowed =
          process.env.NODE_ENV !== 'production' &&
          process.env.ALLOW_INSECURE_DEV_AUTH === 'true' &&
          (process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') || false);

        if (!isDevFallbackAllowed) {
          logger.error('[Auth] Firebase Admin not configured and dev fallback not allowed');
          return {
            success: false,
            error: 'Authentication service not configured',
            code: 'UNAUTHORIZED',
          };
        }

        logger.warn('[Auth] Using INSECURE dev fallback — token NOT verified');
        const extracted = this.extractTokenPayload(idToken);
        if (!extracted) {
          return { success: false, error: 'Token verification failed', code: 'INVALID_TOKEN' };
        }
        uid = extracted.uid;
        email = extracted.email || `user-${uid}@twinmcp.local`;
        name = extracted.name || null;
        picture = extracted.picture || null;
      }

      // Get or create user
      const user = await this.getOrCreateUser(uid, email, name, picture);
      if (!user) {
        return { success: false, error: 'Failed to create user', code: 'DB_ERROR' };
      }

      // Create session
      const session = await this.createSession(user);

      // Get full user data
      const authenticatedUser = await this.getAuthenticatedUser(user.id);

      return {
        success: true,
        user: authenticatedUser ?? undefined,
        session,
      };
    } catch (error) {
      logger.error('[Auth] Token verification error:', error);
      return { success: false, error: 'Authentication failed', code: 'UNAUTHORIZED' };
    }
  }

  /**
   * Extract payload from JWT token (fallback for development)
   */
  private extractTokenPayload(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const userId = payload.user_id || payload.sub || payload.uid;

      if (!userId) return null;

      return {
        uid: userId,
        user_id: userId,
        sub: userId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get or create user in database
   */
  async getOrCreateUser(
    firebaseUid: string,
    email: string,
    name: string | null = null,
    avatar: string | null = null
  ) {
    try {
      // Check cache first
      const cacheKey = `user:firebase:${firebaseUid}`;
      try {
        const cachedUser = await this.redis.get(cacheKey);
        if (cachedUser) {
          return JSON.parse(cachedUser);
        }
      } catch (cacheError) {
        logger.warn('[Auth] Redis cache read failed, continuing without cache');
      }

      // Find existing user
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: firebaseUid }, { oauthId: firebaseUid }, { email }],
        },
      });

      if (!user) {
        // Get or create default client
        let defaultClient = await this.prisma.client.findFirst({
          where: { name: 'default' },
        });

        if (!defaultClient) {
          defaultClient = await this.prisma.client.create({
            data: { name: 'default', apiKeys: {} },
          });
        }

        // Create new user
        user = await this.prisma.user.create({
          data: {
            id: firebaseUid,
            email,
            name,
            avatar,
            oauthId: firebaseUid,
            oauthProvider: 'firebase',
            role: 'BUYER',
            clientId: defaultClient.id,
          },
        });

        // Create user profile (Subscription FK references UserProfile.id)
        const userProfile = await this.prisma.userProfile.create({
          data: {
            userId: user.id,
            email,
            firstName: name?.split(' ')[0] || null,
            lastName: name?.split(' ').slice(1).join(' ') || null,
          },
        });

        // Create default subscription (free plan)
        // NOTE: Subscription.userId is a FK to UserProfile.id
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await this.prisma.subscription.create({
          data: {
            userId: userProfile.id,
            plan: 'free',
            status: 'ACTIVE',
            amount: 0,
            currency: 'EUR',
            interval: 'MONTH',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        logger.info(`[Auth] New user created: ${email}`);
      } else if (name || avatar) {
        // Update user info if changed
        const updateData: any = {};
        if (name && name !== user.name) updateData.name = name;
        if (avatar && avatar !== user.avatar) updateData.avatar = avatar;

        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }
      }

      // Cache user
      try {
        await this.redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
      } catch (cacheError) {
        logger.warn('[Auth] Redis cache write failed, continuing without cache');
      }

      return user;
    } catch (error) {
      logger.error('[Auth] Get or create user error:', error);
      return null;
    }
  }

  /**
   * Create session and store in Redis
   */
  async createSession(user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: string;
  }): Promise<UserSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);

    // Get user's plan (from UserProfile, which is the source of truth)
    let plan = 'free';
    try {
      const profile = await this.prisma.userProfile.findUnique({
        where: { userId: user.id },
        select: { plan: true },
      });
      plan = profile?.plan || 'free';
    } catch {
      // Default to free
    }

    const session: UserSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      plan,
      role: user.role,
      createdAt: now,
      expiresAt,
    };

    // Store session in Redis
    try {
      const sessionKey = `session:${user.id}`;
      await this.redis.setex(sessionKey, SESSION_TTL, JSON.stringify(session));
    } catch (redisError) {
      logger.warn('[Auth] Redis session write failed, session not persisted');
    }

    // Fire-and-forget — don't block session creation on analytics write
    this.logLogin(user.id);

    return session;
  }

  /**
   * Get session from Redis
   */
  async getSession(userId: string): Promise<UserSession | null> {
    try {
      const sessionKey = `session:${userId}`;
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) return null;

      const session = JSON.parse(sessionData) as UserSession;

      // Check if expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.redis.del(sessionKey);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(userId: string): Promise<boolean> {
    try {
      const sessionKey = `session:${userId}`;
      await this.redis.del(sessionKey);

      // Also clear user cache
      const userCacheKey = `user:firebase:${userId}`;
      await this.redis.del(userCacheKey);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get full authenticated user data
   */
  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    try {
      // Check cache
      const cacheKey = `auth:user:${userId}`;
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        logger.warn('[Auth] Redis auth cache read failed, continuing without cache');
      }

      // Parallel: user + profile + stats (all independent queries)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [user, profile, apiKeysCount, requestsToday, requestsMonth] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, avatar: true, role: true, clientId: true },
        }),
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: {
            plan: true,
            firstName: true, lastName: true, phone: true,
            address: true, city: true, country: true,
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { plan: true, status: true, currentPeriodEnd: true },
            },
          },
        }),
        this.prisma.apiKey.count({ where: { userId, isActive: true } }),
        this.prisma.usageLog.count({ where: { userId, createdAt: { gte: today } } }),
        this.prisma.usageLog.count({ where: { userId, createdAt: { gte: monthStart } } }),
      ]);

      if (!user) return null;

      const activeSubscription = profile?.subscriptions?.[0] ?? null;

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        plan: profile?.plan || activeSubscription?.plan || 'free',
        clientId: user.clientId,
        profile: profile
          ? {
              firstName: profile.firstName,
              lastName: profile.lastName,
              phone: profile.phone,
              address: profile.address,
              city: profile.city,
              country: profile.country,
            }
          : null,
        subscription: activeSubscription
          ? {
              plan: activeSubscription.plan,
              status: activeSubscription.status,
              currentPeriodEnd: activeSubscription.currentPeriodEnd,
            }
          : null,
        stats: {
          apiKeysCount,
          requestsToday,
          requestsMonth,
        },
      };

      // Cache for 5 minutes
      try {
        await this.redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(authenticatedUser));
      } catch (cacheError) {
        logger.warn('[Auth] Redis auth cache write failed, continuing without cache');
      }

      return authenticatedUser;
    } catch (error) {
      logger.error('[Auth] Get authenticated user error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      postalCode?: string;
    }
  ): Promise<boolean> {
    try {
      await this.prisma.userProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data,
        },
      });

      // Clear cache
      try {
        await this.redis.del(`auth:user:${userId}`);
      } catch (cacheError) {
        logger.warn('[Auth] Redis cache clear failed');
      }

      return true;
    } catch (error) {
      logger.error('[Auth] Update profile error:', error);
      return false;
    }
  }

  /**
   * Log user login for analytics
   */
  private async logLogin(userId: string) {
    try {
      await this.prisma.personalizationAnalytics.create({
        data: {
          userId,
          actionType: 'login',
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'firebase',
          },
        },
      });
    } catch {
      // Silent fail for analytics
    }
  }

  /**
   * Clear all caches for a user
   */
  async clearUserCache(userId: string) {
    const keys = [`session:${userId}`, `auth:user:${userId}`, `user:firebase:${userId}`];

    await Promise.all(keys.map(key => this.redis.del(key)));
  }
}
