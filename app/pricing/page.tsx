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
  AlertCircle,
  Server,
  Star
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: string | null;
  priceAnnual: string | null;
  features: string[];
  popular?: boolean;
  badge?: string;
  cta: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Parfait pour débuter',
    priceMonthly: '0',
    priceAnnual: '0',
    features: [
      '3 serveurs MCP',
      '200 requêtes/jour',
      'Accès bibliothèque publique',
      'Support communauté',
      'Documentation complète'
    ],
    cta: 'Démarrer gratuitement',
    popular: false
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Le plus populaire',
    priceMonthly: '14.99',
    priceAnnual: '11.24',
    features: [
      'Serveurs MCP illimités',
      'Création MCP personnalisée',
      '10 000 requêtes/jour',
      'Serveurs privés',
      'Support prioritaire 24/7',
      'Analytics avancés',
      'API complète',
      'Webhooks & intégrations'
    ],
    cta: 'Essai gratuit 14 jours',
    popular: true,
    badge: 'ESSAI GRATUIT'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Pour les équipes',
    priceMonthly: null,
    priceAnnual: null,
    features: [
      'Tout du plan Pro',
      'Requêtes illimitées',
      'Serveurs MCP sur-mesure',
      'Account manager dédié',
      'SLA 99.9%',
      'Déploiement on-premise',
      'Formation & onboarding',
      'White-label disponible'
    ],
    cta: 'Contacter les ventes',
    popular: false
  }
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canceled = searchParams.get('canceled');

  const handleSelectPlan = async (planId: string) => {
    setError(null);
    setLoadingPlan(planId);

    try {
      // Free plan - redirect to dashboard or signup
      if (planId === 'free') {
        if (user) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
        return;
      }

      // Enterprise - redirect to contact
      if (planId === 'enterprise') {
        router.push('/contact?plan=enterprise');
        return;
      }

      // Professional - create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingPeriod: isAnnual ? 'yearly' : 'monthly',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 opacity-10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500 opacity-10 rounded-full filter blur-3xl"></div>
      </div>

      {/* Navigation - Same as landing page */}
      <nav className="relative z-50 py-4 px-4 md:px-8 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">TwinMCP</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/#features" className="text-gray-300 hover:text-white transition">Fonctionnalités</Link>
            <Link href="/#compare" className="text-gray-300 hover:text-white transition">Comparatif</Link>
            <Link href="/pricing" className="text-white font-semibold">Tarifs</Link>
            <Link href="/#testimonials" className="text-gray-300 hover:text-white transition">Témoignages</Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <Link 
                href="/dashboard"
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/auth" className="text-gray-300 hover:text-white transition">
                  Connexion
                </Link>
                <Link
                  href="/auth"
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30"
                >
                  Essai Gratuit
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">
              Tarifs Transparents
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Choisissez le plan qui correspond à vos besoins. Changez à tout moment.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-lg ${!isAnnual ? 'text-white font-semibold' : 'text-gray-400'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
                isAnnual ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                isAnnual ? 'translate-x-9' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-lg ${isAnnual ? 'text-white font-semibold' : 'text-gray-400'}`}>
              Annuel
            </span>
            {isAnnual && (
              <span className="ml-2 px-3 py-1 bg-green-500/20 text-green-400 text-sm font-semibold rounded-full">
                -25% d'économie
              </span>
            )}
          </div>
        </div>

        {/* Canceled Alert */}
        {canceled && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.
            </p>
            <button 
              onClick={() => router.replace('/pricing')}
              className="ml-auto text-yellow-400 hover:text-yellow-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-200">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500 shadow-2xl shadow-purple-500/30 md:scale-105 md:-mt-4'
                  : 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full">
                  Le plus populaire
                </div>
              )}

              {plan.badge && (
                <div className="absolute -top-3 -right-3 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-lg shadow-green-500/50">
                  {plan.badge}
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-end justify-center">
                  {plan.priceMonthly !== null ? (
                    <>
                      <span className="text-5xl font-bold text-white">
                        {isAnnual ? plan.priceAnnual : plan.priceMonthly}€
                      </span>
                      <span className="text-gray-400 ml-2 mb-2">/mois</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-white">Sur devis</span>
                  )}
                </div>
                {isAnnual && plan.priceMonthly !== null && plan.priceMonthly !== '0' && (
                  <p className="text-green-400 text-sm mt-2">
                    Facturé {(parseFloat(plan.priceAnnual!) * 12).toFixed(0)}€/an
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className={`w-5 h-5 ${
                      plan.popular ? 'text-green-400' : 'text-purple-400'
                    } mr-3 flex-shrink-0 mt-0.5`} />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
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
                    {plan.id !== 'enterprise' && <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-20 text-center">
          <p className="text-gray-400">
            Des questions ?{' '}
            <Link href="/contact" className="text-purple-400 hover:text-purple-300 underline">
              Contactez-nous
            </Link>
          </p>
          <p className="text-sm text-gray-500 mt-4">
            🔒 Paiement sécurisé par Stripe. Annulez à tout moment.
          </p>
        </div>
      </div>

      {/* Footer - Same style as landing page */}
      <footer className="relative z-10 border-t border-white/10 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} TwinMCP. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center">
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
