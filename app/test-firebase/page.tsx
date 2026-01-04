// app/test-firebase/page.tsx
'use client';

import { auth, db } from '@/lib/firebase';
import { useEffect, useState } from 'react';

export default function TestFirebase() {
  const [status, setStatus] = useState('Testing...');

  useEffect(() => {
    // Test 1: Firebase initialisé ?
    if (!auth) {
      setStatus('❌ Auth non initialisé');
      return;
    }

    // Test 2: Config présente ?
    const config = (auth as any).config;
    if (!config || !config.apiKey) {
      setStatus('❌ Config Firebase manquante');
      return;
    }

    // Test 3: Firestore accessible ?
    if (!db) {
      setStatus('❌ Firestore non initialisé');
      return;
    }

    setStatus('✅ Firebase correctement configuré !');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-white mb-4">Test Firebase</h1>
        <p className="text-white">{status}</p>
        <div className="mt-4 text-sm text-gray-400">
          <p>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}</p>
          <p>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</p>
        </div>
      </div>
    </div>
  );
}
