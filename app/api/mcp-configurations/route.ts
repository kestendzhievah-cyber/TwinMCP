import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { createMcpConfigSchema, parseBody } from '@/lib/validations/api-schemas';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// Fonction helper pour vérifier le token d'authentification
async function getAuthenticatedUserId(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError();
  }

  const token = authHeader.split('Bearer ')[1];
  const adminAuth = await getFirebaseAdminAuth();
  if (!adminAuth) {
    throw new Error('Firebase Admin not configured');
  }
  try {
    const decodedToken: any = await adminAuth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    throw new AuthenticationError('Token invalide');
  }
}

// GET /api/mcp-configurations - Récupérer toutes les configurations de l'utilisateur
export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);

    const configurations = await prisma.mCPConfiguration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(configurations, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=15',
        'X-Response-Time': `${Date.now() - start}ms`,
      },
    });
  } catch (error) {
    return handleApiError(error, 'ListMcpConfigurations');
  }
}

// POST /api/mcp-configurations - Créer une nouvelle configuration
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(createMcpConfigSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { name, description, configData } = parsed.data;

    const configuration = await prisma.mCPConfiguration.create({
      data: {
        name,
        description: description ?? null,
        configData: configData as any,
        userId,
      },
    });

    return NextResponse.json(configuration, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreateMcpConfiguration');
  }
}
