'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react';

const platforms = [
  { id: 'shopify', name: 'Shopify', logo: '🛍️', color: 'bg-green-500/10 text-green-400' },
  { id: 'woocommerce', name: 'WooCommerce', logo: '🔌', color: 'bg-purple-500/10 text-purple-400' },
  { id: 'prestashop', name: 'PrestaShop', logo: '🏪', color: 'bg-blue-500/10 text-blue-400' },
  { id: 'magento', name: 'Magento', logo: '🔶', color: 'bg-orange-500/10 text-orange-400' },
  { id: 'custom', name: 'API Custom', logo: '⚙️', color: 'bg-gray-500/10 text-gray-400' },
];

const connectedStores = [
  { id: 's1', name: 'Ma Boutique Mode', platform: 'Shopify', products: 124, lastSync: '2026-03-15 10:30', status: 'connected' as const },
  { id: 's2', name: 'Tech Store', platform: 'WooCommerce', products: 89, lastSync: '2026-03-14 22:15', status: 'connected' as const },
  { id: 's3', name: 'Beauty Shop', platform: 'PrestaShop', products: 34, lastSync: '2026-03-10 08:00', status: 'error' as const },
];

export default function StoresPage() {
  const [showConnect, setShowConnect] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Boutiques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez vos boutiques e-commerce pour synchroniser vos produits
          </p>
        </div>
        <Button size="sm" onClick={() => setShowConnect(!showConnect)}>
          <Plus className="mr-2 h-4 w-4" />
          Connecter une boutique
        </Button>
      </div>

      {/* Connect new store */}
      {showConnect && (
        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-violet-400" />
              Choisir une plateforme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
                >
                  <span className="text-3xl">{p.logo}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Stores */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Boutiques connectées</h2>
        {connectedStores.map((store) => (
          <Card key={store.id}>
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
                    <Store className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{store.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{store.platform}</Badge>
                      <span>{store.products} produits</span>
                      <span>&middot;</span>
                      <span>Dernière synchro: {store.lastSync}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {store.status === 'connected' ? (
                    <Badge variant="success" className="text-xs">Connecté</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Erreur</Badge>
                  )}
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Synchroniser
                  </Button>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
