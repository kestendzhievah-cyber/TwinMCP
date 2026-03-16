'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn, StaggerContainer, StaggerItem, CountUp } from '@/components/ui/animated';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Globe,
  Layers,
  LineChart,
  Menu,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Protocole UCP',
    description: 'Structurez vos fiches produit avec le Unified Context Protocol pour que les LLMs comprennent et recommandent vos produits.',
  },
  {
    icon: Search,
    title: 'Score de Visibilité LLM',
    description: 'Mesurez comment ChatGPT, Claude et Gemini perçoivent vos produits. Score de 0 à 100 avec recommandations actionnables.',
  },
  {
    icon: Sparkles,
    title: 'Optimisation Automatique',
    description: "Notre IA réécrit titres et descriptions pour maximiser la compréhension par les modèles de langage.",
  },
  {
    icon: BarChart3,
    title: 'Analytics LLM',
    description: 'Suivez l\'évolution de votre référencement IA en temps réel. Benchmarkez-vous contre vos concurrents.',
  },
  {
    icon: Layers,
    title: 'Multi-plateforme',
    description: 'Shopify, WooCommerce, PrestaShop, Magento. Connectez votre boutique en un clic.',
  },
  {
    icon: Shield,
    title: 'Contexte Vérifié',
    description: 'Vos données produit sont validées et structurées selon le schéma UCP pour garantir la fiabilité.',
  },
];

const stats = [
  { value: '+340%', label: 'Visibilité LLM moyenne' },
  { value: '2.8x', label: 'Plus de recommandations IA' },
  { value: '89%', label: 'Score UCP moyen après optimisation' },
  { value: '<2min', label: 'Par produit à optimiser' },
];

const steps = [
  {
    step: '01',
    title: 'Connectez votre boutique',
    description: 'Importez vos produits depuis Shopify, WooCommerce, PrestaShop ou via CSV. Configuration en 30 secondes.',
  },
  {
    step: '02',
    title: 'Analysez vos produits',
    description: 'Notre moteur analyse chaque fiche produit et calcule un score de visibilité LLM détaillé.',
  },
  {
    step: '03',
    title: 'Optimisez avec l\'IA',
    description: 'Appliquez les recommandations ou laissez notre IA optimiser automatiquement titres, descriptions et attributs.',
  },
  {
    step: '04',
    title: 'Publiez le contexte UCP',
    description: 'Générez et publiez le contexte structuré UCP pour que les LLMs référencent vos produits en priorité.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '0',
    period: 'Gratuit',
    description: 'Pour découvrir le référencement LLM',
    features: ['50 produits', 'Score de visibilité LLM', '5 optimisations/mois', 'Export UCP basique'],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pro',
    price: '49',
    period: '/mois',
    description: 'Pour les e-commerçants ambitieux',
    features: [
      '500 produits',
      'Score + Recommandations détaillées',
      'Optimisations illimitées',
      'Export UCP avancé',
      'Analytics LLM temps réel',
      'Support prioritaire',
    ],
    cta: 'Essai gratuit 14 jours',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '199',
    period: '/mois',
    description: 'Pour les grandes marques',
    features: [
      'Produits illimités',
      'API dédiée',
      'Intégrations custom',
      'Multi-boutiques',
      'Benchmark concurrentiel',
      'Account manager dédié',
      'SLA 99.9%',
    ],
    cta: 'Contacter l\'équipe',
    popular: false,
  },
];

