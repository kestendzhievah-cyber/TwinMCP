'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getScoreColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  CheckCircle2,
  Code2,
  Copy,
  Download,
  FileJson,
  Sparkles,
} from 'lucide-react';

const demoContexts = [
  {
    id: 'ctx-1',
    productName: 'Nike Air Max 90 Essential',
    status: 'published' as const,
    version: 3,
    score: 87,
    generatedAt: '2026-03-15T10:30:00Z',
  },
  {
    id: 'ctx-2',
    productName: 'MacBook Pro 14" M3',
    status: 'published' as const,
    version: 2,
    score: 92,
    generatedAt: '2026-03-14T15:20:00Z',
  },
  {
    id: 'ctx-3',
    productName: 'Casque Sony WH-1000XM5',
    status: 'published' as const,
    version: 1,
    score: 88,
    generatedAt: '2026-03-13T09:00:00Z',
  },
  {
    id: 'ctx-4',
    productName: 'T-shirt coton bio homme',
    status: 'draft' as const,
    version: 1,
    score: 61,
    generatedAt: '2026-03-12T14:45:00Z',
  },
];

export default function UCPContextsPage() {
  const { user } = useAuth();
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextData, setContextData] = useState<Record<string, unknown> | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({ valid: true, errors: [] });
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [user]);

  useEffect(() => {
    const loadSampleContext = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/ucp-context', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'prod-001',
            name: 'Nike Air Max 90 Essential Homme',
            description: 'Les Nike Air Max 90 Essential pour homme revisitent le design emblématique avec des matériaux modernes et un amorti Air visible au talon.',
            price: 139.99,
            currency: 'EUR',
            category: 'Mode > Chaussures > Baskets',
            brand: 'Nike',
            sku: 'NIKE-AM90-WHT',
            imageUrl: 'https://example.com/nike-am90.jpg',
            attributes: { taille: '40-46', couleur: 'Blanc/Noir' },
            storeName: 'MyShop',
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setContextData(data.data.context);
          setValidation(data.data.validation);
        }
      } catch (error) {
        console.error('Failed to load UCP context:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSampleContext();
  }, [getAuthHeaders]);

  const contextJson = contextData ? JSON.stringify(contextData, null, 2) : '{}';

  const handleCopy = () => {
    navigator.clipboard.writeText(contextJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([contextJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ucp-context.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Contextes UCP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les contextes structurés UCP de vos produits
          </p>
        </div>
        <Button size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Générer en lot
        </Button>
      </div>

      {/* Context List */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Contextes générés</h2>
          {demoContexts.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => setSelectedContext(ctx.id)}
              className={cn(
                'w-full text-left rounded-xl border p-4 transition-all duration-200',
                selectedContext === ctx.id
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">{ctx.productName}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>v{ctx.version}</span>
                    <span>&middot;</span>
                    <span>{new Date(ctx.generatedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-sm font-bold', getScoreColor(ctx.score))}>{ctx.score}</span>
                  {ctx.status === 'published' ? (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Publié
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Brouillon</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Context Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Code2 className="h-5 w-5 text-violet-400" />
              Aperçu UCP
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copié !' : 'Copier'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadJson}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>

          {/* Validation */}
          <div className={cn(
            'rounded-lg border p-3 flex items-center gap-2',
            validation.valid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
          )}>
            {validation.valid ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Contexte UCP valide — Schéma v1.0</span>
              </>
            ) : (
              <>
                <FileJson className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400">{validation.errors.length} erreur(s) de validation</span>
              </>
            )}
          </div>

          {/* JSON Preview */}
          <Card>
            <CardContent className="p-0">
              <pre className="overflow-auto max-h-[600px] p-4 text-xs leading-relaxed">
                <code className="text-muted-foreground">{contextJson}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
