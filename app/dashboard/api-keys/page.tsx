'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  Shield,
  Clock,
  TrendingUp,
  Check,
  AlertTriangle,
  BarChart3,
  XCircle,
  Pencil,
  ChevronRight,
  X,
  Activity,
  Zap,
  CalendarClock,
  Timer,
} from 'lucide-react';
import { apiClient } from '@/lib/client/api-client';
import { useAuth } from '@/lib/auth-context';

// ─── Types ───────────────────────────────────────────────────────
interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  tier?: string;
  quotaRequestsPerMinute: number;
  quotaRequestsPerDay: number;
  lastUsedAt?: string;
  expiresAt?: string | null;
  createdAt: string;
  usage?: {
    requestsToday: number;
    requestsThisHour: number;
    successRate: number;
  };
}

interface UsageHistory {
  date: string;
  requests: number;
  successes: number;
  errors: number;
  avgResponseTime: number;
}

interface UsageAnalytics {
  topTools: { tool: string; count: number; successRate: number }[];
  recentErrors: { tool: string; error: string; at: string }[];
  totals: { today: number; thisWeek: number; thisMonth: number; allTime: number };
  avgResponseTime: number;
}

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Jamais' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '180d', label: '6 mois' },
  { value: '365d', label: '1 an' },
];

