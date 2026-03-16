'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/animated';
import { cn, getScoreColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowUpDown,
  Download,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  category: string;
  brand: string | null;
  score: number;
  llmReadiness: number;
  storeId: string | null;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'price'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
    const fetchProducts = async () => {
      try {
        const headers = await getAuthHeaders();
        const q = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
        const res = await fetch(`/api/products${q}`, { headers });
        const data = await res.json();
        if (data.success && data.data?.items) {
          setProducts(data.data.items);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [getAuthHeaders, searchQuery]);

  const filtered = products
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      if (sortBy === 'price') return mul * (a.price - b.price);
      return mul * (a.score - b.score);
    });

  const handleExportCsv = () => {
    const header = 'ID,Nom,Catégorie,Marque,Prix,Score LLM';
    const rows = filtered.map(p =>
      `${p.id},"${p.name}","${p.category}","${p.brand || ''}",${p.price},${p.score}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-ucp.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  return (
    <div className="space-y-8">
      <FadeIn>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Produits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez et analysez vos {filtered.length} produits
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un produit
          </Button>
        </div>
      </div>
      </FadeIn>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Rechercher un produit, une catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Produit <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">Catégorie</th>
                  <th className="p-4 font-medium">Marque</th>
                  <th className="p-4 font-medium">
                    <button onClick={() => handleSort('price')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Prix <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button onClick={() => handleSort('score')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Score LLM <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">UCP</th>
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{product.brand || '—'}</td>
                    <td className="p-4 font-medium">{product.price.toFixed(2)}&euro;</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', product.score >= 80 ? 'bg-emerald-400' : product.score >= 60 ? 'bg-yellow-400' : product.score >= 40 ? 'bg-orange-400' : 'bg-red-400')} />
                        <span className={cn('font-bold', getScoreColor(product.score))}>{product.score}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {product.status === 'published' ? (
                        <Badge variant="success" className="text-xs">Publié</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs opacity-50">Non</Badge>
                      )}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{product.store}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/analyzer?id=${product.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Analyser
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
