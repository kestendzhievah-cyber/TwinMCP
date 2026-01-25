"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Sparkles, Chrome, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  // Fonction de connexion avec email/password
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await signIn(email, password);
      setSuccess('Connexion réussie ! Redirection...');

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      let errorMessage = 'Erreur lors de la connexion';

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

  // Fonction de connexion avec Google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await signInWithGoogle();
      setSuccess('Connexion Google réussie ! Redirection...');

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      let errorMessage = 'Erreur lors de la connexion Google';

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
          errorMessage = err.message || 'Erreur lors de la connexion Google';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Bouton Retour */}
      <a
        href="/"
        className="absolute top-8 left-8 flex items-center space-x-2 text-gray-400 hover:text-white transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Retour</span>
      </a>

      <div className="w-full max-w-md">
        {/* Logo & Titre */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Sparkles className="w-16 h-16 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Bon retour !
          </h1>
          <p className="text-gray-400">
            Connectez-vous à votre compte Corel.IA
          </p>
        </div>

        {/* Card de connexion */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-2xl p-8">

          {/* Messages d'erreur/succès */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Bouton Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full mb-6 py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Chrome className="w-5 h-5" />
            <span>Continuer avec Google</span>
          </button>

          {/* Séparateur */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center mt-2">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-800/50 text-gray-400 -mt-4">
                Ou avec votre email
              </span>
            </div>
          </div>

          {/* Formulaire Email/Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-700/50 border border-slate-600 text-black rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-700/50 border border-slate-600 text-black rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                />
              </div>
            </div>

            {/* Mot de passe oublié */}
            <div className="flex justify-end">
              <a href="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 transition">
                Mot de passe oublié ?
              </a>
            </div>

            {/* Bouton Connexion avec reCAPTCHA */}
            <button
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Connexion...</span>
                </div>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Lien inscription */}
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Pas encore de compte ?{' '}
              <a href="/signup" className="text-purple-400 hover:text-purple-300 font-semibold transition">
                Créer un compte
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          En vous connectant, vous acceptez nos{' '}
          <a href="/terms" className="text-purple-400 hover:text-purple-300">
            Conditions d'utilisation
          </a>
          {' '}et notre{' '}
          <a href="/privacy" className="text-purple-400 hover:text-purple-300">
            Politique de confidentialité
          </a>
        </p>
      </div>
    </div>
  );
}
