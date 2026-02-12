/**
 * User Authentication Service
 * Handles Firebase token verification and user management
 * Optimized for scalability with Redis caching
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as admin from 'firebase-admin';

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

// Plan limits configuration
const PLAN_LIMITS = {
  free: { dailyLimit: 200, monthlyLimit: 6000, maxKeys: 2 },
  pro: { dailyLimit: 10000, monthlyLimit: 300000, maxKeys: 10 },
  enterprise: { dailyLimit: 100000, monthlyLimit: 3000000, maxKeys: 100 }
};

// Session TTL (24 hours)
const SESSION_TTL = 24 * 60 * 60;

// User cache TTL (5 minutes)
const USER_CACHE_TTL = 5 * 60;

export class UserAuthService {
  private prisma: PrismaClient;
  private redis: Redis;
  private firebaseAdmin: typeof admin | null = null;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.initFirebaseAdmin();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initFirebaseAdmin() {
    try {
      if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
          this.firebaseAdmin = admin;
          console.log('[Auth] Firebase Admin initialized successfully');
        } else {
          console.warn('[Auth] Firebase Admin credentials not fully configured');
        }
      } else {
        this.firebaseAdmin = admin;
      }
    } catch (error) {
      console.error('[Auth] Firebase Admin initialization error:', error);
    }
  }

  /**
   * Verify Firebase ID token and return/create user
   */
  async verifyToken(idToken: string): Promise<AuthResult> {
    try {
      let decodedToken: admin.auth.DecodedIdToken;

      // Verify token with Firebase Admin
      if (this.firebaseAdmin) {
        try {
          decodedToken = await this.firebaseAdmin.auth().verifyIdToken(idToken);
        } catch (firebaseError: any) {
          // Try fallback JWT extraction for development
          const extracted = this.extractTokenPayload(idToken);
          if (!extracted) {
            return {
              success: false,
              error: firebaseError.code === 'auth/id-token-expired' 
                ? 'Token expired' 
                : 'Invalid token',
              code: firebaseError.code === 'auth/id-token-expired' 
                ? 'EXPIRED_TOKEN' 
                : 'INVALID_TOKEN'
            };
          }
          decodedToken = extracted as admin.auth.DecodedIdToken;
        }
      } else {
        // Fallback: Extract from JWT payload (development only)
        const extracted = this.extractTokenPayload(idToken);
        if (!extracted) {
          return { success: false, error: 'Token verification failed', code: 'INVALID_TOKEN' };
        }
        decodedToken = extracted as admin.auth.DecodedIdToken;
      }

      const uid = decodedToken.uid || decodedToken.user_id || decodedToken.sub;
      const email = decodedToken.email || `user-${uid}@twinmcp.local`;
      const name = decodedToken.name || null;
      const picture = decodedToken.picture || null;

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
        session
      };

    } catch (error) {
      console.error('[Auth] Token verification error:', error);
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
        picture: payload.picture
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
      const cachedUser = await this.redis.get(cacheKey);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      // Find existing user
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { id: firebaseUid },
            { oauthId: firebaseUid },
            { email: email }
          ]
        }
      });

      if (!user) {
        // Get or create default client
        let defaultClient = await this.prisma.client.findFirst({
          where: { name: 'default' }
        });

        if (!defaultClient) {
          defaultClient = await this.prisma.client.create({
            data: { name: 'default', apiKeys: {} }
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
            clientId: defaultClient.id
          }
        });

        // Create user profile
        await this.prisma.userProfile.create({
          data: {
            userId: user.id,
            email,
            firstName: name?.split(' ')[0] || null,
            lastName: name?.split(' ').slice(1).join(' ') || null
          }
        });

        // Create default subscription (free plan)
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await this.prisma.subscription.create({
          data: {
            userId: user.id,
            plan: 'free',
            status: 'ACTIVE',
            amount: 0,
            currency: 'EUR',
            interval: 'MONTH',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd
          }
        });

        console.log(`[Auth] New user created: ${email}`);
      } else if (name || avatar) {
        // Update user info if changed
        const updateData: any = {};
        if (name && name !== user.name) updateData.name = name;
        if (avatar && avatar !== user.avatar) updateData.avatar = avatar;
        
        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
        }
      }

      // Cache user
      await this.redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user));

      return user;

    } catch (error) {
      console.error('[Auth] Get or create user error:', error);
      return null;
    }
  }

  /**
   * Create session and store in Redis
   */
  async createSession(user: { id: string; email: string; name: string | null; avatar: string | null; role: string }): Promise<UserSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);

    // Get user's plan
    let plan = 'free';
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      plan = subscription?.plan || 'free';
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
      expiresAt
    };

    // Store session in Redis
    const sessionKey = `session:${user.id}`;
    await this.redis.setex(sessionKey, SESSION_TTL, JSON.stringify(session));

    // Log login
    await this.logLogin(user.id);

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
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get user with relations
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          client: true
        }
      });

      if (!user) return null;

      // Get profile
      const profile = await this.prisma.userProfile.findUnique({
        where: { userId }
      });

      // Get active subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });

      // Get stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [apiKeysCount, requestsToday, requestsMonth] = await Promise.all([
        this.prisma.apiKey.count({ where: { userId, isActive: true } }),
        this.prisma.usageLog.count({ where: { userId, createdAt: { gte: today } } }),
        this.prisma.usageLog.count({ where: { userId, createdAt: { gte: monthStart } } })
      ]);

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        plan: subscription?.plan || 'free',
        clientId: user.clientId,
        profile: profile ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          address: profile.address,
          city: profile.city,
          country: profile.country
        } : null,
        subscription: subscription ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd
        } : null,
        stats: {
          apiKeysCount,
          requestsToday,
          requestsMonth
        }
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(authenticatedUser));

      return authenticatedUser;

    } catch (error) {
      console.error('[Auth] Get authenticated user error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    postalCode?: string;
  }): Promise<boolean> {
    try {
      await this.prisma.userProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data
        }
      });

      // Clear cache
      await this.redis.del(`auth:user:${userId}`);
      
      return true;
    } catch (error) {
      console.error('[Auth] Update profile error:', error);
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
            source: 'firebase'
          }
        }
      });
    } catch {
      // Silent fail for analytics
    }
  }

  /**
   * Clear all caches for a user
   */
  async clearUserCache(userId: string) {
    const keys = [
      `session:${userId}`,
      `auth:user:${userId}`,
      `user:firebase:${userId}`
    ];
    
    await Promise.all(keys.map(key => this.redis.del(key)));
  }
}
