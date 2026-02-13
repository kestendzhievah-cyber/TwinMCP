'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardPageSkeleton } from '@/components/DashboardSkeleton';
import {
  Plus,
  Sparkles,
  Key,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Activity,
  AlertTriangle,
  Server,
  BarChart3,
  Zap,
  ArrowRight,
  Copy,
  Trash2,
  ExternalLink,
  Crown,
  Shield,
  BookOpen,
  MessageSquare,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

interface ApiKeyStats {
  id: string;
  keyPrefix: string;
  name: string;
  tier: string;
  quotaDaily: number;
  quotaHourly: number;
  createdAt: string;
  lastUsedAt: string | null;
  usage: {
    requestsToday: number;
    requestsThisHour: number;
    successRate: number;
  };
}

interface DashboardData {
  totalKeys: number;
  totalRequestsToday: number;
  totalRequestsMonth: number;
  averageSuccessRate: number;
  subscription: {
    plan: string;
    dailyLimit: number;
    monthlyLimit: number;
    usedToday: number;
    usedMonth: number;
  };
  keys: ApiKeyStats[];
  recentActivity: {
    timestamp: string;
    toolName: string;
    success: boolean;
    responseTimeMs: number;
  }[];
}

interface MCPServerStatus {
  isOnline: boolean;
  serverInfo: { name: string; version: string } | null;
  tools: { name: string; description: string }[];
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

const PLAN_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: 'Gratuit', color: 'text-gray-400 bg-gray-500/20 border-gray-500/30', icon: <Zap className="w-4 h-4" /> },
  pro: { label: 'Pro', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30', icon: <Crown className="w-4 h-4" /> },
  enterprise: { label: 'Enterprise', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30', icon: <Shield className="w-4 h-4" /> },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<MCPServerStatus>({
    isOnline: false,
    serverInfo: null,
    tools: [],
    lastChecked: new Date(),
    responseTime: 0,
  });
  const [mcpLoading, setMcpLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{ key: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      let token = '';
      try {
        token = await user.getIdToken();
      } catch (tokenError) {
        console.warn('Could not get ID token, user may need to re-authenticate');
      }

      const response = await fetch('/api/v1/dashboard', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else if (response.status === 401) {
        // User needs to re-authenticate
        setError('Session expirée. Veuillez vous reconnecter.');
        // Set empty data to show dashboard skeleton
        setDashboardData({
          totalKeys: 0,
          totalRequestsToday: 0,
          totalRequestsMonth: 0,
          averageSuccessRate: 100,
          subscription: { plan: 'free', dailyLimit: 200, monthlyLimit: 6000, usedToday: 0, usedMonth: 0 },
          keys: [],
          recentActivity: []
        });
      } else {
        setError(result.error || 'Erreur de chargement');
        // Set empty data on error
        setDashboardData({
          totalKeys: 0,
          totalRequestsToday: 0,
          totalRequestsMonth: 0,
          averageSuccessRate: 100,
          subscription: { plan: 'free', dailyLimit: 200, monthlyLimit: 6000, usedToday: 0, usedMonth: 0 },
          keys: [],
          recentActivity: []
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Impossible de charger les données');
      // Set empty data to show dashboard anyway
      setDashboardData({
        totalKeys: 0,
        totalRequestsToday: 0,
        totalRequestsMonth: 0,
        averageSuccessRate: 100,
        subscription: { plan: 'free', dailyLimit: 200, monthlyLimit: 6000, usedToday: 0, usedMonth: 0 },
        keys: [],
        recentActivity: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Check MCP status
  const checkMCPStatus = useCallback(async () => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/mcp');
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      setMcpStatus({
        isOnline: true,
        serverInfo: { name: data.name || 'TwinMCP', version: data.version || '1.0.0' },
        tools: data.tools || [],
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      setMcpStatus({
        isOnline: false,
        serverInfo: null,
        tools: [],
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setMcpLoading(false);
    }
  }, []);

  // Create new API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !user) return;

    setCreatingKey(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        setNewApiKey({ key: result.data.key, name: newKeyName });
        setShowCreateModal(false);
        setNewKeyName('');
        fetchDashboardData();
      } else {
        alert(result.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('Create key error:', err);
      alert('Erreur lors de la création de la clé');
    } finally {
      setCreatingKey(false);
    }
  };

  // Revoke API key
  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cette clé ? Cette action est irréversible.')) {
      return;
    }

    if (!user) return;

    setRevokingKey(keyId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/api-keys?id=${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        fetchDashboardData();
      } else {
        alert(result.error || 'Erreur lors de la révocation');
      }
    } catch (err) {
      console.error('Revoke key error:', err);
      alert('Erreur lors de la révocation');
    } finally {
      setRevokingKey(null);
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  // Refresh data
  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    checkMCPStatus();
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return undefined;
    }

    if (user) {
      fetchDashboardData();
      checkMCPStatus();

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardData();
        checkMCPStatus();
      }, 30000);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [user, authLoading, router, fetchDashboardData, checkMCPStatus]);

  // Hooks must be called before any early returns to respect React rules of hooks
  const plan = dashboardData?.subscription?.plan || 'free';
  const planInfo = PLAN_LABELS[plan] || PLAN_LABELS.free;
  const usagePercentToday = useMemo(() => dashboardData 
    ? Math.round((dashboardData.subscription.usedToday / dashboardData.subscription.dailyLimit) * 100)
    : 0, [dashboardData]);

  // Use conditional rendering in JSX instead of early returns to avoid hooks ordering issues
  if (authLoading || loading) {
    return <DashboardPageSkeleton />;
  }

  if (error && !dashboardData) {
    return (
      <div className="space-y-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-400 mb-2">Erreur de chargement</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Bienvenue sur <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">TwinMCP</span>
          </h1>
          <p className="text-gray-400 flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full border ${planInfo.color} flex items-center gap-1`}>
              {planInfo.icon}
              {planInfo.label}
            </span>
            {plan === 'free' && (
              <Link href="/pricing" className="text-purple-400 hover:text-purple-300 text-sm underline">
                Passer au Pro →
              </Link>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white rounded-xl hover:bg-purple-500/10 transition"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2 shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-5 h-5" />
            Nouvelle clé API
          </button>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Utilisation aujourd'hui
            </h2>
            <p className="text-sm text-gray-400">
              {dashboardData?.subscription.usedToday.toLocaleString()} / {dashboardData?.subscription.dailyLimit.toLocaleString()} requêtes
            </p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${
              usagePercentToday < 50 ? 'text-green-400' : 
              usagePercentToday < 80 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {usagePercentToday}%
            </span>
            <p className="text-xs text-gray-500">utilisé</p>
          </div>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              usagePercentToday < 50 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
              usagePercentToday < 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
              'bg-gradient-to-r from-red-500 to-pink-500'
            }`}
            style={{ width: `${Math.min(usagePercentToday, 100)}%` }}
          />
        </div>
        {usagePercentToday >= 80 && (
          <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Vous approchez de votre limite quotidienne.</span>
            {plan === 'free' && (
              <Link href="/pricing" className="underline">Passez au Pro</Link>
            )}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Key className="w-6 h-6 text-purple-400" />
            <span className="text-2xl font-bold text-purple-400">{dashboardData?.totalKeys || 0}</span>
          </div>
          <p className="text-gray-400 text-sm">Clés API actives</p>
        </div>
        
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {dashboardData?.totalRequestsToday.toLocaleString() || 0}
            </span>
          </div>
          <p className="text-gray-400 text-sm">Requêtes aujourd'hui</p>
        </div>
        
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">
              {dashboardData?.totalRequestsMonth.toLocaleString() || 0}
            </span>
          </div>
          <p className="text-gray-400 text-sm">Requêtes ce mois</p>
        </div>
        
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">
              {dashboardData?.averageSuccessRate || 100}%
            </span>
          </div>
          <p className="text-gray-400 text-sm">Taux de succès</p>
        </div>
      </div>

      {/* MCP Server Status */}
      <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Serveur MCP
          </h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            mcpStatus.isOnline 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              mcpStatus.isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            {mcpLoading ? 'Vérification...' : mcpStatus.isOnline ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>
        
        {mcpStatus.isOnline && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0f1020] rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Version</p>
              <p className="font-semibold">{mcpStatus.serverInfo?.version}</p>
            </div>
            <div className="bg-[#0f1020] rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Outils</p>
              <p className="font-semibold">{mcpStatus.tools.length}</p>
            </div>
            <div className="bg-[#0f1020] rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Latence</p>
              <p className="font-semibold">{mcpStatus.responseTime}ms</p>
            </div>
          </div>
        )}
      </div>

      {/* API Keys List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            Vos clés API
          </h2>
          <Link
            href="/dashboard/api-keys"
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            Gérer les clés
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {(!dashboardData?.keys || dashboardData.keys.length === 0) ? (
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 text-center">
            <Key className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Aucune clé API</h3>
            <p className="text-gray-400 mb-4">Créez votre première clé API pour commencer</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Créer une clé
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardData.keys.map((key) => (
              <div
                key={key.id}
                className="bg-[#1a1b2e] border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/40 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{key.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-[#0f1020] px-2 py-0.5 rounded text-purple-400">
                        {key.keyPrefix}...
                      </code>
                      <button
                        onClick={() => handleCopy(key.keyPrefix)}
                        className="text-gray-400 hover:text-purple-400 transition"
                      >
                        {copiedKey === key.keyPrefix ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    disabled={revokingKey === key.id}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    {revokingKey === key.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0f1020] rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Aujourd'hui</span>
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-white">{key.usage.requestsToday}</span>
                      <span className="text-xs text-gray-500">/ {key.quotaDaily}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          (key.usage.requestsToday / key.quotaDaily) < 0.5 ? 'bg-green-500' :
                          (key.usage.requestsToday / key.quotaDaily) < 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((key.usage.requestsToday / key.quotaDaily) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#0f1020] rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Cette heure</span>
                      <Clock className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="font-semibold text-white">{key.usage.requestsThisHour}</span>
                  </div>

                  <div className="bg-[#0f1020] rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Succès</span>
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                    <span className={`font-semibold ${
                      key.usage.successRate >= 95 ? 'text-green-400' :
                      key.usage.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {key.usage.successRate}%
                    </span>
                  </div>
                </div>

                {key.lastUsedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Dernière utilisation : {new Date(key.lastUsedAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/analytics"
          className="group p-5 bg-[#1a1b2e] border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition"
          data-testid="quick-action-analytics"
        >
          <BarChart3 className="w-8 h-8 text-blue-400 mb-3" />
          <p className="font-medium text-white group-hover:text-purple-400 transition">Analytics</p>
          <p className="text-xs text-gray-500 mt-1">Statistiques en temps réel</p>
        </Link>
        
        <Link
          href="/dashboard/billing"
          className="group p-5 bg-[#1a1b2e] border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition"
          data-testid="quick-action-billing"
        >
          <Crown className="w-8 h-8 text-yellow-400 mb-3" />
          <p className="font-medium text-white group-hover:text-purple-400 transition">Facturation</p>
          <p className="text-xs text-gray-500 mt-1">Abonnement & factures</p>
        </Link>
        
        <Link
          href="/dashboard/api-keys"
          className="group p-5 bg-[#1a1b2e] border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition"
          data-testid="quick-action-api-keys"
        >
          <Key className="w-8 h-8 text-purple-400 mb-3" />
          <p className="font-medium text-white group-hover:text-purple-400 transition">Clés API</p>
          <p className="text-xs text-gray-500 mt-1">Gérer vos clés</p>
        </Link>
        
        <Link
          href="/dashboard/docs"
          className="group p-5 bg-[#1a1b2e] border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition"
          data-testid="quick-action-docs"
        >
          <BookOpen className="w-8 h-8 text-green-400 mb-3" />
          <p className="font-medium text-white group-hover:text-purple-400 transition">Documentation</p>
          <p className="text-xs text-gray-500 mt-1">Guides & API</p>
        </Link>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Nouvelle clé API</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Nom de la clé</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Production, Développement..."
                className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                La clé complète ne sera affichée qu'une seule fois.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || creatingKey}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingKey ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-green-500/30 rounded-2xl p-6 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Clé créée avec succès !</h2>
              <p className="text-gray-400 text-sm">Copiez et sauvegardez cette clé maintenant.</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Votre clé API</label>
              <div className="relative">
                <input
                  type="text"
                  value={newApiKey.key}
                  readOnly
                  className="w-full px-4 py-3 pr-12 bg-[#0f1020] border border-green-500/30 rounded-lg text-green-400 font-mono text-sm"
                />
                <button
                  onClick={() => handleCopy(newApiKey.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 hover:text-green-300"
                >
                  {copiedKey === newApiKey.key ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              {copiedKey === newApiKey.key && (
                <p className="text-sm text-green-400 mt-2">✓ Copiée !</p>
              )}
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Cette clé ne sera plus jamais affichée. Sauvegardez-la maintenant !
              </p>
            </div>

            <button
              onClick={() => setNewApiKey(null)}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
            >
              J'ai sauvegardé ma clé
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
