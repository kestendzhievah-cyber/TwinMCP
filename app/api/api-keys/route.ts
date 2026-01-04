import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '../../../../lib/firebase-admin';

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'tmcp_sk_';
  const randomBytes = Array.from({ length: 32 }, () => 
    Math.random().toString(36).substring(2, 15)
  ).join('');
  return prefix + randomBytes;
}

export async function GET(request: NextRequest) {
  try {
    // Get the user from the token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Fetch user's API keys from Firestore
    const apiKeysSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('apiKeys')
      .orderBy('createdAt', 'desc')
      .get();

    const apiKeys = apiKeysSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      key: doc.data().key,
      createdAt: doc.data().createdAt,
      lastUsed: doc.data().lastUsed || null,
    }));

    return NextResponse.json({ apiKeys });
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des clés API' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the user from the token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get the key name from request body
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nom de la clé requis et doit être une chaîne de caractères' },
        { status: 400 }
      );
    }

    // Check if user already has too many API keys (limit: 10 per user)
    const existingKeysSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('apiKeys')
      .get();

    if (existingKeysSnapshot.size >= 10) {
      return NextResponse.json(
        { error: 'Limite de 10 clés API atteinte' },
        { status: 400 }
      );
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const apiKeyData = {
      name: name.trim(),
      key: apiKey,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };

    // Save to Firestore
    const docRef = await db
      .collection('users')
      .doc(uid)
      .collection('apiKeys')
      .add(apiKeyData);

    // Return the created API key (only show the full key once)
    return NextResponse.json({
      id: docRef.id,
      name: apiKeyData.name,
      key: apiKeyData.key,
      createdAt: apiKeyData.createdAt,
      lastUsed: apiKeyData.lastUsed,
    });
  } catch (error: any) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la clé API' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the user from the token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get the key ID from request body
    const { keyId } = await request.json();
    if (!keyId || typeof keyId !== 'string') {
      return NextResponse.json(
        { error: 'ID de la clé requis' },
        { status: 400 }
      );
    }

    // Delete the API key from Firestore
    await db
      .collection('users')
      .doc(uid)
      .collection('apiKeys')
      .doc(keyId)
      .delete();

    return NextResponse.json({ message: 'Clé API supprimée avec succès' });
  } catch (error: any) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la clé API' },
      { status: 500 }
    );
  }
}
