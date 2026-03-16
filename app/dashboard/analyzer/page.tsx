'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animated';
import { cn, getScoreColor, getScoreLabel, getScoreBgColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { AnalysisResult, Recommendation } from '@/lib/types';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileJson,
  Info,
  Loader2,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';

const demoProducts = [
  {
    id: '1',
    name: 'Nike Air Max 90 Essential Homme',
    description: 'Les Nike Air Max 90 Essential pour homme revisitent le design emblématique avec des matériaux modernes et un amorti Air visible au talon. Tige en cuir et textile, semelle intercalaire en mousse et unité Air Max visible. Parfaites pour un style streetwear quotidien.',
    category: 'Mode > Chaussures > Baskets',
    brand: 'Nike',
    price: 139.99,
    attributes: { taille: '40-46', couleur: 'Blanc/Noir', matière: 'Cuir et textile' },
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
  },
  {
    id: '2',
    name: 'Crème visage',
    description: 'Crème pour le visage. Hydrate bien.',
    category: 'Cosmétiques',
    brand: null,
    price: 24.90,
    attributes: null,
    imageUrl: null,
  },
  {
    id: '3',
    name: 'CASQUE BLUETOOTH PREMIUM SUPER QUALITE!!!',
    description: 'casque bluetooth casque sans fil casque audio casque musique casque premium casque qualité casque pas cher meilleur casque',
    category: 'Électronique',
    brand: 'AudioTech',
    price: 89.99,
    attributes: { connectivité: 'Bluetooth 5.3' },
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
  },
  {
    id: '4',
    name: 'MacBook Pro 14 pouces M3 Pro - 18 Go RAM - 512 Go SSD',
    description: 'Le MacBook Pro 14 pouces avec puce M3 Pro offre des performances exceptionnelles pour les professionnels créatifs. Doté de 18 Go de mémoire unifiée et d\'un SSD de 512 Go, il gère sans effort le montage vidéo 4K, le développement logiciel et le design graphique. L\'écran Liquid Retina XDR de 14,2 pouces avec ProMotion offre une luminosité de 1600 nits en HDR. Autonomie jusqu\'à 17 heures.',
    category: 'Électronique > Ordinateurs > Portables > Apple',
    brand: 'Apple',
    price: 2399,
    attributes: { processeur: 'M3 Pro', ram: '18 Go', stockage: '512 Go SSD', écran: '14.2" Liquid Retina XDR', autonomie: '17 heures' },
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
  },
];

export default function AnalyzerPage() {
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<typeof demoProducts[0] | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [user]);

  const handleAnalyze = async (product: typeof demoProducts[0]) => {
    setSelectedProduct(product);
    setAnalyzing(true);
    setAnalysis(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          price: product.price,
          attributes: product.attributes,
          imageUrl: product.imageUrl,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setAnalysis(data.data);
      } else {
        console.error('Analysis failed:', data);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info': return <Info className="h-4 w-4 text-blue-400" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getRecommendationBorder = (type: Recommendation['type']) => {
    switch (type) {
      case 'critical': return 'border-red-500/20 bg-red-500/5';
      case 'warning': return 'border-yellow-500/20 bg-yellow-500/5';
      case 'info': return 'border-blue-500/20 bg-blue-500/5';
      case 'success': return 'border-emerald-500/20 bg-emerald-500/5';
    }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Analyseur LLM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analysez vos fiches produit et obtenez un score de visibilité LLM détaillé
          </p>
        </div>
      </FadeIn>

      {/* Product selection */}
      <div className="grid gap-4 sm:grid-cols-2">
        {demoProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => handleAnalyze(product)}
            className={cn(
              'text-left rounded-xl border p-4 transition-all duration-200 hover:border-white/20',
              selectedProduct?.id === product.id
                ? 'border-violet-500/50 bg-violet-500/5'
                : 'border-white/5 bg-white/[0.02]'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{product.category.split('>')[0].trim()}</Badge>
                  {product.brand && (
                    <Badge variant="secondary" className="text-xs">{product.brand}</Badge>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-bold">{product.price}&euro;</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Analysis Results */}
      {analyzing && (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-violet-400 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
            <p className="text-xs text-muted-foreground mt-1">Évaluation de la lisibilité LLM</p>
          </CardContent>
        </Card>
      )}

      {analysis && selectedProduct && !analyzing && (
        <div className="space-y-6">
          {/* Score Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={cn('border', getScoreBgColor(analysis.overallScore))}>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Score Global</p>
                <p className={cn('text-4xl font-bold', getScoreColor(analysis.overallScore))}>
                  {analysis.overallScore}
                </p>
                <p className="text-xs mt-1">{getScoreLabel(analysis.overallScore)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">LLM Readiness</p>
                <p className={cn('text-4xl font-bold', getScoreColor(analysis.llmReadiness))}>
                  {analysis.llmReadiness}
                </p>
                <Progress value={analysis.llmReadiness} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Richesse sémantique</p>
                <p className={cn('text-4xl font-bold', getScoreColor(analysis.semanticRichness))}>
                  {analysis.semanticRichness}
                </p>
                <Progress value={analysis.semanticRichness} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Clarté contextuelle</p>
                <p className={cn('text-4xl font-bold', getScoreColor(analysis.contextClarity))}>
                  {analysis.contextClarity}
                </p>
                <Progress value={analysis.contextClarity} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Detailed Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-violet-400" />
                Analyse détaillée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Titre', score: analysis.titleScore, weight: '30%' },
                { label: 'Description', score: analysis.descriptionScore, weight: '35%' },
                { label: 'Attributs', score: analysis.attributesScore, weight: '20%' },
                { label: 'Catégorie', score: analysis.categoryScore, weight: '15%' },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">(poids: {item.weight})</span>
                    </div>
                    <span className={cn('text-sm font-bold', getScoreColor(item.score))}>
                      {item.score}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        item.score >= 80 ? 'bg-emerald-500' :
                        item.score >= 60 ? 'bg-yellow-500' :
                        item.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      )}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-violet-400" />
                Recommandations ({analysis.recommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={cn('rounded-lg border p-4', getRecommendationBorder(rec.type))}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getRecommendationIcon(rec.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium">{rec.title}</h4>
                        <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                        {rec.autoFixAvailable && (
                          <Badge variant="info" className="text-xs">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Auto-fix
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Impact: <span className="font-medium text-foreground">{rec.impact === 'high' ? 'Élevé' : rec.impact === 'medium' ? 'Moyen' : 'Faible'}</span></span>
                        <span>Effort: <span className="font-medium text-foreground">{rec.effort === 'easy' ? 'Facile' : rec.effort === 'medium' ? 'Moyen' : 'Difficile'}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {analysis.recommendations.some(r => r.autoFixAvailable) && (
                <div className="pt-3">
                  <Button className="w-full sm:w-auto">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Appliquer les corrections automatiques
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate UCP Context CTA */}
          <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-blue-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileJson className="h-6 w-6 text-violet-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Générer le contexte UCP</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Créez un contexte structuré UCP pour que les LLMs comprennent et recommandent ce produit.
                    </p>
                  </div>
                </div>
                <Button className="flex-shrink-0">
                  Générer le contexte
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
