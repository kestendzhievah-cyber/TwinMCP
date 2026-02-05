'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle, 
  Sparkles, 
  ArrowRight, 
  Loader2,
  Mail,
  Download,
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SessionData {
  status: string;
  paymentStatus: string;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
  metadata: {
    planId: string;
    billingPeriod: string;
    userId: string;
  } | null;
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Lancer les confettis au chargement
    const launchConfetti = () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#a855f7', '#3b82f6'],
      });
    };

    // Récupérer les détails de la session
    const fetchSessionData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/create-checkout-session?session_id=${sessionId}`);
        const data = await response.json();

        if (response.ok) {
          setSessionData(data);
          launchConfetti();
        } else {
          setError(data.error || 'Impossible de récupérer les détails');
        }
      } catch (err) {
        console.error('Erreur:', err);
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount || !currency) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getPlanName = (planId: string | undefined) => {
    const plans: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return plans[planId || ''] || 'Plan';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500 opacity-10 rounded-full filter blur-3xl"></div>
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
        <div className="bg-[#1a1b2e]/80 border border-green-500/30 rounded-2xl p-8 sm:p-12 text-center backdrop-blur-xl">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
              Paiement réussi !
            </span>
          </h1>

          <p className="text-gray-400 text-lg mb-8">
            Merci pour votre confiance. Votre abonnement est maintenant actif.
          </p>

          {/* Order Details */}
          {sessionData && (
            <div className="bg-[#0f1020] rounded-xl p-6 mb-8 text-left">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Détails de la commande
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                  <span className="text-gray-400">Plan</span>
                  <span className="font-semibold text-white">
                    {getPlanName(sessionData.metadata?.planId)} 
                    <span className="text-purple-400 ml-2 text-sm">
                      ({sessionData.metadata?.billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel'})
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                  <span className="text-gray-400">Montant</span>
                  <span className="font-semibold text-green-400 text-xl">
                    {formatAmount(sessionData.amountTotal, sessionData.currency)}
                  </span>
                </div>

                {sessionData.customerEmail && (
                  <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </span>
                    <span className="text-white">{sessionData.customerEmail}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Statut
                  </span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    Actif
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-8 text-left">
            <p className="text-sm text-purple-200">
              <strong>📧 Confirmation envoyée</strong><br />
              Un email de confirmation avec votre facture a été envoyé à votre adresse email.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2"
            >
              Accéder au Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/dashboard/invoices"
              className="px-8 py-3 bg-purple-500/20 text-white font-semibold rounded-xl hover:bg-purple-500/30 transition border border-purple-500/30 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Voir mes factures
            </Link>
          </div>
        </div>

        {/* Support Link */}
        <p className="text-center text-gray-500 mt-8 text-sm">
          Une question ? {' '}
          <Link href="/contact" className="text-purple-400 hover:text-purple-300 underline">
            Contactez notre support
          </Link>
        </p>
      </div>
    </div>
  );
}
