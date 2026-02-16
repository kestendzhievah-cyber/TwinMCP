import { NextRequest, NextResponse } from 'next/server';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Fonction de vérification reCAPTCHA
async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // En développement, saute la vérification si la clé commence par 'dev-skip'
  if (process.env.NODE_ENV === 'development' && secretKey?.startsWith('dev-skip')) {
    console.log('[DEV] reCAPTCHA verification skipped');
    return true;
  }

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY is not configured');
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
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return false;
    }
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, recaptchaToken } = body;

    // Vérifier que les champs obligatoires sont présents
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe sont requis' },
        { status: 400 }
      );
    }

    // Vérifier le token reCAPTCHA si fourni
    if (recaptchaToken) {
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!isRecaptchaValid) {
        return NextResponse.json(
          { error: 'Vérification reCAPTCHA échouée' },
          { status: 400 }
        );
      }
    }

    // Authentifier l'utilisateur avec Firebase
    if (!auth) {
      return NextResponse.json(
        { error: 'Service d\'authentification non disponible' },
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
    console.error('Erreur lors de la connexion:', error);

    // Gestion des erreurs Firebase
    let errorMessage = 'Erreur lors de la connexion';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Aucun compte trouvé avec cette adresse email';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Mot de passe incorrect';
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
      default:
        errorMessage = error.message || 'Erreur lors de la connexion';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    );
  }
}
