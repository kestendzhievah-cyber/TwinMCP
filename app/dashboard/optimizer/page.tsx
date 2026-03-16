'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FadeIn, ScaleIn } from '@/components/ui/animated';
import { useAuth } from '@/lib/auth-context';
import type { OptimizationResult } from '@/lib/ucp/optimizer';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

export default function OptimizerPage() {
  const { user } = useAuth();
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const [form, setForm] = useState({
    name: 'Crème visage',
    description: 'Crème pour le visage. Hydrate bien.',
    category: 'Cosmétiques',
    brand: '',
  });

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [user]);

  const handleOptimize = async () => {
    setOptimizing(true);
    setResult(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          brand: form.brand || null,
          attributes: null,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setResult(data.data);
      } else {
        console.error('Optimization failed:', data);
      }
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Optimiseur IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Optimisez automatiquement vos fiches produit pour le référencement LLM
          </p>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wand2 className="h-5 w-5 text-violet-400" />
              Fiche produit originale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom du produit</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-sm focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Catégorie</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Marque</label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <Button onClick={handleOptimize} disabled={optimizing} className="w-full">
              {optimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimisation en cours...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Optimiser pour les LLMs
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-violet-400" />
              Version optimisée
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result && !optimizing && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Cliquez sur &quot;Optimiser&quot; pour voir les suggestions
                </p>
              </div>
            )}

            {optimizing && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 text-violet-400 animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Analyse et optimisation en cours...</p>
              </div>
            )}

            {result && !optimizing && (
              <ScaleIn>
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nom optimisé</label>
                  <p className="text-sm font-medium p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    {result.optimizedName}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description optimisée</label>
                  <p className="text-sm p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 whitespace-pre-line">
                    {result.optimizedDescription}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Catégorie optimisée</label>
                  <p className="text-sm font-medium p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    {result.optimizedCategory}
                  </p>
                </div>

                {Object.keys(result.suggestedAttributes).length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Attributs suggérés</label>
                    <div className="space-y-2">
                      {Object.entries(result.suggestedAttributes).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm">
                          <span className="font-medium">{key}</span>
                          <span className="text-muted-foreground">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changes log */}
                {result.changes.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Modifications ({result.changes.length})
                    </label>
                    <div className="space-y-2">
                      {result.changes.map((change, i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs font-medium capitalize">{change.field}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{change.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button className="w-full">
                  Appliquer les modifications
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              </ScaleIn>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
