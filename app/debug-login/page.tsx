// app/debug-login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function DebugLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Debug Firebase
  useEffect(() => {
    console.log('🔍 Debug Firebase:');
    console.log('auth exists:', !!auth);
    console.log('auth config:', auth?.config);

    if (!auth) {
      setDebugInfo('❌ Firebase Auth non initialisé');
    } else if (!auth.config?.apiKey) {
      setDebugInfo('❌ Config Firebase invalide');
    } else {
      setDebugInfo('✅ Firebase OK');
    }
  }, []);

  const handleGoogleLogin = async () => {
    console.log('🔐 Tentative Google...');
    setError('');
    setLoading(true);

    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth!, googleProvider);
      console.log('✅ Google OK:', result.user);
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('❌ Erreur Google:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    console.log('🔐 Tentative de connexion...');
    setError('');
    setLoading(true);

    try {
      console.log('📧 Email:', email);
      const result = await signInWithEmailAndPassword(auth!, email, password);
      console.log('✅ Connexion réussie:', result.user);
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('❌ Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Connexion (Debug)</h1>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500 rounded text-sm text-blue-300">
          {debugInfo}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full mb-4 py-3 bg-white text-gray-900 font-semibold rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? 'Chargement...' : 'Google Login'}
        </button>

        {/* Email/Password */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full mb-3 px-4 py-3 bg-gray-700 text-white rounded"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full mb-4 px-4 py-3 bg-gray-700 text-white rounded"
        />

        <button
          onClick={handleEmailLogin}
          disabled={loading}
          className="w-full py-3 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Console Logs */}
        <div className="mt-4 text-xs text-gray-500">
          Ouvrez la console (F12) pour voir les logs détaillés
        </div>
      </div>
    </div>
  );
}
