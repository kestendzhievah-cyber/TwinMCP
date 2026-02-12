import { NextRequest, NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
    const { email, password, confirmPassword, recaptchaToken } = body;

    // Vérifier que tous les champs sont présents
    if (!email || !password || !confirmPassword || !recaptchaToken) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Les mots de passe ne correspondent pas' },
        { status: 400 }
      );
    }

    // Vérifier la longueur du mot de passe
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Vérifier le token reCAPTCHA
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return NextResponse.json(
        { error: 'Vérification reCAPTCHA échouée' },
        { status: 400 }
      );
    }

    // Créer l'utilisateur avec Firebase
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Retourner les informations de l'utilisateur créé
    const user = userCredential.user;

    return NextResponse.json({
      message: 'Compte créé avec succès',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
    });

  } catch (error: any) {
    console.error('Erreur lors de l\'inscription:', error);

    // Gestion des erreurs Firebase
    let errorMessage = 'Erreur lors de l\'inscription';

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Cette adresse email est déjà utilisée';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Adresse email invalide';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'L\'inscription par email n\'est pas activée';
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
