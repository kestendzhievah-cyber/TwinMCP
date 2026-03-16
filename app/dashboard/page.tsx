'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FadeIn, StaggerContainer, StaggerItem, CountUp } from '@/components/ui/animated';
import { cn, getScoreColor, getScoreLabel, formatNumber } from '@/lib/utils';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FileJson,
  LayoutGrid,
  Package,
  Sparkles,
  TrendingUp,
  Zap,
  AlertTriangle,
} from 'lucide-react';

// Demo data — in production this would come from API
const demoStats = {
  totalProducts: 247,
  analyzedProducts: 189,
  averageScore: 68,
  publishedContexts: 94,
  scoreDistribution: { excellent: 42, good: 67, needsWork: 55, critical: 25 },
  recentTrend: 12,
};

const recentProducts = [
  { id: '1', name: 'Nike Air Max 90 Essential', score: 87, status: 'published', category: 'Chaussures' },
  { id: '2', name: 'MacBook Pro 14" M3', score: 92, status: 'published', category: 'Électronique' },
  { id: '3', name: 'Crème hydratante bio', score: 45, status: 'draft', category: 'Cosmétiques' },
  { id: '4', name: 'T-shirt coton bio homme', score: 61, status: 'draft', category: 'Mode' },
  { id: '5', name: 'Casque Sony WH-1000XM5', score: 88, status: 'published', category: 'Audio' },
];

const recentRecommendations = [
  { type: 'critical' as const, count: 12, label: 'Descriptions trop courtes', icon: AlertTriangle },
  { type: 'warning' as const, count: 23, label: 'Marque manquante', icon: AlertTriangle },
  { type: 'info' as const, count: 45, label: 'Attributs à enrichir', icon: Sparkles },
];

export default function DashboardPage() {
  const stats = demoStats;

  const analyzedPercent = stats.totalProducts > 0
    ? Math.round((stats.analyzedProducts / stats.totalProducts) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivez le référencement LLM de vos produits en temps réel
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/analyzer">
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Analyser
            </Button>
          </Link>
          <Link href="/dashboard/products">
            <Button size="sm">
              <Package className="mr-2 h-4 w-4" />
              Ajouter des produits
            </Button>
          </Link>
        </div>
      </div>
      </FadeIn>

      {/* KPI Cards */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
        <StaggerItem>
        <Card className="hover:border-white/10 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produits totaux</p>
                <p className="text-3xl font-bold mt-1"><CountUp target={stats.totalProducts} /></p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                <Package className="h-6 w-6 text-violet-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="success" className="text-xs">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{stats.recentTrend}%
              </Badge>
              <span className="text-xs text-muted-foreground">ce mois</span>
            </div>
          </CardContent>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="hover:border-white/10 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produits analysés</p>
                <p className="text-3xl font-bold mt-1"><CountUp target={stats.analyzedProducts} /></p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Couverture</span>
                <span>{analyzedPercent}%</span>
              </div>
              <Progress value={analyzedPercent} />
            </div>
          </CardContent>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="hover:border-white/10 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score LLM moyen</p>
                <p className={cn('text-3xl font-bold mt-1', getScoreColor(stats.averageScore))}>
                  <CountUp target={stats.averageScore} />/100
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <Zap className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4">
              <Badge variant={stats.averageScore >= 70 ? 'success' : stats.averageScore >= 50 ? 'warning' : 'destructive'}>
                {getScoreLabel(stats.averageScore)}
              </Badge>
            </div>
          </CardContent>
        </Card>
        </StaggerItem>

        <StaggerItem>
        <Card className="hover:border-white/10 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contextes UCP publiés</p>
                <p className="text-3xl font-bold mt-1"><CountUp target={stats.publishedContexts} /></p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <FileJson className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {Math.round((stats.publishedContexts / (stats.analyzedProducts || 1)) * 100)}% des produits analysés
              </span>
            </div>
          </CardContent>
        </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Score Distribution + Recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutGrid className="h-5 w-5 text-violet-400" />
              Distribution des scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Excellent (80-100)', count: stats.scoreDistribution.excellent, color: 'bg-emerald-500', pct: Math.round((stats.scoreDistribution.excellent / stats.analyzedProducts) * 100) },
                { label: 'Bon (60-79)', count: stats.scoreDistribution.good, color: 'bg-yellow-500', pct: Math.round((stats.scoreDistribution.good / stats.analyzedProducts) * 100) },
                { label: 'À améliorer (40-59)', count: stats.scoreDistribution.needsWork, color: 'bg-orange-500', pct: Math.round((stats.scoreDistribution.needsWork / stats.analyzedProducts) * 100) },
                { label: 'Critique (<40)', count: stats.scoreDistribution.critical, color: 'bg-red-500', pct: Math.round((stats.scoreDistribution.critical / stats.analyzedProducts) * 100) },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.count} produits ({item.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', item.color)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/dashboard/analyzer">
                <Button variant="outline" size="sm">
                  Voir le détail
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-violet-400" />
              Actions prioritaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRecommendations.map((rec) => (
              <div
                key={rec.label}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3',
                  rec.type === 'critical' ? 'border-red-500/20 bg-red-500/5' :
                  rec.type === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                  'border-blue-500/20 bg-blue-500/5'
                )}
              >
                <rec.icon className={cn(
                  'h-4 w-4 mt-0.5 flex-shrink-0',
                  rec.type === 'critical' ? 'text-red-400' :
                  rec.type === 'warning' ? 'text-yellow-400' :
                  'text-blue-400'
                )} />
                <div>
                  <p className="text-sm font-medium">{rec.label}</p>
                  <p className="text-xs text-muted-foreground">{rec.count} produits concernés</p>
                </div>
              </div>
            ))}

            <Link href="/dashboard/optimizer">
              <Button className="w-full" size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Corriger automatiquement
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-violet-400" />
            Derniers produits analysés
          </CardTitle>
          <Link href="/dashboard/products">
            <Button variant="ghost" size="sm">
              Voir tout
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Produit</th>
                  <th className="pb-3 font-medium">Catégorie</th>
                  <th className="pb-3 font-medium">Score LLM</th>
                  <th className="pb-3 font-medium">Contexte UCP</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentProducts.map((product) => (
                  <tr key={product.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4">
                      <span className="font-medium">{product.name}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn('font-bold', getScoreColor(product.score))}>
                        {product.score}
                      </span>
                      <span className="text-muted-foreground">/100</span>
                    </td>
                    <td className="py-3 pr-4">
                      {product.status === 'published' ? (
                        <Badge variant="success" className="text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Publié
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Brouillon</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <Link href={`/dashboard/analyzer?id=${product.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                          Analyser
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-blue-500/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-violet-400" />
                Démarrage rapide
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                Importez vos produits, lancez l&apos;analyse et publiez vos contextes UCP en quelques minutes.
                Les LLMs pourront ensuite mieux comprendre et recommander vos produits.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link href="/dashboard/products">
                <Button variant="outline" size="sm">
                  Importer des produits
                </Button>
              </Link>
              <Link href="/dashboard/analyzer">
                <Button size="sm">
                  Lancer l&apos;analyse
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
