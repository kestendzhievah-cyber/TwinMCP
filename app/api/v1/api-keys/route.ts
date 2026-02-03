import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

// Generate a secure API key
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `tmcp_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

// Validate API key from header
async function validateAuthHeader(request: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  // For demo, accept any valid-looking token
  // In production, verify JWT or session
  if (token.length < 10) return null;

  // Mock user for demo
  return { userId: 'demo-user-id' };
}

// Schema for creating API key
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
  permissions: z.array(z.string()).default(['resolve-library-id', 'query-docs']),
  expiresAt: z.string().datetime().optional(),
});

// GET - List user's API keys
export async function GET(request: NextRequest) {
  const auth = await validateAuthHeader(request);
  
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        tier: true,
        quotaDaily: true,
        quotaMonthly: true,
        usedDaily: true,
        usedMonthly: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate usage percentage
    const keysWithUsage = apiKeys.map(key => ({
      ...key,
      usagePercentageDaily: key.quotaDaily > 0 ? (key.usedDaily / key.quotaDaily) * 100 : 0,
      usagePercentageMonthly: key.quotaMonthly > 0 ? (key.usedMonthly / key.quotaMonthly) * 100 : 0,
      status: key.revokedAt ? 'revoked' : key.isActive ? 'active' : 'inactive',
    }));

    return NextResponse.json({
      apiKeys: keysWithUsage,
      total: keysWithUsage.length,
    });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  const auth = await validateAuthHeader(request);
  
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const data = CreateApiKeySchema.parse(body);

    // Generate new API key
    const { key, hash, prefix } = generateApiKey();

    // Determine quotas based on tier
    const tierQuotas: Record<string, { daily: number; monthly: number }> = {
      free: { daily: 100, monthly: 3000 },
      basic: { daily: 1000, monthly: 30000 },
      premium: { daily: 10000, monthly: 300000 },
      enterprise: { daily: 100000, monthly: 3000000 },
    };

    const quotas = tierQuotas[data.tier] || tierQuotas.free;

    // Create API key in database
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: auth.userId,
        keyHash: hash,
        keyPrefix: prefix,
        name: data.name,
        tier: data.tier,
        quotaDaily: quotas.daily,
        quotaMonthly: quotas.monthly,
        permissions: data.permissions,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        tier: true,
        quotaDaily: true,
        quotaMonthly: true,
        permissions: true,
        createdAt: true,
      },
    });

    // Return the full key only once (won't be shown again)
    return NextResponse.json({
      apiKey: {
        ...apiKey,
        key, // Full key - only returned on creation!
      },
      message: 'API key created successfully. Save this key - it won\'t be shown again!',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
