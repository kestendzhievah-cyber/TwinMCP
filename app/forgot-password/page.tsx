"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Mail, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft,
  ArrowRight,
  Shield
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      if (!auth) {
        throw new Error('Firebase non initialisé. Veuillez configurer Firebase.');
      }
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
    } catch (err: any) {
      let errorMessage = 'Une erreur est survenue';
      switch (err.code) {
        case 'auth/user-not-found':
          // Don't reveal if user exists — show success anyway for security
          setSuccess(true);
          return;
        case 'auth/invalid-email':
          errorMessage = 'Adresse email invalide';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard';
          break;
        default:
          errorMessage = err.message || 'Erreur lors de l\'envoi de l\'email';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link 
            href="/auth"
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Retour à la connexion</span>
          </Link>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {success ? (
              <>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  Email envoyé !
                </h1>
                <p className="text-gray-500 text-center mb-6">
                  Si un compte existe avec l'adresse <strong className="text-gray-700">{email}</strong>, 
                  vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.
                </p>
                <p className="text-sm text-gray-400 text-center mb-6">
                  Vérifiez également votre dossier spam. Le lien expire dans 1 heure.
                </p>
                <Link
                  href="/auth"
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center justify-center gap-2"
                >
                  Retour à la connexion
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  Mot de passe oublié ?
                </h1>
                <p className="text-gray-500 text-center mb-8">
                  Entrez votre adresse email et nous vous enverrons un lien de réinitialisation.
                </p>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse email
                  </label>
                  <div className="relative mb-4">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Entrez votre adresse email"
                      required
                      autoFocus
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        Envoyer le lien
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Back to login */}
                <p className="mt-6 text-center text-gray-500">
                  Vous vous souvenez de votre mot de passe ?{' '}
                  <Link href="/auth" className="text-purple-600 hover:text-purple-700 font-semibold underline">
                    Se connecter
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Info */}
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
            Réinitialisation{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              sécurisée
            </span>
          </h2>
          <p className="text-gray-300 mb-10 flex items-center gap-2">
            <span className="w-6 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"></span>
            Récupérez l'accès à votre compte
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-white text-lg">Email de réinitialisation instantané</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-white text-lg">Lien sécurisé à usage unique</span>
            </div>
          </div>

          {/* Security Info */}
          <div className="mt-10 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Sécurité renforcée</p>
                <p className="text-gray-400 text-sm mt-1">
                  Pour votre sécurité, le lien de réinitialisation expire après 1 heure.
                  Si vous n'avez pas fait cette demande, ignorez simplement l'email.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
