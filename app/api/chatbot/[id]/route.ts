import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase/admin';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// Lazy initialization of Firestore
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    const app = getFirebaseAdminApp();
    if (!app) {
      throw new Error('Firebase Admin not initialized');
    }
    db = getFirestore(app);
  }
  return db;
}

// GET /api/chatbot/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID du chatbot manquant' }, { status: 400 });
    }

    // Validate id format to prevent Firestore injection
    if (typeof id !== 'string' || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Format ID invalide' }, { status: 400 });
    }

    const docRef = getDb().collection('chatbots').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Chatbot non trouvé' }, { status: 404 });
    }

    const data = doc.data();

    // Formater les données pour correspondre à l'interface Chatbot
    const chatbot = {
      id: doc.id,
      name: data?.name || '',
      description: data?.description || '',
      model: data?.model || 'gpt-3.5-turbo',
      systemPrompt: data?.systemPrompt || '',
      temperature: data?.temperature ?? 0.7,
      maxTokens: data?.maxTokens ?? 1000,
      isActive: data?.isActive ?? true,
      conversationsCount: data?.conversationsCount ?? 0,
      createdAt: data?.createdAt?.toDate()?.toISOString(),
      updatedAt: data?.updatedAt?.toDate()?.toISOString(),
    };

    return NextResponse.json(chatbot);
  } catch (error) {
    return handleApiError(error, 'GetChatbot');
  }
}

// PUT /api/chatbot/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // SECURITY: Require authentication for updates
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError();
    }
    const token = authHeader.substring(7);
    const adminAuth = await getFirebaseAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: 'Auth service unavailable' }, { status: 503 });
    }
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      throw new AuthenticationError('Invalid token');
    }

    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID du chatbot manquant' }, { status: 400 });
    }

    // Validate id format
    if (typeof id !== 'string' || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Format ID invalide' }, { status: 400 });
    }

    // Validation des données
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.model !== undefined) updateData.model = body.model;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.temperature !== undefined) updateData.temperature = parseFloat(body.temperature);
    if (body.maxTokens !== undefined) updateData.maxTokens = parseInt(body.maxTokens, 10);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    // Ajout de la date de mise à jour
    updateData.updatedAt = new Date();

    const docRef = getDb().collection('chatbots').doc(id);

    // Vérifier si le document existe
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Chatbot non trouvé' }, { status: 404 });
    }

    // SECURITY: Verify ownership — prevent unauthorized updates
    const docData = doc.data();
    if (docData?.userId && docData.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Chatbot non trouvé' }, { status: 404 });
    }

    // Mise à jour du document
    await docRef.update(updateData);

    // Récupérer le document mis à jour
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();

    const updatedChatbot = {
      id: updatedDoc.id,
      name: updatedData?.name || '',
      description: updatedData?.description || '',
      model: updatedData?.model || 'gpt-3.5-turbo',
      systemPrompt: updatedData?.systemPrompt || '',
      temperature: updatedData?.temperature ?? 0.7,
      maxTokens: updatedData?.maxTokens ?? 1000,
      isActive: updatedData?.isActive ?? true,
      conversationsCount: updatedData?.conversationsCount ?? 0,
      createdAt: updatedData?.createdAt?.toDate()?.toISOString(),
      updatedAt: updatedData?.updatedAt?.toDate()?.toISOString(),
    };

    return NextResponse.json(updatedChatbot);
  } catch (error) {
    return handleApiError(error, 'UpdateChatbotById');
  }
}
