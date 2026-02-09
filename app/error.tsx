'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Une erreur est survenue
        </h1>

        {/* Description */}
        <p className="text-gray-400 mb-6">
          Nous nous excusons pour ce désagrément. Veuillez réessayer ou retourner à l&apos;accueil.
        </p>

        {/* Error details (in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
            <p className="text-red-400 text-sm font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>

          <Link
            href="/"
            className="px-6 py-3 bg-[#1a1b2e] border border-purple-500/30 text-white font-medium rounded-xl hover:bg-purple-500/10 transition flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Link>
        </div>

        {/* Support link */}
        <p className="mt-8 text-sm text-gray-500">
          Si le problème persiste, contactez{' '}
          <a href="mailto:support@twinmcp.fr" className="text-purple-400 hover:underline">
            support@twinmcp.fr
          </a>
        </p>
      </div>
    </div>
  );
}
