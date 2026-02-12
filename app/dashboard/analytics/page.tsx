'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart3,
  Clock,
  Zap,
  Activity,
  CheckCircle,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface UsageData {
  period: string;
  summary: {
    totalRequests: number;
    totalTokens: number;
    avgResponseTime: number;
    successRate: number;
  };
  byTool: { tool: string; count: number; tokens: number; avgResponseTime: number }[];
  usageOverTime: { timestamp: string; requests: number; tokens: number }[];
  quotas: {
    keyId: string;
    keyPrefix: string;
    name: string;
    tier: string;
    daily: { used: number; limit: number; percentage: number; remaining: number };
    monthly: { used: number; limit: number; percentage: number; remaining: number };
  }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let token = '';
      try {
        token = await user.getIdToken();
      } catch (tokenError) {
        console.warn('Could not get ID token');
      }

      const response = await fetch(`/api/v1/analytics?period=${period}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Erreur de chargement');
        setData(getEmptyData());
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Impossible de charger les analytics');
      setData(getEmptyData());
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    if (user) {
      fetchAnalytics();
    }
  }, [user, authLoading, router, fetchAnalytics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = data ? [
    {
      label: 'Requêtes totales',
      value: formatNumber(data.summary.totalRequests),
      change: data.summary.totalRequests > 0 ? '+12.5%' : '0%',
      trend: 'up' as const,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/10',
    },
    {
      label: 'Tokens consommés',
      value: formatNumber(data.summary.totalTokens),
      change: data.summary.totalTokens > 0 ? '+8.3%' : '0%',
      trend: 'up' as const,
      icon: Zap,
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-purple-600/10',
    },
    {
      label: 'Temps de réponse',
      value: data.summary.avgResponseTime > 0 ? `${data.summary.avgResponseTime}ms` : '-',
      change: data.summary.avgResponseTime > 0 ? '-5.2%' : '0%',
      trend: 'down' as const,
      icon: Clock,
      color: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/10',
    },
    {
      label: 'Taux de succès',
      value: `${data.summary.successRate}%`,
      change: '+0.3%',
      trend: 'up' as const,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-600/10',
    },
  ] : [];

  // Simple bar chart component
  const SimpleBarChart = ({ data: chartData }: { data: { value: number; label: string }[] }) => {
    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    return (
      <div className="flex items-end gap-1 h-40">
        {chartData.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t transition-all ${
                item.value > 0 
                  ? 'bg-gradient-to-t from-purple-500 to-pink-500 opacity-80 hover:opacity-100' 
                  : 'bg-gray-700/50'
              }`}
              style={{ height: `${Math.max((item.value / maxValue) * 100, 4)}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-gray-500 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-purple-400" />
            Analytics
          </h1>
          <p className="text-gray-400 mt-1">
            Surveillez l'utilisation de vos API et quotas en temps réel
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white rounded-xl hover:bg-purple-500/10 transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Period Selector */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none px-4 py-3 pr-10 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition cursor-pointer"
            >
              <option value="day">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">Attention</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : data && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`bg-gradient-to-br ${stat.bg} backdrop-blur-xl border border-purple-500/20 rounded-2xl p-5`}
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  {data.summary.totalRequests > 0 && (
                    <span className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stat.trend === 'up' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {stat.change}
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Over Time */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Requêtes dans le temps
              </h3>
              {data.usageOverTime.length > 0 ? (
                <SimpleBarChart
                  data={data.usageOverTime.slice(-12).map((item, i) => ({
                    value: item.requests,
                    label: period === 'day' 
                      ? new Date(item.timestamp).getHours() + 'h'
                      : period === 'week' 
                        ? `J${i + 1}` 
                        : `${i + 1}`,
                  }))}
                />
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-500">
                  Aucune donnée pour cette période
                </div>
              )}
            </div>

            {/* By Tool */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Utilisation par outil
              </h3>
              {data.byTool.length > 0 ? (
                <div className="space-y-4">
                  {data.byTool.map((tool, index) => (
                    <div key={index} className="p-4 bg-[#0f1020] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{tool.tool}</span>
                        <span className="text-purple-400 font-semibold">{tool.count} appels</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{formatNumber(tool.tokens)} tokens</span>
                        <span>~{tool.avgResponseTime}ms</span>
                      </div>
                      <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${Math.min((tool.count / data.summary.totalRequests) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-500">
                  Aucun outil utilisé pour cette période
                </div>
              )}
            </div>
          </div>

          {/* Quotas */}
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Utilisation des quotas
            </h3>
            {data.quotas.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.quotas.map((quota, index) => (
                  <div key={index} className="p-5 bg-[#0f1020] rounded-xl" data-testid={`quota-${quota.keyId}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-white">{quota.name}</h4>
                        <p className="text-sm text-gray-500">{quota.keyPrefix}...</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        quota.tier === 'pro' ? 'bg-purple-500/20 text-purple-400' : 
                        quota.tier === 'enterprise' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {quota.tier}
                      </span>
                    </div>

                    {/* Daily Quota */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Quotidien</span>
                        <span className="text-white">
                          {formatNumber(quota.daily.used)} / {formatNumber(quota.daily.limit)}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            quota.daily.percentage > 80 ? 'bg-red-500' : quota.daily.percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(quota.daily.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatNumber(quota.daily.remaining)} restants</p>
                    </div>

                    {/* Monthly Quota */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Mensuel</span>
                        <span className="text-white">
                          {formatNumber(quota.monthly.used)} / {formatNumber(quota.monthly.limit)}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            quota.monthly.percentage > 80 ? 'bg-red-500' : quota.monthly.percentage > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(quota.monthly.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatNumber(quota.monthly.remaining)} restants</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune clé API active</p>
                <p className="text-sm mt-1">Créez une clé API pour voir les quotas</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getEmptyData(): UsageData {
  return {
    period: 'day',
    summary: {
      totalRequests: 0,
      totalTokens: 0,
      avgResponseTime: 0,
      successRate: 100
    },
    byTool: [],
    usageOverTime: [],
    quotas: []
  };
}
