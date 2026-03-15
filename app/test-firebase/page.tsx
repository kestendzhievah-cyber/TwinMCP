// app/test-firebase/page.tsx
// SECURITY: This debug page is only available in development.
// In production it redirects to the home page.
'use client';

import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';

const IS_DEV = process.env.NODE_ENV !== 'production';

export default function TestFirebase() {
  if (!IS_DEV) {
    redirect('/');
  }

  const [status, setStatus] = useState('Testing...');

  useEffect(() => {
    // Dynamic import to avoid loading Firebase in production
    import('@/lib/firebase').then(({ auth, db }) => {
      // Test 1: Firebase initialisé ?
      if (!auth) {
        setStatus('Auth non initialisé');
        return;
      }

      // Test 2: Config présente ?
      const config = (auth as any).config;
      if (!config?.apiKey) {
        setStatus('Config Firebase manquante');
        return;
      }

      // Test 3: Firestore accessible ?
      if (!db) {
        setStatus('Firestore non initialisé');
        return;
      }

      setStatus('Firebase correctement configuré !');
    }).catch(() => {
      setStatus('Erreur lors du chargement Firebase');
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-white mb-4">Test Firebase (dev only)</h1>
        <p className="text-white">{status}</p>
      </div>
    </div>
  );
}
