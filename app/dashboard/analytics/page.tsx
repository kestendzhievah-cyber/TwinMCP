'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
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
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState<UsageData | null>(null);

  // Mock data for demo
  useEffect(() => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setData({
        period,
        summary: {
          totalRequests: period === 'day' ? 1234 : period === 'week' ? 8456 : 32145,
          totalTokens: period === 'day' ? 456000 : period === 'week' ? 3200000 : 12800000,
          avgResponseTime: 145,
          successRate: 98.7,
        },
        byTool: [
          { tool: 'resolve-library-id', count: 456, tokens: 12000, avgResponseTime: 120 },
          { tool: 'query-docs', count: 778, tokens: 444000, avgResponseTime: 168 },
        ],
        usageOverTime: Array.from({ length: period === 'day' ? 24 : period === 'week' ? 7 : 30 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * (period === 'day' ? 3600000 : 86400000)).toISOString(),
          requests: Math.floor(Math.random() * 100) + 20,
          tokens: Math.floor(Math.random() * 50000) + 10000,
        })).reverse(),
        quotas: [
          {
            keyId: '1',
            keyPrefix: 'tmcp_prod',
            name: 'Production',
            tier: 'professional',
            daily: { used: 1234, limit: 10000, percentage: 12.34, remaining: 8766 },
            monthly: { used: 32145, limit: 300000, percentage: 10.72, remaining: 267855 },
          },
          {
            keyId: '2',
            keyPrefix: 'tmcp_test',
            name: 'Test',
            tier: 'free',
            daily: { used: 45, limit: 100, percentage: 45, remaining: 55 },
            monthly: { used: 890, limit: 3000, percentage: 29.67, remaining: 2110 },
          },
        ],
      });
      setLoading(false);
    }, 500);
  }, [period]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = data ? [
    {
      label: 'Requêtes totales',
      value: formatNumber(data.summary.totalRequests),
      change: '+12.5%',
      trend: 'up',
      icon: Activity,
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/10',
    },
    {
      label: 'Tokens consommés',
      value: formatNumber(data.summary.totalTokens),
      change: '+8.3%',
      trend: 'up',
      icon: Zap,
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-purple-600/10',
    },
    {
      label: 'Temps de réponse',
      value: `${data.summary.avgResponseTime}ms`,
      change: '-5.2%',
      trend: 'down',
      icon: Clock,
      color: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/10',
    },
    {
      label: 'Taux de succès',
      value: `${data.summary.successRate}%`,
      change: '+0.3%',
      trend: 'up',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-600/10',
    },
  ] : [];

  // Simple bar chart component
  const SimpleBarChart = ({ data: chartData }: { data: { value: number; label: string }[] }) => {
    const maxValue = Math.max(...chartData.map(d => d.value));
    return (
      <div className="flex items-end gap-1 h-40">
        {chartData.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-gradient-to-t from-purple-500 to-pink-500 rounded-t opacity-80 hover:opacity-100 transition"
              style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-gray-500 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

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
            Surveillez l'utilisation de vos API et quotas
          </p>
        </div>
        
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
              >
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
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
              <SimpleBarChart
                data={data.usageOverTime.slice(-12).map((item, i) => ({
                  value: item.requests,
                  label: period === 'day' ? `${i}h` : period === 'week' ? `J${i + 1}` : `${i + 1}`,
                }))}
              />
            </div>

            {/* By Tool */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Utilisation par outil
              </h3>
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
                        style={{ width: `${(tool.count / data.summary.totalRequests) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quotas */}
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Utilisation des quotas
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.quotas.map((quota, index) => (
                <div key={index} className="p-5 bg-[#0f1020] rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-white">{quota.name}</h4>
                      <p className="text-sm text-gray-500">{quota.keyPrefix}... • {quota.tier}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      quota.tier === 'professional' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
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
                        style={{ width: `${quota.daily.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{quota.daily.remaining} restants</p>
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
                        style={{ width: `${quota.monthly.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatNumber(quota.monthly.remaining)} restants</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