const testimonials = [
  {
    name: 'Marie Dupont',
    role: 'Fondatrice, BelleMode.fr',
    content: 'Depuis qu\'on utilise UCP Commerce, nos produits sont recommandés 3x plus souvent par ChatGPT. Le ROI est incroyable.',
    avatar: 'MD',
  },
  {
    name: 'Thomas Bernard',
    role: 'CTO, TechShop',
    content: 'Le score de visibilité LLM nous a ouvert les yeux. On ne savait pas que nos fiches produit étaient si mal structurées pour les IA.',
    avatar: 'TB',
  },
  {
    name: 'Sophie Martin',
    role: 'Head of E-commerce, NatureBio',
    content: 'L\'optimisation automatique nous fait gagner des heures. 800 produits optimisés en une journée, c\'est magique.',
    avatar: 'SM',
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">UCP Commerce</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Comment ça marche</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tarifs</a>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">Dashboard</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">
                Commencer <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl p-4 space-y-3">
            <a href="#features" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Fonctionnalités</a>
            <a href="#how-it-works" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Comment ça marche</a>
            <a href="#pricing" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Tarifs</a>
            <Link href="/dashboard" className="block">
              <Button className="w-full" size="sm">Commencer</Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-blue-600/10 blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <FadeIn delay={0.1}>
            <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-violet-400" />
              Nouveau : Protocole UCP v1.0
            </Badge>
          </FadeIn>

          <FadeIn delay={0.25}>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              Vos produits, visibles par{' '}
              <span className="gradient-text">tous les LLMs</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.4}>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Optimisez le référencement de vos produits e-commerce sur ChatGPT, Claude, Gemini et
              les moteurs de réponse IA grâce au protocole{' '}
              <span className="text-foreground font-medium">UCP</span>.
            </p>
          </FadeIn>

          <FadeIn delay={0.55}>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/dashboard">
                <Button size="xl" className="group">
                  Analyser mes produits gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="xl">
                  Voir la démo
                </Button>
              </a>
            </div>
          </FadeIn>

          <StaggerContainer className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8" staggerDelay={0.12}>
            {stats.map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="text-center">
                  <div className="text-2xl font-bold gradient-text sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Rocket className="mr-2 h-3.5 w-3.5" />
              Fonctionnalités
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
              Tout ce qu&apos;il faut pour dominer le{' '}
              <span className="gradient-text">référencement IA</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Une suite complète d&apos;outils pour analyser, optimiser et publier vos fiches produit
              selon le protocole UCP.
            </p>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-violet-500/20 hover:bg-white/[0.04] transition-all duration-300 h-full">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-violet-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-32 bg-white/[0.01]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Globe className="mr-2 h-3.5 w-3.5" />
              Processus
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
              4 étapes vers la{' '}
              <span className="gradient-text">visibilité LLM</span>
            </h2>
          </div>

          <StaggerContainer className="grid gap-8 md:grid-cols-2 lg:grid-cols-4" staggerDelay={0.15}>
            {steps.map((step, i) => (
              <StaggerItem key={step.step}>
                <div className="relative">
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-violet-500/30 to-transparent" />
                  )}
                  <div className="mb-4 text-4xl font-bold text-violet-500/20">{step.step}</div>
                  <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Star className="mr-2 h-3.5 w-3.5" />
              Témoignages
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Ils optimisent déjà leur{' '}
              <span className="gradient-text">référencement LLM</span>
            </h2>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-3" staggerDelay={0.1}>
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
              <div
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-white/10 transition-colors h-full"
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-6 text-sm text-muted-foreground leading-relaxed">&ldquo;{t.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-bg text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-32 bg-white/[0.01]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <LineChart className="mr-2 h-3.5 w-3.5" />
              Tarifs
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
              Un plan pour chaque{' '}
              <span className="gradient-text">ambition</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Commencez gratuitement, montez en puissance quand vous êtes prêt.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                  plan.popular
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10 scale-[1.02]'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Le plus populaire
                  </Badge>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}&euro;</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard">
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-12 sm:p-16">
            <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
              Prêt à être visible par les{' '}
              <span className="gradient-text">IA</span> ?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Rejoignez les e-commerçants qui anticipent la révolution du search.
              Votre référencement LLM commence aujourd&apos;hui.
            </p>
            <Link href="/dashboard">
              <Button size="xl" className="group">
                Commencer gratuitement
                <Rocket className="ml-2 h-5 w-5 transition-transform group-hover:-translate-y-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">UCP Commerce</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Le référencement LLM pour les e-commerçants ambitieux.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-sm">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-sm">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Guide UCP</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Études de cas</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Webinaires</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-sm">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">RGPD</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-white/5 pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} UCP Commerce. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
