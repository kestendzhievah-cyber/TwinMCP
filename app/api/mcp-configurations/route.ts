import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/firebase-admin';

// Fonction helper pour vérifier le token d'authentification
async function getAuthenticatedUserId(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token d\'authentification manquant ou invalide');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken: any = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    throw new Error('Token invalide');
  }
}

// GET /api/mcp-configurations - Récupérer toutes les configurations de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    const configurations = await prisma.mCPConfiguration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(configurations);
  } catch (error) {
    console.error('Erreur lors de la récupération des configurations:', error);
    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// POST /api/mcp-configurations - Créer une nouvelle configuration
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    const body = await request.json();
    const { name, description, configData, productId } = body;

    if (!name || !configData) {
      return NextResponse.json({ error: 'Nom et données de configuration requis' }, { status: 400 });
    }

    const configuration = await prisma.mCPConfiguration.create({
      data: {
        name,
        description: description || null,
        configData: typeof configData === 'string' ? JSON.parse(configData) : configData,
        userId,
      },
    });

    return NextResponse.json(configuration, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création de la configuration:', error);
    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
