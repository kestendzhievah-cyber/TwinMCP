'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  XCircle, 
  Sparkles, 
  ArrowLeft, 
  RefreshCw,
  MessageCircle,
  HelpCircle,
  Loader2
} from 'lucide-react';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');

  const getPlanName = (id: string | null) => {
    const plans: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return plans[id || ''] || 'sélectionné';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 opacity-10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 opacity-10 rounded-full filter blur-3xl"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-purple-500/20 bg-[#1a1b2e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-16 sm:py-24">
        <div className="bg-[#1a1b2e]/80 border border-orange-500/30 rounded-2xl p-8 sm:p-12 text-center backdrop-blur-xl">
          {/* Cancel Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
            <XCircle className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              Paiement annulé
            </span>
          </h1>

          <p className="text-gray-400 text-lg mb-8">
            Votre paiement pour le plan {getPlanName(planId)} n'a pas été finalisé.
            <br />
            Aucun montant n'a été débité de votre compte.
          </p>

          {/* Reasons Box */}
          <div className="bg-[#0f1020] rounded-xl p-6 mb-8 text-left">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Pourquoi annuler ?
            </h3>
            
            <div className="space-y-3">
              <p className="text-gray-300 text-sm">
                Si vous avez rencontré un problème ou si vous avez des questions, nous sommes là pour vous aider :
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  Besoin de plus d'informations sur nos plans ?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  Des questions sur les fonctionnalités ?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  Problème technique lors du paiement ?
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </Link>

            <Link
              href="/contact"
              className="px-8 py-3 bg-purple-500/20 text-white font-semibold rounded-xl hover:bg-purple-500/30 transition border border-purple-500/30 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Nous contacter
            </Link>
          </div>

          {/* Back to home */}
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mt-8 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>

        {/* Reassurance */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            🔒 Vos informations de paiement n'ont pas été enregistrées.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Vous pouvez revenir à tout moment pour finaliser votre abonnement.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Chargement...</p>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
