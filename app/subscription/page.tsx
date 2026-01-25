"use client";

import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight, Zap, Shield, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const router = useRouter();

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '0',
      priceAnnual: '0',
      description: 'Parfait pour débuter',
      icon: Zap,
      features: [
        '3 serveurs MCP',
        '200 requêtes/jour',
        'Accès bibliothèque publique',
        'Support communauté',
        'Documentation complète'
      ],
      popular: false,
      color: 'from-blue-500 to-cyan-500',
      cta: 'Démarrer gratuitement',
      isContactSales: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '14.99',
      priceAnnual: '11.24',
      description: 'Le plus populaire',
      icon: Crown,
      features: [
        'Serveurs MCP illimités',
        '10 000 requêtes/jour',
        'Serveurs privés',
        'Support prioritaire 24/7',
        'Analytics avancés',
        'API complète',
        'Webhooks & intégrations'
      ],
      popular: true,
      color: 'from-purple-500 to-pink-500',
      cta: 'Essai gratuit 14 jours',
      isContactSales: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Sur devis',
      priceAnnual: 'Sur devis',
      description: 'Pour les équipes',
      icon: Shield,
      features: [
        'Tout du plan Pro',
        'Requêtes illimitées',
        'Serveurs MCP personnalisés',
        'Account manager dédié',
        'SLA 99.9%',
        'Déploiement on-premise',
        'Formation & onboarding',
        'White-label disponible'
      ],
      popular: false,
      color: 'from-amber-500 to-orange-500',
      cta: 'Contacter les ventes',
      isContactSales: true
    }
  ];

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    setIsLoading(true);
    
    // Simulate API call to save subscription choice
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirect to dashboard after selection
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">Corel.IA</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
              <span className="text-purple-300 text-sm font-semibold">🎉 Bienvenue chez Corel.IA !</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Choisissez Votre
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Abonnement</span>
            </h1>
            
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Sélectionnez le plan qui correspond à vos besoins. 
              Vous pouvez changer à tout moment.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium transition ${!isAnnual ? 'text-white' : 'text-gray-400'}`}>
                Mensuel
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative w-16 h-8 bg-slate-700 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <div
                  className={`w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-md transform transition-transform duration-300 ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`}
                />
              </button>
              <span className={`text-sm font-medium transition ${isAnnual ? 'text-white' : 'text-gray-400'}`}>
                Annuel
              </span>
              {isAnnual && (
                <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold rounded-full">
                  -25%
                </span>
              )}
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => {
              const IconComponent = plan.icon;
              const isSelected = selectedPlan === plan.id;
              
              return (
                <div
                  key={plan.id}
                  onClick={() => !isLoading && setSelectedPlan(plan.id)}
                  className={`relative p-8 rounded-2xl border cursor-pointer transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500 shadow-2xl shadow-purple-500/30 scale-105'
                      : isSelected
                      ? 'bg-gradient-to-br from-slate-800/80 to-purple-900/40 border-purple-400 shadow-xl shadow-purple-500/20'
                      : 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/70'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full">
                      Recommandé
                    </div>
                  )}

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* Plan Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${plan.color} flex items-center justify-center mb-6`}>
                    <IconComponent className="w-7 h-7 text-white" />
                  </div>

                  {/* Plan Info */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                    <div className="flex items-end">
                      {plan.isContactSales ? (
                        <span className="text-4xl font-bold text-white">Sur devis</span>
                      ) : (
                        <>
                          <span className="text-5xl font-bold text-white">
                            {isAnnual ? plan.priceAnnual : plan.price}€
                          </span>
                          <span className="text-gray-400 ml-2 mb-2">/mois</span>
                        </>
                      )}
                    </div>
                    {isAnnual && !plan.isContactSales && plan.id !== 'free' && (
                      <p className="text-green-400 text-sm mt-2">
                        Économisez {Math.round((parseFloat(plan.price) - parseFloat(plan.priceAnnual)) * 12)}€/an
                      </p>
                    )}
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start">
                        <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Select Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (plan.isContactSales) {
                        router.push('/contact');
                      } else {
                        handleSelectPlan(plan.id);
                      }
                    }}
                    disabled={isLoading && !plan.isContactSales}
                    className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading && selectedPlan === plan.id ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      plan.cta
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-16 text-center">
            <p className="text-gray-400 text-sm mb-4">
              ✓ Essai gratuit de 14 jours • ✓ Aucune carte de crédit requise • ✓ Annulation à tout moment
            </p>
            <p className="text-gray-500 text-xs">
              En continuant, vous acceptez nos{' '}
              <a href="/terms" className="text-purple-400 hover:text-purple-300 underline">
                Conditions d'utilisation
              </a>{' '}
              et notre{' '}
              <a href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
                Politique de confidentialité
              </a>
            </p>
          </div>

          {/* Skip Option */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition text-sm underline underline-offset-4"
            >
              Passer cette étape et choisir plus tard
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>© 2025 Corel.IA. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
