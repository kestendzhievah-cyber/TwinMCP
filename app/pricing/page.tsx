'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Check, 
  Sparkles, 
  Zap, 
  Crown, 
  Building2,
  ArrowRight,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Plan {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Parfait pour débuter avec TwinMCP',
    icon: <Zap className="w-6 h-6" />,
    monthlyPrice: 9,
    yearlyPrice: 90,
    features: [
      '5 bibliothèques MCP',
      '1 000 requêtes/jour',
      'Support par email',
      'Documentation de base',
      'Intégrations limitées',
    ],
    cta: 'Commencer',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Pour les développeurs et équipes',
    icon: <Crown className="w-6 h-6" />,
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: [
      '25 bibliothèques MCP',
      '50 000 requêtes/jour',
      'Support prioritaire',
      'Documentation avancée',
      'Toutes les intégrations',
      'Analytics détaillés',
      'Webhooks personnalisés',
    ],
    highlighted: true,
    cta: 'Essai gratuit',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Solutions sur mesure pour entreprises',
    icon: <Building2 className="w-6 h-6" />,
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      'Bibliothèques illimitées',
      'Requêtes illimitées',
      'Support dédié 24/7',
      'SLA garanti 99.9%',
      'Déploiement on-premise',
      'Formation équipe',
      'API personnalisée',
      'Audit de sécurité',
    ],
    cta: 'Contacter',
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canceled = searchParams.get('canceled');

  const handleSelectPlan = async (planId: string) => {
    setError(null);
    setLoadingPlan(planId);

    try {
      if (planId === 'enterprise') {
        router.push('/contact?plan=enterprise');
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingPeriod,
          userId: user?.uid || null,
          userEmail: user?.email || null,
          userName: user?.displayName || null,
          mode: 'subscription',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (err: any) {
      console.error('Erreur checkout:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500 opacity-10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 opacity-10 rounded-full filter blur-3xl"></div>
      </div>

      <nav className="relative z-10 border-b border-purple-500/20 bg-[#1a1b2e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </Link>
            <div className="flex items-center gap-4">
              {user ? (
                <Link href="/dashboard" className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition">
                  Dashboard
                </Link>
              ) : (
                <Link href="/login" className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition">
                  Se connecter
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400">
              Tarifs simples et transparents
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Choisissez le plan qui correspond à vos besoins. Évoluez à tout moment.
          </p>

          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${billingPeriod === 'monthly' ? 'text-white' : 'text-gray-400'}`}>Mensuel</span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-16 h-8 bg-purple-900/50 rounded-full border border-purple-500/30 transition-colors"
            >
              <div className={`absolute top-1 w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-300 ${billingPeriod === 'yearly' ? 'left-9' : 'left-1'}`} />
            </button>
            <span className={`text-sm ${billingPeriod === 'yearly' ? 'text-white' : 'text-gray-400'}`}>
              Annuel
              <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">-17%</span>
            </span>
          </div>
        </div>

        {canceled && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-200">Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.</p>
            <button onClick={() => router.replace('/pricing')} className="ml-auto text-yellow-400 hover:text-yellow-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-purple-900/50 to-pink-900/30 border-2 border-pink-500/50 shadow-2xl shadow-pink-500/20 scale-105'
                  : 'bg-[#1a1b2e]/80 border border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full text-sm font-semibold">
                  Plus populaire
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-xl ${plan.highlighted ? 'bg-gradient-to-br from-pink-500 to-purple-600' : 'bg-purple-500/20'}`}>
                  {plan.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-gray-400">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}€</span>
                  <span className="text-gray-400">/{billingPeriod === 'monthly' ? 'mois' : 'an'}</span>
                </div>
                {billingPeriod === 'yearly' && (
                  <p className="text-sm text-green-400 mt-1">Économisez {plan.monthlyPrice * 12 - plan.yearlyPrice}€/an</p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 flex-shrink-0 ${plan.highlighted ? 'text-pink-400' : 'text-purple-400'}`} />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg shadow-pink-500/30'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-white border border-purple-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPlan === plan.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  <>
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-gray-400">
            Des questions ?{' '}
            <Link href="/contact" className="text-pink-400 hover:text-pink-300 underline">Contactez-nous</Link>
          </p>
          <p className="text-sm text-gray-500 mt-4">Paiement sécurisé par Stripe. Annulez à tout moment.</p>
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
        <p className="text-gray-400">Chargement des tarifs...</p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PricingContent />
    </Suspense>
  );
}
