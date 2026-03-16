'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animated';
import {
  Bell,
  CreditCard,
  Key,
  Save,
  User,
} from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Paramètres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez votre compte et vos préférences
          </p>
        </div>
      </FadeIn>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-violet-400" />
            Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom</label>
              <Input defaultValue="Sofia Kestendzhieva" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input type="email" defaultValue="sofia@ucpcommerce.com" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Entreprise</label>
            <Input defaultValue="UCP Commerce SAS" />
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-violet-400" />
            Plan actuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Starter</h3>
                <Badge variant="secondary" className="text-xs">Actif</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                50 produits &middot; 100 analyses/mois &middot; Contextes UCP illimités
              </p>
            </div>
            <Button>
              Passer au Pro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-violet-400" />
            Clé API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Utilisez cette clé pour accéder à l&apos;API UCP Commerce depuis vos applications.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value="ucp_sk_live_••••••••••••••••••••"
              className="flex-1 font-mono text-muted-foreground"
            />
            <Button variant="outline" size="sm">Copier</Button>
            <Button variant="outline" size="sm">Régénérer</Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-violet-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Rapport hebdomadaire de visibilité', desc: 'Recevez un résumé de vos performances LLM chaque lundi', enabled: true },
            { label: 'Alertes de score', desc: 'Soyez notifié quand un score passe sous 50', enabled: true },
            { label: 'Nouvelles fonctionnalités', desc: 'Restez informé des mises à jour produit', enabled: false },
          ].map((notif) => (
            <div key={notif.label} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
              <div>
                <p className="text-sm font-medium">{notif.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{notif.desc}</p>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${notif.enabled ? 'bg-violet-500 justify-end' : 'bg-white/10 justify-start'}`}>
                <div className="w-4 h-4 rounded-full bg-white mx-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          {saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
