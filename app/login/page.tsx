"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Mail, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  FileText,
  Settings,
  Shield,
  Zap,
  Code2,
  Github
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [password, setPassword] = useState('');

  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithGithub, rememberMe, user, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(email, password);
      setSuccess('Connexion réussie ! Redirection...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      let errorMessage = 'Une erreur est survenue';
      switch (err.code) {
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
          errorMessage = err.message || 'Identifiants incorrects';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signInWithGoogle(rememberMe);
      setSuccess('Connexion réussie ! Redirection...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      let errorMessage = 'Erreur lors de la connexion Google';
      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Connexion annulée';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup bloqué par le navigateur';
          break;
        default:
          errorMessage = err.message || 'Erreur lors de la connexion Google';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signInWithGithub(rememberMe);
      setSuccess('Connexion réussie ! Redirection...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      let errorMessage = 'Erreur lors de la connexion GitHub';
      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Connexion annulée';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup bloqué par le navigateur';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'Un compte existe déjà avec cette adresse email';
          break;
        default:
          errorMessage = err.message || 'Erreur lors de la connexion GitHub';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <FileText className="w-5 h-5" />,
      text: "Accédez à vos bibliothèques MCP"
    },
    {
      icon: <Settings className="w-5 h-5" />,
      text: "Gérez vos configurations"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      text: "Sécurité renforcée"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      text: "Performance optimale"
    },
    {
      icon: <Code2 className="w-5 h-5" />,
      text: "API complète"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Retour à l'accueil</span>
          </Link>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Connexion à TwinMCP
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Bon retour ! Connectez-vous pour continuer
            </p>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}

            {/* Google Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full mb-3 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continuer avec Google</span>
            </button>

            {/* GitHub Button */}
            <button
              onClick={handleGithubLogin}
              disabled={isLoading}
              className="w-full mb-6 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Github className="w-5 h-5" />
              <span>Continuer avec GitHub</span>
            </button>

            {/* Separator */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400">ou</span>
              </div>
            </div>

            {/* Email Form */}
            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Entrez votre adresse email"
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition mb-4"
                />
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit}>
                <div className="mb-4 p-3 bg-purple-50 rounded-xl">
                  <p className="text-sm text-purple-700">
                    <Mail className="w-4 h-4 inline mr-2" />
                    {email}
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition mb-2"
                />
                <div className="flex justify-end mb-4">
                  <Link href="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full mt-2 py-2 text-gray-500 hover:text-gray-700 text-sm transition"
                >
                  ← Retour
                </button>
              </form>
            )}

            {/* Signup Link */}
            <p className="mt-6 text-center text-gray-500">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                Créer un compte
              </Link>
            </p>
          </div>

          {/* Terms */}
          <p className="mt-6 text-center text-sm text-gray-400">
            En continuant, vous acceptez nos{' '}
            <Link href="/terms" className="text-purple-400 hover:text-purple-300 underline">
              Conditions d'utilisation
            </Link>
            {' '}et{' '}
            <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
              Politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Right Side - Features */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 text-9xl font-bold text-purple-300">T</div>
          <div className="absolute top-40 right-32 text-8xl font-bold text-purple-300">7</div>
          <div className="absolute bottom-32 left-40 text-7xl font-bold text-purple-300">M</div>
          <div className="absolute bottom-20 right-20 text-6xl font-bold text-purple-300">C</div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold text-white mb-2">
            Bon retour sur{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              TwinMCP
            </span>
          </h2>
          <p className="text-gray-300 mb-10 flex items-center gap-2">
            <span className="w-6 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"></span>
            Accédez à votre espace personnel
          </p>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                  {feature.icon}
                </div>
                <span className="text-white text-lg">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
