"use client";

import React, { useState } from 'react';
import { Check, Zap, Crown, Rocket, ArrowRight, X } from 'lucide-react';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      icon: Zap,
      description: 'Parfait pour tester',
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        '1 agent IA',
        '1 000 conversations/mois',
        'Modèles basiques (GPT-3.5)',
        'Support email sous 48h',
        'Analytics basiques',
        'API REST',
      ],
      limitations: [
        'Pas de modèles avancés',
        'Pas d\'intégrations CRM',
        'Pas de support prioritaire'
      ],
      cta: 'Démarrer gratuitement',
      popular: false,
      color: 'blue'
    },
    {
      id: 'professional',
      name: 'Professional',
      icon: Crown,
      description: 'Le plus populaire',
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: [
        '5 agents IA',
        '10 000 conversations/mois',
        'Tous les modèles (GPT-4, Claude, Gemini)',
        'Support prioritaire 24/7',
        'Analytics avancés + exports',
        'Intégrations CRM (Salesforce, HubSpot)',
        'API complète + webhooks',
        'A/B testing intégré',
        'Formation personnalisée',
      ],
      limitations: [],
      cta: 'Essai gratuit 14 jours',
      popular: true,
      color: 'purple'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      icon: Rocket,
      description: 'Pour les équipes',
      monthlyPrice: 499,
      yearlyPrice: 4990,
      features: [
        'Agents illimités',
        'Conversations illimitées',
        'Tous les modèles + Custom AI',
        'Account manager dédié',
        'SLA 99.9% garanti',
        'Intégrations sur-mesure',
        'Formation & onboarding complet',
        'White-label disponible',
        'Hébergement dédié (optionnel)',
        'Audit de sécurité',
      ],
      limitations: [],
      cta: 'Contacter les ventes',
      popular: false,
      color: 'pink'
    }
  ];

  const handleSubscribe = async (planId: string) => {
    setIsLoading(true);
    
    try {
      // Map plan IDs to Stripe price IDs
      const priceIds = {
        starter: billingPeriod === 'monthly' ? 'price_starter_monthly_id' : 'price_starter_yearly_id',
        professional: billingPeriod === 'monthly' ? 'price_professional_monthly_id' : 'price_professional_yearly_id',
        enterprise: billingPeriod === 'monthly' ? 'price_enterprise_monthly_id' : 'price_enterprise_yearly_id',
      };

      const priceId = priceIds[planId as keyof typeof priceIds];

      if (!priceId) {
        alert('Erreur: Price ID non trouvé');
        return;
      }

      // Appel API pour créer une session Stripe
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: 'user_123', // À remplacer par l'ID réel de l'utilisateur
          userEmail: 'user@example.com' // À remplacer par l'email réel
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Erreur lors de la création de la session');
      }
    } catch (error) {
      console.error('Erreur lors de la création de la session:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPrice = (plan: typeof plans[0]) => {
    return billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    if (billingPeriod === 'yearly') {
      const monthlyCost = plan.monthlyPrice * 12;
      const yearlyCost = plan.yearlyPrice;
      const savings = monthlyCost - yearlyCost;
      return `Économisez ${savings}€/an`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Zap className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">Corel.IA</span>
            </div>
            <div className="flex space-x-4">
              <button className="px-4 py-2 text-white hover:text-purple-400 transition">
                Connexion
              </button>
              <button className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                Essai Gratuit
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Tarifs Simples et Transparents
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Choisissez le plan qui correspond à vos besoins. Changez à tout moment.
          </p>

          {/* Toggle Billing Period */}
          <div className="inline-flex items-center bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-lg p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md transition ${
                billingPeriod === 'monthly'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-md transition ${
                billingPeriod === 'yearly'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annuel
              <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-8 rounded-2xl border transition-all hover:scale-105 ${
                plan.popular
                  ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500 shadow-2xl shadow-purple-500/30'
                  : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full">
                  Le plus populaire
                </div>
              )}

              <div className="text-center mb-6">
                <plan.icon className={`w-12 h-12 text-${plan.color}-400 mx-auto mb-4`} />
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                
                <div className="mb-2">
                  <span className="text-5xl font-bold text-white">{getPrice(plan)}€</span>
                  <span className="text-gray-400 ml-2">
                    /{billingPeriod === 'monthly' ? 'mois' : 'an'}
                  </span>
                </div>
                
                {getSavings(plan) && (
                  <div className="text-green-400 text-sm font-semibold">
                    {getSavings(plan)}
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
                {plan.limitations.length > 0 && (
                  <>
                    <li className="pt-3 border-t border-slate-700" />
                    {plan.limitations.map((limitation, index) => (
                      <li key={index} className="flex items-start">
                        <X className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-500">{limitation}</span>
                      </li>
                    ))}
                  </>
                )}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading}
                className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                }`}
              >
                {isLoading ? 'Chargement...' : plan.cta}
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Questions Fréquentes
          </h2>
          
          <div className="space-y-4">
            {[
              {
                q: 'Puis-je changer de plan à tout moment ?',
                a: 'Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements prennent effet immédiatement avec un prorata.'
              },
              {
                q: 'Que se passe-t-il si je dépasse ma limite de conversations ?',
                a: 'Vous recevrez une notification à 80% et 100%. Au-delà, chaque conversation supplémentaire coûte 0.10€. Vous pouvez aussi upgrader votre plan.'
              },
              {
                q: 'Y a-t-il un engagement de durée ?',
                a: 'Non, tous nos plans sont sans engagement. Vous pouvez annuler à tout moment et continuer à utiliser le service jusqu\'à la fin de la période payée.'
              },
              {
                q: 'Les prix incluent-ils les frais API ?',
                a: 'Oui, tous les coûts API (OpenAI, Claude, Gemini) sont inclus dans votre abonnement. Pas de surprise sur votre facture.'
              }
            ].map((faq, index) => (
              <div key={index} className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
                <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 text-center">
          <div className="inline-block p-8 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">
              Pas encore convaincu ?
            </h3>
            <p className="text-gray-300 mb-6">
              Essayez gratuitement pendant 14 jours, aucune carte bancaire requise.
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-xl shadow-purple-500/50">
              Démarrer l'essai gratuit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}