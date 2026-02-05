import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { UsageService, PLAN_LIMITS } from '@/lib/services/usage.service';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Helper to get Redis client (optional, graceful degradation)
async function getRedisClient() {
  try {
    if (process.env.REDIS_URL) {
      const Redis = (await import('ioredis')).default;
      return new Redis(process.env.REDIS_URL);
    }
  } catch (error) {
    console.warn('Redis not available, using database-only mode');
  }
  return null;
}

// Validate Firebase token or API key
async function validateAuth(request: NextRequest) {
  // Check for Firebase ID token
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Validate Firebase token
    try {
      const firebaseAdmin = await import('firebase-admin');
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      return { valid: true, userId: decodedToken.uid, email: decodedToken.email };
    } catch (error) {
      // Try as API key if Firebase validation fails
      return validateApiKey(token);
    }
  }

  if (apiKey) {
    return validateApiKey(apiKey);
  }

  return { valid: false, error: 'No authentication provided' };
}

async function validateApiKey(apiKey: string) {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true }
  });

  if (!key || !key.isActive) {
    return { valid: false, error: 'Invalid or inactive API key' };
  }

  return { valid: true, userId: key.userId, apiKeyId: key.id, tier: key.tier };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth(request);
    
    if (!auth.valid) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    // Get or create user in database
    let dbUser = await prisma.user.findFirst({
      where: { 
        OR: [
          { id: userId },
          { oauthId: userId }
        ]
      }
    });

    if (!dbUser) {
      // Create default client if not exists
      let defaultClient = await prisma.client.findFirst({
        where: { name: 'default' }
      });

      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: {
            name: 'default',
            apiKeys: {}
          }
        });
      }

      // Create user
      dbUser = await prisma.user.create({
        data: {
          id: userId,
          email: auth.email || `user-${userId}@twinmcp.local`,
          oauthId: userId,
          oauthProvider: 'firebase',
          clientId: defaultClient.id
        }
      });
    }

    const redis = await getRedisClient();
    const usageService = new UsageService(prisma, redis || undefined);
    const stats = await usageService.getDashboardStats(dbUser.id);

    // Close Redis connection if opened
    if (redis) {
      await redis.quit();
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
