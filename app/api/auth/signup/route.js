"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const auth_1 = require("firebase/auth");
const firebase_1 = require("@/lib/firebase");
// Fonction de vérification reCAPTCHA
async function verifyRecaptcha(token) {
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
        }
        else {
            console.error('reCAPTCHA verification failed:', data['error-codes']);
            return false;
        }
    }
    catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        return false;
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { email, password, confirmPassword, recaptchaToken } = body;
        // Vérifier que tous les champs sont présents
        if (!email || !password || !confirmPassword || !recaptchaToken) {
            return server_1.NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
        }
        // Vérifier que les mots de passe correspondent
        if (password !== confirmPassword) {
            return server_1.NextResponse.json({ error: 'Les mots de passe ne correspondent pas' }, { status: 400 });
        }
        // Vérifier la longueur du mot de passe
        if (password.length < 6) {
            return server_1.NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 });
        }
        // Vérifier le token reCAPTCHA
        const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
        if (!isRecaptchaValid) {
            return server_1.NextResponse.json({ error: 'Vérification reCAPTCHA échouée' }, { status: 400 });
        }
        // Créer l'utilisateur avec Firebase
        const userCredential = await (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, email, password);
        // Retourner les informations de l'utilisateur créé
        const user = userCredential.user;
        return server_1.NextResponse.json({
            message: 'Compte créé avec succès',
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                emailVerified: user.emailVerified,
            },
        });
    }
    catch (error) {
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
        return server_1.NextResponse.json({ error: errorMessage }, { status: 400 });
    }
}
//# sourceMappingURL=route.js.map