"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, Zap, TrendingUp, Shield, Check, ArrowRight, Sparkles, 
  Users, Clock, DollarSign, Code2, Library, Boxes, Workflow, X, Star,
  Server, Cpu, GitBranch, Rocket, ChevronRight, Play
} from 'lucide-react';

// Hook for intersection observer animations
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Animated Counter Component
function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();

  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function AgentFlowLanding() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [isAnnual, setIsAnnual] = useState(false);
  const [showFreeTrial, setShowFreeTrial] = useState(false);

  // Show free trial popup after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowFreeTrial(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handlePlanClick = (planName: string) => {
    const billing = isAnnual ? 'annual' : 'monthly';
    const planMap: { [key: string]: string } = {
      'Free': `/signup?plan=free&billing=${billing}`,
      'Professional': `/signup?plan=professional&billing=${billing}`,
      'Enterprise': `/signup?plan=enterprise&billing=${billing}`
    };
    router.push(planMap[planName] || '/signup');
  };

  const handleContactSales = () => router.push('/contact');
  const handleDemo = () => router.push('/dashboard/agent-mcp-demo');
  const handleFreeTrialOrLogin = () => router.push('/signup?plan=professional&trial=true');

  const stats = [
    { icon: Users, value: 5000, suffix: '+', label: 'Développeurs actifs' },
    { icon: Library, value: 500, suffix: '+', label: 'Serveurs MCP créés' },
    { icon: Code2, value: 95, suffix: '%', label: 'Temps de dev économisé' },
    { icon: Workflow, value: 10, suffix: 'x', label: 'Plus rapide' }
  ];

  const features = [
    {
      icon: Server,
      title: 'Création MCP Personnalisée',
      description: 'Créez vos propres serveurs MCP sur-mesure en quelques minutes avec notre éditeur visuel avancé',
      highlight: true
    },
    {
      icon: Library,
      title: 'Bibliothèque Complète',
      description: 'Accédez à des centaines de serveurs MCP prêts à l\'emploi et personnalisables'
    },
    {
      icon: Boxes,
      title: 'Intégration Facile',
      description: 'Connectez vos serveurs MCP à n\'importe quelle application en quelques lignes de code'
    },
    {
      icon: Shield,
      title: 'Sécurité & Fiabilité',
      description: 'Infrastructure sécurisée, monitoring 24/7, conformité RGPD garantie'
    }
  ];

  // Comparison data for conversion optimization
  const comparisonFeatures = [
    { feature: 'Serveurs MCP', free: '3 serveurs', pro: 'Illimités', proHighlight: true },
    { feature: 'Requêtes/jour', free: '200', pro: '10 000', proHighlight: true },
    { feature: 'Serveurs MCP personnalisés', free: false, pro: true, proHighlight: true },
    { feature: 'Serveurs privés', free: false, pro: true, proHighlight: true },
    { feature: 'Analytics avancés', free: false, pro: true },
    { feature: 'Support prioritaire 24/7', free: false, pro: true },
    { feature: 'API complète', free: false, pro: true },
    { feature: 'Webhooks & intégrations', free: false, pro: true },
    { feature: 'Bibliothèque publique', free: true, pro: true },
    { feature: 'Documentation', free: true, pro: true },
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
      name: 'Enterprise',
      priceMonthly: null,
      priceAnnual: null,
      description: 'Pour les équipes',
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

  const testimonials = [
    {
      company: 'DevStudio',
      author: 'Marc Lefebvre',
      role: 'CTO',
      content: 'TwinMCP a transformé notre workflow. La création de serveurs MCP personnalisés nous a fait économiser des semaines de développement.',
      savings: '200h/mois économisées',
      rating: 5
    },
    {
      company: 'AI Solutions',
      author: 'Sophie Bernard',
      role: 'Lead Developer',
      content: 'L\'intégration MCP n\'a jamais été aussi simple. Nos clients adorent la flexibilité et la rapidité de déploiement.',
      savings: '10x plus rapide',
      rating: 5
    },
    {
      company: 'TechFlow',
      author: 'Lucas Martin',
      role: 'Founder',
      content: 'Le plan Pro avec l\'essai gratuit m\'a convaincu en une semaine. Les serveurs MCP personnalisés sont un game-changer.',
      savings: '300% ROI',
      rating: 5
    }
  ];

  // Sections with animations
  const heroSection = useInView(0.1);
  const statsSection = useInView(0.2);
  const featuresSection = useInView(0.1);
  const comparisonSection = useInView(0.1);
  const pricingSection = useInView(0.1);
  const testimonialSection = useInView(0.1);
  const ctaSection = useInView(0.1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
      {/* Free Trial Popup */}
      {showFreeTrial && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-1 rounded-2xl shadow-2xl shadow-purple-500/50">
            <div className="bg-slate-900 p-4 rounded-xl relative">
              <button 
                onClick={() => setShowFreeTrial(false)}
                className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 hover:bg-slate-700 transition"
                data-testid="close-trial-popup"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="free-trial-badge p-2 rounded-lg">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold">Essai Pro Gratuit</p>
                  <p className="text-gray-400 text-sm">14 jours sans engagement</p>
                </div>
              </div>
              <button 
                onClick={handleFreeTrialOrLogin}
                className="w-full mt-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition btn-animated"
                data-testid="trial-popup-cta"
              >
                Commencer maintenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 animate-fade-in-up">
              <Sparkles className="w-8 h-8 text-purple-400 animate-float" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition hover-scale" data-testid="nav-features">Fonctionnalités</a>
              <a href="#comparison" className="text-gray-300 hover:text-white transition hover-scale" data-testid="nav-comparison">Comparatif</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition hover-scale" data-testid="nav-pricing">Tarifs</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition hover-scale" data-testid="nav-testimonials">Témoignages</a>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-white hover:text-purple-400 transition"
                data-testid="nav-login"
              >
                Connexion
              </button>
              <button 
                onClick={handleFreeTrialOrLogin}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50 btn-animated animate-pulse-glow"
                data-testid="nav-free-trial"
              >
                Essai Gratuit
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroSection.ref} className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          {/* Trust Badge */}
          <div className={`inline-block mb-4 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full ${heroSection.isInView ? 'animate-bounce-in' : 'opacity-0'}`}>
            <span className="text-purple-300 text-sm font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              +5 000 développeurs nous font confiance
            </span>
          </div>
          
          {/* Main Headline */}
          <h1 className={`text-5xl md:text-7xl font-bold text-white mb-6 leading-tight ${heroSection.isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'}`}>
            Créez vos
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-shift"> Serveurs MCP </span>
            <br/>
            <span className="text-4xl md:text-5xl">Personnalisés</span> en quelques clics
          </h1>
          
          {/* Subheadline */}
          <p className={`text-xl text-gray-300 mb-8 max-w-3xl mx-auto ${heroSection.isInView ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
            La plateforme tout-en-un pour créer, gérer et déployer vos serveurs Model Context Protocol. 
            <span className="text-purple-400 font-semibold"> Création sur-mesure + Bibliothèque complète.</span>
          </p>
          
          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-8 ${heroSection.isInView ? 'animate-bounce-in delay-300' : 'opacity-0'}`}>
            <button 
              onClick={handleFreeTrialOrLogin}
              className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition shadow-2xl shadow-purple-500/50 flex items-center justify-center btn-animated animate-pulse-glow"
              data-testid="hero-free-trial"
            >
              <Rocket className="mr-2 w-5 h-5 group-hover:animate-bounce" />
              Essai Gratuit 14 Jours
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={handleDemo}
              className="px-8 py-4 bg-white/10 backdrop-blur text-white text-lg font-semibold rounded-full hover:bg-white/20 transition border border-white/20 flex items-center justify-center hover-lift"
              data-testid="hero-demo"
            >
              <Play className="mr-2 w-5 h-5" />
              Voir la Démo
            </button>
          </div>

          {/* Free Trial Benefits */}
          <div className={`flex flex-wrap justify-center gap-6 text-sm text-gray-400 ${heroSection.isInView ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Aucune carte requise
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Annulation à tout moment
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Accès complet aux fonctionnalités Pro
            </span>
          </div>

          {/* Stats */}
          <div ref={statsSection.ref} className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto mt-20">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center hover-lift p-4 rounded-xl bg-slate-800/30 border border-purple-500/10 ${statsSection.isInView ? `animate-count-up delay-${(index + 1) * 100}` : 'opacity-0'}`}
              >
                <stat.icon className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-float" style={{ animationDelay: `${index * 0.2}s` }} />
                <div className="text-3xl font-bold text-white mb-1">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" ref={featuresSection.ref} className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 ${featuresSection.isInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Tout pour vos serveurs MCP
            </h2>
            <p className="text-xl text-gray-400">
              Une plateforme complète pour créer, gérer et déployer vos serveurs Model Context Protocol
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`p-8 bg-gradient-to-br from-slate-800/50 to-purple-900/20 rounded-2xl border ${feature.highlight ? 'border-purple-500 animate-pulse-glow' : 'border-purple-500/20'} hover-lift hover-glow ${featuresSection.isInView ? `animate-fade-in-scale delay-${(index + 1) * 100}` : 'opacity-0'}`}
              >
                {feature.highlight && (
                  <div className="inline-block mb-4 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-xs font-semibold">
                    FONCTIONNALITÉ PRO
                  </div>
                )}
                <feature.icon className={`w-12 h-12 ${feature.highlight ? 'text-pink-400' : 'text-purple-400'} mb-4`} />
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section - Key for Conversion */}
      <section id="comparison" ref={comparisonSection.ref} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 ${comparisonSection.isInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="inline-block mb-4 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
              <span className="text-green-400 text-sm font-semibold">Comparatif détaillé</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Free vs <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Professional</span>
            </h2>
            <p className="text-xl text-gray-400">
              Découvrez tout ce que vous débloquez avec l'essai gratuit Pro
            </p>
          </div>

          {/* Comparison Table */}
          <div className={`bg-slate-800/50 rounded-2xl border border-purple-500/20 overflow-hidden ${comparisonSection.isInView ? 'animate-fade-in-scale delay-200' : 'opacity-0'}`}>
            {/* Header */}
            <div className="grid grid-cols-3 bg-slate-900/80 p-4 border-b border-purple-500/20">
              <div className="text-gray-400 font-semibold">Fonctionnalité</div>
              <div className="text-center text-gray-400 font-semibold">Free</div>
              <div className="text-center">
                <span className="text-white font-bold">Professional</span>
                <span className="ml-2 px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full animate-badge-bounce">
                  14 JOURS GRATUITS
                </span>
              </div>
            </div>

            {/* Rows */}
            {comparisonFeatures.map((item, index) => (
              <div 
                key={index} 
                className={`grid grid-cols-3 p-4 border-b border-purple-500/10 hover:bg-purple-500/5 transition ${item.proHighlight ? 'bg-purple-500/5' : ''}`}
              >
                <div className="text-gray-300 flex items-center">
                  {item.proHighlight && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-2" />}
                  {item.feature}
                </div>
                <div className="text-center">
                  {typeof item.free === 'boolean' ? (
                    item.free ? (
                      <Check className="w-5 h-5 text-gray-400 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-gray-600 mx-auto" />
                    )
                  ) : (
                    <span className="text-gray-400">{item.free}</span>
                  )}
                </div>
                <div className="text-center">
                  {typeof item.pro === 'boolean' ? (
                    item.pro ? (
                      <Check className="w-5 h-5 text-green-400 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-gray-600 mx-auto" />
                    )
                  ) : (
                    <span className={`font-semibold ${item.proHighlight ? 'text-purple-400' : 'text-white'}`}>
                      {item.pro}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* CTA Row */}
            <div className="p-6 bg-gradient-to-r from-purple-900/50 to-pink-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold text-lg">Prêt à essayer gratuitement ?</p>
                <p className="text-gray-400">Aucune carte de crédit requise pour l'essai</p>
              </div>
              <button 
                onClick={handleFreeTrialOrLogin}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-600 transition shadow-lg shadow-green-500/30 btn-animated flex items-center"
                data-testid="comparison-cta"
              >
                Démarrer l'essai gratuit
                <ChevronRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" ref={pricingSection.ref} className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 ${pricingSection.isInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
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
                data-testid="billing-toggle"
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${isAnnual ? 'translate-x-9' : 'translate-x-1'}`} />
              </button>
              <span className={`text-lg ${isAnnual ? 'text-white font-semibold' : 'text-gray-400'}`}>
                Annuel
              </span>
              {isAnnual && (
                <span className="ml-2 px-3 py-1 bg-green-500/20 text-green-400 text-sm font-semibold rounded-full animate-badge-bounce">
                  -25% d'économie
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {plans.map((plan, index) => (
              <div 
                key={index}
                style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500 shadow-2xl shadow-purple-500/30 md:scale-105 md:-mt-4 animate-pulse-glow z-10' 
                    : 'bg-slate-800/50 border-slate-700 hover-lift hover-glow'
                } ${pricingSection.isInView ? 'animate-fade-in-scale' : 'opacity-0'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full">
                    Le plus populaire
                  </div>
                )}

                {plan.badge && (
                  <div className="absolute -top-3 -right-3 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full animate-badge-bounce shadow-lg shadow-green-500/50">
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
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <Check className={`w-5 h-5 ${plan.popular ? 'text-green-400' : 'text-purple-400'} mr-3 flex-shrink-0 mt-0.5`} />
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
                  className={`w-full py-3 rounded-full font-semibold transition btn-animated ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                }`}
                  data-testid={`pricing-${plan.name.toLowerCase()}-cta`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" ref={testimonialSection.ref} className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-16 ${testimonialSection.isInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ils Nous Font Confiance
            </h2>
            <p className="text-xl text-gray-400">
              Découvrez pourquoi les développeurs choisissent TwinMCP
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className={`p-8 bg-gradient-to-br from-slate-800/50 to-purple-900/20 rounded-2xl border border-purple-500/20 hover-lift hover-glow ${testimonialSection.isInView ? `animate-slide-in-${index % 2 === 0 ? 'left' : 'right'} delay-${(index + 1) * 100}` : 'opacity-0'}`}
              >
                {/* Stars */}
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>

                <p className="text-gray-300 text-lg mb-6 italic">"{testimonial.content}"</p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{testimonial.author}</div>
                    <div className="text-purple-400 text-sm">{testimonial.role}, {testimonial.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-sm px-3 py-1 bg-green-500/20 rounded-full">
                      {testimonial.savings}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section ref={ctaSection.ref} className="py-20 px-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50">
        <div className={`max-w-4xl mx-auto text-center ${ctaSection.isInView ? 'animate-bounce-in' : 'opacity-0'}`}>
          <div className="inline-block mb-6 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full animate-badge-bounce">
            <span className="text-green-400 font-semibold flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Offre limitée : Essai gratuit 14 jours
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à Créer vos <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Serveurs MCP Personnalisés</span> ?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Rejoignez les milliers de développeurs qui utilisent TwinMCP pour accélérer leur workflow
          </p>
          
          <button 
            onClick={handleFreeTrialOrLogin}
            className="group px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xl font-semibold rounded-full hover:from-green-600 hover:to-emerald-600 transition shadow-2xl shadow-green-500/50 btn-animated animate-pulse-glow"
            data-testid="final-cta"
          >
            <span className="flex items-center justify-center">
              <Rocket className="mr-2 w-6 h-6 group-hover:animate-bounce" />
              Démarrer l'Essai Gratuit - 14 Jours
              <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
          
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-gray-400 text-sm">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Aucune carte de crédit requise
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Annulation à tout moment
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-400" /> Support prioritaire inclus
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4 bg-slate-900/80">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold text-white">TwinMCP</span>
              </div>
              <p className="text-gray-400 text-sm">
                La plateforme de création de serveurs MCP pour les développeurs modernes.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-purple-400 transition">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-purple-400 transition">Tarifs</a></li>
                <li><a href="#" className="hover:text-purple-400 transition">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/contact" className="hover:text-purple-400 transition">Contact</a></li>
                <li><a href="/privacy" className="hover:text-purple-400 transition">Confidentialité</a></li>
                <li><a href="/terms" className="hover:text-purple-400 transition">CGU</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Commencer</h4>
              <button 
                onClick={handleFreeTrialOrLogin}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition text-sm btn-animated"
                data-testid="footer-cta"
              >
                Essai Gratuit
              </button>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-gray-400 text-sm">
            <p>© 2025 TwinMCP. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
