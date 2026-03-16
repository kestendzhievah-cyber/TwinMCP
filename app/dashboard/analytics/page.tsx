'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Bot,
  Eye,
  Globe,
  TrendingUp,
  Zap,
} from 'lucide-react';

const llmData = [
  { name: 'ChatGPT', mentions: 342, trend: '+18%', color: 'text-emerald-400' },
  { name: 'Claude', mentions: 156, trend: '+24%', color: 'text-blue-400' },
  { name: 'Gemini', mentions: 89, trend: '+12%', color: 'text-yellow-400' },
  { name: 'Perplexity', mentions: 67, trend: '+31%', color: 'text-violet-400' },
  { name: 'Copilot', mentions: 45, trend: '+8%', color: 'text-orange-400' },
];

const topProducts = [
  { name: 'MacBook Pro 14" M3', mentions: 128, score: 92 },
  { name: 'Casque Sony WH-1000XM5', mentions: 94, score: 88 },
  { name: 'Nike Air Max 90', mentions: 87, score: 87 },
  { name: 'Montre Fitness Pro', mentions: 52, score: 74 },
  { name: 'T-shirt coton bio', mentions: 23, score: 61 },
];

const weeklyTrend = [
  { day: 'Lun', value: 45 },
  { day: 'Mar', value: 52 },
  { day: 'Mer', value: 48 },
  { day: 'Jeu', value: 61 },
  { day: 'Ven', value: 55 },
  { day: 'Sam', value: 38 },
  { day: 'Dim', value: 42 },
];

export default function AnalyticsPage() {
  const maxVal = Math.max(...weeklyTrend.map(d => d.value));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Analytics LLM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivez la visibilité de vos produits sur les moteurs de réponse IA
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Eye className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">699</p>
                <p className="text-xs text-muted-foreground">Mentions LLM totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">+19%</p>
                <p className="text-xs text-muted-foreground">Croissance ce mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-xs text-muted-foreground">LLMs actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">73/100</p>
                <p className="text-xs text-muted-foreground">Score visibilité moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-violet-400" />
              Mentions cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {weeklyTrend.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.value}</span>
                  <div
                    className="w-full rounded-t-lg gradient-bg transition-all duration-500 min-h-[4px]"
                    style={{ height: `${(d.value / maxVal) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By LLM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-violet-400" />
              Par moteur LLM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {llmData.map((llm) => (
              <div key={llm.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${llm.color}`}>{llm.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-bg"
                      style={{ width: `${(llm.mentions / llmData[0].mentions) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{llm.mentions}</span>
                  <Badge variant="success" className="text-xs">{llm.trend}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Produits les plus mentionnés par les LLMs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                <span className="text-2xl font-bold text-muted-foreground/30 w-8">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.mentions} mentions &middot; Score {p.score}/100</p>
                </div>
                <div className="h-2 w-24 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full gradient-bg"
                    style={{ width: `${(p.mentions / topProducts[0].mentions) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
