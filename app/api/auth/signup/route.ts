import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Fonction de vÃ©rification reCAPTCHA
async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // En dÃ©veloppement, saute la vÃ©rification si la clÃ© commence par 'dev-skip'
  if (process.env.NODE_ENV === 'development' && secretKey?.startsWith('dev-skip')) {
    logger.info('[DEV] reCAPTCHA verification skipped');
    return true;
  }

  if (!secretKey) {
    logger.error('RECAPTCHA_SECRET_KEY is not configured');
    return false;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (data.success && data.score >= 0.5) {
      return true;
    } else {
      logger.error('reCAPTCHA verification failed:', data['error-codes']);
      return false;
    }
  } catch (error) {
    logger.error('Error verifying reCAPTCHA:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, confirmPassword, recaptchaToken } = body;

    // VÃ©rifier que les champs obligatoires sont prÃ©sents
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe sont requis' },
        { status: 400 }
      );
    }

    // VÃ©rifier que les mots de passe correspondent (si confirmPassword fourni)
    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Les mots de passe ne correspondent pas' },
        { status: 400 }
      );
    }

    // VÃ©rifier la longueur du mot de passe
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractÃ¨res' },
        { status: 400 }
      );
    }

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
