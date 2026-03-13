import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { loginSchema, parseBody } from '@/lib/validations/api-schemas';
import { verifyRecaptcha } from '@/lib/utils/recaptcha';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(loginSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { email, password, recaptchaToken } = parsed.data;

    // Vérifier le token reCAPTCHA si fourni
    if (recaptchaToken) {
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return NextResponse.json({ error: 'Vérification reCAPTCHA échouée' }, { status: 400 });
      }
    }

    // Authentifier l'utilisateur avec Firebase
    if (!auth) {
      return NextResponse.json(
        { error: "Service d'authentification non disponible" },
        { status: 503 }
      );
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Retourner les informations de l'utilisateur (sans le mot de passe)
    const user = userCredential.user;

    return NextResponse.json({
      message: 'Connexion réussie',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error: any) {
    // Firebase auth errors have a .code property — map to user-friendly messages
    if (error?.code?.startsWith('auth/')) {
      let errorMessage = 'Erreur lors de la connexion';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'Email ou mot de passe incorrect';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Adresse email invalide';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Ce compte a été désactivé';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard';
          break;
      }
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    return handleApiError(error, 'AuthLogin');
  }
}
