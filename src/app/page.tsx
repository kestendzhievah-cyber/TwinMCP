"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Zap, TrendingUp, Shield, Check, ArrowRight, Sparkles, Users, Clock, DollarSign } from 'lucide-react';

export default function AgentFlowLanding() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('professional');

  const handleSignup = (plan?: string) => {
    router.push(plan ? `/signup?plan=${plan}` : '/signup');
  };

  const handleDemo = () => {
    router.push('/dashboard/agent-mcp-demo');
  };

  const handleContact = () => {
    router.push('/contact');
  };

  const stats = [
    { icon: Users, value: '10,000+', label: 'Entreprises actives' },
    { icon: MessageSquare, value: '5M+', label: 'Conversations/mois' },
    { icon: Clock, value: '80%', label: 'Temps économisé' },
    { icon: DollarSign, value: '3.2x', label: 'ROI moyen' }
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'IA Multi-Modèles',
      description: 'GPT-4, Claude, Gemini - Choisissez le meilleur modèle pour chaque tâche'
    },
    {
      icon: Zap,
      title: 'Déploiement Instantané',
      description: 'Votre agent IA opérationnel en moins de 5 minutes'
    },
    {
      icon: TrendingUp,
      title: 'Analytics Avancés',
      description: 'Tableaux de bord en temps réel pour optimiser vos performances'
    },
    {
      icon: Shield,
      title: 'Sécurité Enterprise',
      description: 'Conformité RGPD, chiffrement end-to-end, hébergement EU'
    }
  ];

  const plans = [
    {
      name: 'Starter',
      price: '29',
      description: 'Parfait pour tester',
      features: [
        '1 agent IA',
        '1 000 conversations/mois',
        'Modèles basiques',
        'Support email',
        'Analytics basiques'
      ],
      cta: 'Démarrer gratuitement',
      popular: false
    },
    {
      name: 'Professional',
      price: '99',
      description: 'Le plus populaire',
      features: [
        '5 agents IA',
        '10 000 conversations/mois',
        'Tous les modèles (GPT-4, Claude)',
        'Support prioritaire 24/7',
        'Analytics avancés',
        'Intégrations CRM',
        'API complète'
      ],
      cta: 'Essai gratuit 14 jours',
      popular: true
    },
    {
      name: 'Enterprise',
      price: '499',
      description: 'Pour les équipes',
      features: [
        'Agents illimités',
        'Conversations illimitées',
        'Tous les modèles + Custom',
        'Account manager dédié',
        'SLA 99.9%',
        'Intégrations sur-mesure',
        'Formation & onboarding',
        'White-label disponible'
      ],
      cta: 'Contacter les ventes',
      popular: false
    }
  ];

  const testimonials = [
    {
      company: 'TechCorp',
      author: 'Marie Dubois, CEO',
      content: 'Corel.IA a réduit notre temps de réponse de 85%. Notre équipe se concentre maintenant sur les cas complexes.',
      savings: '12 000€/mois économisés'
    },
    {
      company: 'E-Shop Pro',
      author: 'Thomas Martin, CMO',
      content: 'Nos ventes ont augmenté de 40% grâce à l\'agent commercial IA qui qualifie les leads 24/7.',
      savings: '+180 000€ de CA annuel'
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
              <span className="text-2xl font-bold text-white">Corel.IA</span>
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
                onClick={() => handleSignup()} 
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50">
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
            <span className="text-purple-300 text-sm font-semibold">🚀 +10 000 entreprises nous font confiance</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Créez des Agents IA qui
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Vendent</span> et
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Supportent</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Automatisez votre support client et boostez vos ventes avec des agents IA intelligents. 
            Aucun code requis. Déploiement en 5 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button 
              onClick={() => handleSignup()}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-2xl shadow-purple-500/50 flex items-center justify-center">
              Démarrer Gratuitement
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button 
              onClick={handleDemo}
              className="px-8 py-4 bg-white/10 backdrop-blur text-white text-lg font-semibold rounded-lg hover:bg-white/20 transition border border-white/20">
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
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-gray-400">
              Une plateforme complète pour créer, déployer et optimiser vos agents IA
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
            <p className="text-xl text-gray-400">
              Choisissez le plan qui correspond à vos besoins. Changez à tout moment.
            </p>
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
                    <span className="text-5xl font-bold text-white">{plan.price}€</span>
                    <span className="text-gray-400 ml-2 mb-2">/mois</span>
                  </div>
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
                      handleContact();
                    } else {
                      handleSignup(plan.name.toLowerCase());
                    }
                  }}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
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
            Prêt à Transformer Votre Business ?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Rejoignez les milliers d'entreprises qui automatisent avec Corel.IA
          </p>
          <button 
            onClick={() => handleSignup()}
            className="px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-2xl shadow-purple-500/50">
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
          <p>© 2025 Corel.IA. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}