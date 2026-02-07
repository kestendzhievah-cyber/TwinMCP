"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Sparkles, Chrome, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  // Fonction d'inscription avec email/password
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validation côté client
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setIsLoading(false);
      return;
    }

    try {
      await signUp(email, password);
      setSuccess('Compte créé avec succès ! Redirection...');

      // Petite pause pour montrer le message de succès
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      // Gestion améliorée des erreurs Firebase
      let errorMessage = 'Une erreur est survenue lors de l\'inscription';

      switch (err.code) {
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
          errorMessage = err.message || 'Erreur lors de l\'inscription';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction d'inscription avec Google
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await signInWithGoogle();
      setSuccess('Compte créé avec Google ! Redirection...');

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      let errorMessage = 'Erreur lors de l\'inscription Google';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Inscription annulée';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup bloqué par le navigateur';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'Un compte existe déjà avec cette adresse email';
          break;
        default:
          errorMessage = err.message || 'Erreur lors de l\'inscription Google';
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
            Rejoignez-nous !
          </h1>
          <p className="text-gray-400">
            Créez votre compte Corel.IA
          </p>
        </div>

        {/* Card d'inscription */}
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
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="w-full mb-6 py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Chrome className="w-5 h-5" />
            <span>Continuer avec Google</span>
          </button>

          {/* Séparateur */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-800/50 text-gray-400">
                Ou avec votre email
              </span>
            </div>
          </div>

          {/* Formulaire d'inscription */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
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
                  className="w-full pl-11 pr-4 py-3 bg-slate-700/50 border border-slate-600 text-white rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
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
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-slate-700/50 border border-slate-600 text-white rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Minimum 6 caractères</p>
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-slate-700/50 border border-slate-600 text-white rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                />
              </div>
            </div>

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-5 h-5" />
              <span>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Création du compte...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </span>
            </button>
          </form>

          {/* Lien connexion */}
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Déjà un compte ?{' '}
              <a href="/auth" className="text-purple-400 hover:text-purple-300 font-semibold transition">
                Se connecter
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          En créant votre compte, vous acceptez nos{' '}
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