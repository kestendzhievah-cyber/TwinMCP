"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Zap, TrendingUp, Shield, Check, ArrowRight, Sparkles, Users, Clock, DollarSign, Code2, Library, Boxes, Workflow } from 'lucide-react';

export default function AgentFlowLanding() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [isAnnual, setIsAnnual] = useState(false);

  // Handler for plan selection/signup
  const handlePlanClick = (planName: string) => {
    const billing = isAnnual ? 'annual' : 'monthly';
    const planMap: { [key: string]: string } = {
      'Free': `/signup?plan=free&billing=${billing}`,
      'Professional': `/signup?plan=professional&billing=${billing}`,
      'Enterprise': `/signup?plan=enterprise&billing=${billing}`
    };
    router.push(planMap[planName] || '/signup');
  };

  // Handler for "Contacter les ventes" (Enterprise)
  const handleContactSales = () => {
    router.push('/contact');
  };

  // Handler for demo - scroll vers la section features pour montrer les fonctionnalités
  const handleDemo = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handler for free trial / login
  const handleFreeTrialOrLogin = () => {
    router.push('/signup');
  };

  const stats = [
    { icon: Users, value: '5,000+', label: 'Développeurs actifs' },
    { icon: Library, value: '500+', label: 'Serveurs MCP créés' },
    { icon: Code2, value: '95%', label: 'Temps de dev économisé' },
    { icon: Workflow, value: '10x', label: 'Plus rapide' }
  ];

  const features = [
    {
      icon: Code2,
      title: 'Création Simplifiée',
      description: 'Créez vos serveurs MCP en quelques clics avec notre interface intuitive'
    },
    {
      icon: Library,
      title: 'Bibliothèque Complète',
      description: 'Accédez à des centaines de serveurs MCP prêts à l\'emploi'
    },
    {
      icon: Boxes,
      title: 'Intégration Facile',
      description: 'Connectez vos serveurs MCP à n\'importe quelle application en quelques lignes'
    },
    {
      icon: Shield,
      title: 'Sécurité & Fiabilité',
      description: 'Infrastructure sécurisée, monitoring 24/7, conformité RGPD'
    }
  ];

  const plans = [
    {
      name: 'Free',
      priceMonthly: '0',
      priceAnnual: '0',
      description: 'Parfait pour débuter',
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
      name: 'Professional',
      priceMonthly: '14.99',
      priceAnnual: '11.24',
      description: 'Le plus populaire',
      features: [
        'Serveurs MCP illimités',
        '10 000 requêtes/jour',
        'Serveurs privés',
        'Support prioritaire 24/7',
        'Analytics avancés',
        'API complète',
        'Webhooks & intégrations'
      ],
      cta: 'Essai gratuit 14 jours',
      popular: true
    },
    {
      name: 'Enterprise',
      priceMonthly: null,
      priceAnnual: null,
      description: 'Pour les équipes',
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
      cta: 'Contacter les ventes',
      popular: false
    }
  ];

  const testimonials = [
    {
      company: 'DevStudio',
      author: 'Marc Lefebvre, CTO',
      content: 'TwinMCP a transformé notre workflow. Nous créons des serveurs MCP en minutes au lieu de jours. La bibliothèque est une mine d\'or.',
      savings: '200h de dev économisées/mois'
    },
    {
      company: 'AI Solutions',
      author: 'Sophie Bernard, Lead Dev',
      content: 'L\'intégration MCP n\'a jamais été aussi simple. Nos clients adorent la flexibilité et la rapidité de déploiement.',
      savings: '10x plus rapide'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition">Fonctionnalités</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition">Tarifs</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition">Témoignages</a>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-white hover:text-purple-400 transition">
                Connexion
              </button>
              <button 
                onClick={handleFreeTrialOrLogin}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50">
                Essai Gratuit
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
            <span className="text-purple-300 text-sm font-semibold">🚀 +5 000 développeurs nous font confiance</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Créez vos
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Serveurs MCP</span>
            <br/>en quelques clics
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            La plateforme tout-en-un pour créer, gérer et déployer vos serveurs Model Context Protocol. 
            Bibliothèque complète + Création simplifiée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button 
              onClick={handleFreeTrialOrLogin}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-2xl shadow-purple-500/50 flex items-center justify-center">
              Démarrer Gratuitement
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button 
              onClick={handleDemo}
              className="px-8 py-4 bg-white/10 backdrop-blur text-white text-lg font-semibold rounded-full hover:bg-white/20 transition border border-white/20">
              Voir la Démo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto mt-20">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <stat.icon className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Tout pour vos serveurs MCP
            </h2>
            <p className="text-xl text-gray-400">
              Une plateforme complète pour créer, gérer et déployer vos serveurs Model Context Protocol
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-8 bg-gradient-to-br from-slate-800/50 to-purple-900/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition">
                <feature.icon className="w-12 h-12 text-purple-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Tarifs Transparents
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Choisissez le plan qui correspond à vos besoins. Changez à tout moment.
            </p>
            
            {/* Toggle Mensuel / Annuel */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-lg ${!isAnnual ? 'text-white font-semibold' : 'text-gray-400'}`}>
                Mensuel
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${isAnnual ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${isAnnual ? 'translate-x-9' : 'translate-x-1'}`} />
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

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`relative p-8 rounded-2xl border ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500 shadow-2xl shadow-purple-500/30 scale-105' 
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full">
                    Le plus populaire
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
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => {
                    if (plan.name === 'Enterprise') {
                      handleContactSales();
                    } else {
                      handlePlanClick(plan.name);
                    }
                  }}
                  className={`w-full py-3 rounded-full font-semibold transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ils Nous Font Confiance
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-8 bg-gradient-to-br from-slate-800/50 to-purple-900/20 rounded-2xl border border-purple-500/20">
                <p className="text-gray-300 text-lg mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{testimonial.author}</div>
                    <div className="text-purple-400 text-sm">{testimonial.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{testimonial.savings}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à Créer vos Serveurs MCP ?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Rejoignez les milliers de développeurs qui utilisent TwinMCP
          </p>
          <button 
            onClick={handleFreeTrialOrLogin}
            className="px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-2xl shadow-purple-500/50">
            Démarrer Gratuitement - 14 Jours d'Essai
          </button>
          <p className="text-gray-400 text-sm mt-4">
            Aucune carte de crédit requise • Annulation à tout moment
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>© 2025 TwinMCP. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}