// ─── Mini Bar Chart (pure CSS, no deps) ──────────────────────────
function MiniChart({ data, maxH = 40 }: { data: { value: number; label: string }[]; maxH?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-[2px] h-[40px]" style={{ height: maxH }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 group relative">
          <div
            className="w-full bg-purple-500/60 rounded-t-sm transition-all hover:bg-purple-400/80"
            style={{ height: `${Math.max((d.value / max) * maxH, 2)}px` }}
          />
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-xs text-white px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function ApiKeysPage() {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpires, setNewKeyExpires] = useState('never');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{ key: string; prefix: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  // Usage detail panel
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  // ─── Load all keys ──────────────────────────────────────────────
  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    setDbUnavailable(false);
    try {
      const result = await apiClient.getApiKeys();
      if (result.success && Array.isArray(result.data)) {
        setApiKeys(result.data);
      } else if (result.code === 'DB_UNAVAILABLE') {
        setDbUnavailable(true);
        setApiKeys([]);
      } else {
        showError(result.error || 'Erreur lors du chargement des cl\u00e9s API');
        setApiKeys([]);
      }
    } catch (error: any) {
      if (error.message?.includes('503') || error.message?.includes('indisponible')) {
        setDbUnavailable(true);
      } else {
        showError(error.message || 'Erreur de connexion');
      }
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      showError('Veuillez vous connecter pour g\u00e9rer vos cl\u00e9s API');
      return;
    }
    loadApiKeys();
  }, [loadApiKeys, user, authLoading, showError]);

  // ─── Load usage for selected key ────────────────────────────────
  const loadKeyUsage = useCallback(async (keyId: string) => {
    setUsageLoading(true);
    try {
      const result = await apiClient.getKeyUsage(keyId, 30);
      if (result.success && result.data) {
        setUsageHistory(result.data.history || []);
        setUsageAnalytics(result.data.analytics || null);
      }
    } catch {
      // Graceful degradation — panel shows empty state
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKeyId) loadKeyUsage(selectedKeyId);
  }, [selectedKeyId, loadKeyUsage]);

  // ─── Create key ─────────────────────────────────────────────────
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await apiClient.createApiKey(
        newKeyName.trim(),
        newKeyExpires !== 'never' ? newKeyExpires : undefined
      );

      if (result.success && result.data) {
        setNewApiKey({ key: result.data.key, prefix: result.data.keyPrefix });
        setShowCreateModal(false);
        setNewKeyName('');
        setNewKeyExpires('never');

        const newKey: ApiKey = {
          id: result.data.id,
          keyPrefix: result.data.keyPrefix,
          name: result.data.name || newKeyName.trim(),
          tier: result.data.tier,
          quotaRequestsPerMinute: result.data.quotaRequestsPerMinute || 20,
          quotaRequestsPerDay: result.data.quotaRequestsPerDay || 200,
          expiresAt: result.data.expiresAt || null,
          createdAt: result.data.createdAt,
          usage: result.data.usage || { requestsToday: 0, requestsThisHour: 0, successRate: 100 },
        };
        setApiKeys((prev) => [newKey, ...prev]);
      } else if (result.code === 'DB_UNAVAILABLE') {
        setDbUnavailable(true);
        setShowCreateModal(false);
      } else {
        showError(result.error || 'Impossible de cr\u00e9er la cl\u00e9 API');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingKey(false);
    }
  };

  // ─── Revoke key ─────────────────────────────────────────────────
  const handleRevokeKey = async (keyId: string) => {
    setRevokeConfirm(null);
    setRevokingKey(keyId);
    try {
      const result = await apiClient.revokeApiKey(keyId);
      if (result.success) {
        setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
        if (selectedKeyId === keyId) setSelectedKeyId(null);
        showSuccess('Cl\u00e9 r\u00e9voqu\u00e9e avec succ\u00e8s');
      } else {
        showError(result.error || 'Impossible de r\u00e9voquer la cl\u00e9 API');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      setRevokingKey(null);
    }
  };

  // ─── Rename key ─────────────────────────────────────────────────
  const handleRename = async (keyId: string) => {
    if (!renameValue.trim()) return;
    try {
      const result = await apiClient.renameApiKey(keyId, renameValue.trim());
      if (result.success) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, name: renameValue.trim() } : k))
        );
        showSuccess('Cl\u00e9 renomm\u00e9e');
      } else {
        showError(result.error || 'Erreur lors du renommage');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      setRenamingId(null);
      setRenameValue('');
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatShortDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-400';
    if (rate >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const isExpiringSoon = (expiresAt?: string | null) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // 7 days
  };

  const isExpired = (expiresAt?: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  };

  const selectedKey = useMemo(
    () => apiKeys.find((k) => k.id === selectedKeyId) || null,
    [apiKeys, selectedKeyId]
  );

  // ─── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      activeKeys: apiKeys.length,
      requestsToday: apiKeys.reduce((s, k) => s + (k.usage?.requestsToday || 0), 0),
      requestsThisHour: apiKeys.reduce((s, k) => s + (k.usage?.requestsThisHour || 0), 0),
      avgSuccess:
        apiKeys.length > 0
          ? +(
              apiKeys.reduce((s, k) => s + (k.usage?.successRate ?? 100), 0) / apiKeys.length
            ).toFixed(1)
          : 100,
    }),
    [apiKeys]
  );

  // ─── Chart data for selected key ───────────────────────────────
  const chartData = useMemo(() => {
    if (!usageHistory.length) return [];
    const last14 = usageHistory.slice(-14);
    return last14.map((h) => ({ value: h.requests, label: h.date }));
  }, [usageHistory]);

  return (
    <div className="space-y-6">
      {/* Toasts */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-[60] max-w-md animate-in slide-in-from-top-2">
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 shadow-lg backdrop-blur-sm">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Erreur</p>
              <p className="text-sm text-red-400/80 mt-0.5">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-[60] max-w-md animate-in slide-in-from-top-2">
          <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 flex items-start gap-3 shadow-lg backdrop-blur-sm">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="w-7 h-7 text-purple-400" />
            Cl\u00e9s API
          </h1>
          <p className="text-gray-400 mt-1">G\u00e9rez vos cl\u00e9s d&apos;acc\u00e8s et suivez leur utilisation en temps r\u00e9el</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadApiKeys}
            disabled={loading}
            className="p-2.5 bg-[#1a1b2e] border border-purple-500/20 text-gray-400 rounded-xl hover:text-white hover:border-purple-500/40 transition disabled:opacity-50"
            title="Rafra\u00eechir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle cl\u00e9
          </button>
        </div>
      </div>

      {/* DB Unavailable */}
      {dbUnavailable && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-300">Base de donn\u00e9es indisponible</h3>
            <p className="text-sm text-yellow-400/80 mt-0.5">
              La base de donn\u00e9es n&apos;est pas accessible pour le moment.
            </p>
          </div>
          <button
            onClick={loadApiKeys}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500/20 text-yellow-300 text-sm font-medium rounded-lg hover:bg-yellow-500/30 transition disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            R\u00e9essayer
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Key, color: 'purple', value: stats.activeKeys, label: 'Cl\u00e9s actives' },
          { icon: TrendingUp, color: 'green', value: stats.requestsToday, label: "Requ\u00eates aujourd'hui" },
          { icon: BarChart3, color: 'blue', value: stats.requestsThisHour, label: 'Requ\u00eates cette heure' },
          { icon: Shield, color: 'yellow', value: `${stats.avgSuccess}%`, label: 'Taux de succ\u00e8s' },
        ].map((s, i) => (
          <div key={i} className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-6 h-6 text-${s.color}-400`} />
              <span className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</span>
            </div>
            <p className="text-gray-400 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main content: keys list + usage panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Keys List */}
        <div className={`flex-1 min-w-0 ${selectedKeyId ? 'lg:w-1/2' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <span className="ml-3 text-gray-400">Chargement des cl\u00e9s API...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 text-center">
              <Key className="w-12 h-12 mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Aucune cl\u00e9 API</h3>
              <p className="text-gray-400 mb-6">Cr\u00e9ez votre premi\u00e8re cl\u00e9 API pour commencer</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Cr\u00e9er une cl\u00e9 API
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className={`bg-[#1a1b2e] border rounded-2xl p-5 transition cursor-pointer ${
                    selectedKeyId === apiKey.id
                      ? 'border-purple-500/60 ring-1 ring-purple-500/30'
                      : 'border-purple-500/20 hover:border-purple-500/40'
                  }`}
                  onClick={() => setSelectedKeyId(selectedKeyId === apiKey.id ? null : apiKey.id)}
                >
                  {/* Key header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      {renamingId === apiKey.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(apiKey.id);
                              if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                            }}
                            className="px-2 py-1 bg-[#0f1020] border border-purple-500/40 rounded text-white text-sm focus:outline-none focus:border-purple-500 w-48"
                            autoFocus
                          />
                          <button onClick={() => handleRename(apiKey.id)} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setRenamingId(null); setRenameValue(''); }} className="text-gray-400 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white truncate">{apiKey.name}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(apiKey.id);
                              setRenameValue(apiKey.name);
                            }}
                            className="text-gray-500 hover:text-purple-400 transition"
                            title="Renommer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-[#0f1020] px-2 py-0.5 rounded text-purple-400 text-xs font-mono">
                          {apiKey.keyPrefix}...
                        </code>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyKey(apiKey.keyPrefix); }}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {copiedKey === apiKey.keyPrefix ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Expiration badge */}
                      {isExpired(apiKey.expiresAt) && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Expir\u00e9e</span>
                      )}
                      {isExpiringSoon(apiKey.expiresAt) && !isExpired(apiKey.expiresAt) && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">Expire bient\u00f4t</span>
                      )}
                      {/* Tier badge */}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        apiKey.tier === 'enterprise' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : apiKey.tier === 'pro' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {apiKey.tier === 'enterprise' ? 'Enterprise' : apiKey.tier === 'pro' ? 'Pro' : 'Free'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRevokeConfirm({ id: apiKey.id, name: apiKey.name }); }}
                        disabled={revokingKey === apiKey.id}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                      >
                        {revokingKey === apiKey.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${selectedKeyId === apiKey.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Usage bars */}
                  {apiKey.usage && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-[#0f1020] rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Aujourd&apos;hui</span>
                          <span className="text-xs font-semibold text-white">{apiKey.usage.requestsToday}<span className="text-gray-500 font-normal">/{apiKey.quotaRequestsPerDay}</span></span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay < 0.5 ? 'bg-green-500'
                              : apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay < 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-[#0f1020] rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Cette heure</span>
                          <span className="text-xs font-semibold text-white">{apiKey.usage.requestsThisHour}<span className="text-gray-500 font-normal">/{apiKey.quotaRequestsPerMinute * 60}</span></span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              apiKey.usage.requestsThisHour / (apiKey.quotaRequestsPerMinute * 60) < 0.5 ? 'bg-green-500'
                              : apiKey.usage.requestsThisHour / (apiKey.quotaRequestsPerMinute * 60) < 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((apiKey.usage.requestsThisHour / (apiKey.quotaRequestsPerMinute * 60)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-[#0f1020] rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Succ\u00e8s</span>
                          <span className={`text-xs font-semibold ${getSuccessRateColor(apiKey.usage.successRate)}`}>{apiKey.usage.successRate}%</span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${apiKey.usage.successRate}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-t border-purple-500/10 pt-2">
                    <span>Cr\u00e9\u00e9e le {formatDate(apiKey.createdAt)}</span>
                    {apiKey.lastUsedAt && <span>Derni\u00e8re utilisation {formatDate(apiKey.lastUsedAt)}</span>}
                    {apiKey.expiresAt && !isExpired(apiKey.expiresAt) && (
                      <span className={isExpiringSoon(apiKey.expiresAt) ? 'text-orange-400' : ''}>
                        Expire le {formatShortDate(apiKey.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Detail Panel */}
        {selectedKeyId && selectedKey && (
          <div className="lg:w-[420px] flex-shrink-0 space-y-4">
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Utilisation — {selectedKey.name}
                </h3>
                <button onClick={() => setSelectedKeyId(null)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {usageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              ) : (
                <>
                  {/* Mini chart */}
                  {chartData.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Requ\u00eates (14 derniers jours)</p>
                      <MiniChart data={chartData} />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                        <span>{chartData[0]?.label}</span>
                        <span>{chartData[chartData.length - 1]?.label}</span>
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  {usageAnalytics && (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                          { label: "Aujourd'hui", value: usageAnalytics.totals.today, icon: Zap },
                          { label: 'Cette semaine', value: usageAnalytics.totals.thisWeek, icon: CalendarClock },
                          { label: 'Ce mois', value: usageAnalytics.totals.thisMonth, icon: BarChart3 },
                          { label: 'Temps moyen', value: `${usageAnalytics.avgResponseTime}ms`, icon: Timer },
                        ].map((t, i) => (
                          <div key={i} className="bg-[#0f1020] rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <t.icon className="w-3 h-3 text-gray-500" />
                              <span className="text-[10px] uppercase tracking-wider text-gray-500">{t.label}</span>
                            </div>
                            <span className="text-lg font-bold text-white">{t.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Top tools */}
                      {usageAnalytics.topTools.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">Top outils</p>
                          <div className="space-y-1.5">
                            {usageAnalytics.topTools.slice(0, 5).map((t, i) => (
                              <div key={i} className="flex items-center justify-between bg-[#0f1020] rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-300 truncate mr-2">{t.tool}</span>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className="text-xs font-semibold text-white">{t.count}</span>
                                  <span className={`text-xs ${getSuccessRateColor(t.successRate)}`}>{t.successRate}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent errors */}
                      {usageAnalytics.recentErrors.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Erreurs r\u00e9centes</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {usageAnalytics.recentErrors.slice(0, 5).map((e, i) => (
                              <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-medium text-red-400">{e.tool}</span>
                                  <span className="text-[10px] text-gray-500">{formatShortDate(e.at)}</span>
                                </div>
                                <p className="text-[11px] text-gray-400 truncate">{e.error}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty analytics */}
                      {usageAnalytics.totals.allTime === 0 && (
                        <div className="text-center py-6">
                          <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Aucune utilisation encore</p>
                          <p className="text-xs text-gray-600 mt-1">Les statistiques appara\u00eetront d\u00e8s que vous utiliserez cette cl\u00e9</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Key Modal ─────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Nouvelle cl\u00e9 API</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Nom de la cl\u00e9</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKeyName.trim() && !creatingKey) handleCreateKey();
                }}
                placeholder="Ex: Production, D\u00e9veloppement..."
                className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Expiration</label>
              <div className="grid grid-cols-5 gap-2">
                {EXPIRATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNewKeyExpires(opt.value)}
                    className={`px-2 py-2 text-xs rounded-lg border transition ${
                      newKeyExpires === opt.value
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-[#0f1020] border-purple-500/20 text-gray-400 hover:border-purple-500/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                La cl\u00e9 compl\u00e8te ne sera affich\u00e9e qu&apos;une seule fois.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setNewKeyName(''); setNewKeyExpires('never'); }}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || creatingKey}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingKey ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Cr\u00e9ation...</>) : 'Cr\u00e9er'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Revoke Confirmation ──────────────────────────────────── */}
      {revokeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">R\u00e9voquer cette cl\u00e9 ?</h2>
              <p className="text-gray-400 text-sm">
                La cl\u00e9 <strong className="text-white">{revokeConfirm.name}</strong> sera d\u00e9finitivement d\u00e9sactiv\u00e9e. Cette action est irr\u00e9versible.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRevokeConfirm(null)} className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition">Annuler</button>
              <button
                onClick={() => handleRevokeKey(revokeConfirm.id)}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> R\u00e9voquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New Key Display ──────────────────────────────────────── */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-green-500/30 rounded-2xl p-6 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Cl\u00e9 cr\u00e9\u00e9e avec succ\u00e8s !</h2>
              <p className="text-gray-400 text-sm">Copiez et sauvegardez cette cl\u00e9 maintenant.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Votre cl\u00e9 API</label>
              <div className="relative">
                <input
                  type="text"
                  value={newApiKey.key}
                  readOnly
                  className="w-full px-4 py-3 pr-12 bg-[#0f1020] border border-green-500/30 rounded-lg text-green-400 font-mono text-sm"
                />
                <button
                  onClick={() => handleCopyKey(newApiKey.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 hover:text-green-300"
                >
                  {copiedKey === newApiKey.key ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copiedKey === newApiKey.key && <p className="text-sm text-green-400 mt-2">Copi\u00e9e !</p>}
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Cette cl\u00e9 ne sera plus jamais affich\u00e9e. Sauvegardez-la maintenant !
              </p>
            </div>
            <button
              onClick={() => { setNewApiKey(null); setNewKeyName(''); }}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
            >
              J&apos;ai sauvegard\u00e9 ma cl\u00e9
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
