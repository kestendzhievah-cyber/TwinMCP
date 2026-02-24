import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signupSchema, parseBody } from '@/lib/validations/api-schemas';
import { verifyRecaptcha } from '@/lib/utils/recaptcha';

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(signupSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { email, password, recaptchaToken } = parsed.data;

    // VÃ©rifier le token reCAPTCHA si fourni
    if (recaptchaToken) {
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return NextResponse.json(
          { error: 'VÃ©rification reCAPTCHA Ã©chouÃ©e' },
          { status: 400 }
        );
      }
    }

    // CrÃ©er l'utilisateur avec Firebase
    if (!auth) {
      return NextResponse.json(
        { error: 'Service d\'authentification non disponible' },
        { status: 503 }
      );
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Retourner les informations de l'utilisateur crÃ©Ã©
    const user = userCredential.user;

    return NextResponse.json({
      message: 'Compte crÃ©Ã© avec succÃ¨s',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
    });

  } catch (error: any) {
    logger.error('Erreur lors de l\'inscription:', error);

    // Gestion des erreurs Firebase
    let errorMessage = 'Erreur lors de l\'inscription';

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Cette adresse email est dÃ©jÃ  utilisÃ©e';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Adresse email invalide';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'L\'inscription par email n\'est pas activÃ©e';
        break;
      case 'auth/weak-password':
        errorMessage = 'Le mot de passe est trop faible';
        break;
      default:
        errorMessage = error.message || 'Erreur lors de l\'inscription';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
