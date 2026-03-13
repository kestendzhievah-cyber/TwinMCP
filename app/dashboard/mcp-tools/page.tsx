'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  XCircle,
  CheckCircle,
  Lock,
  Zap,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Key,
  Crown,
  Sparkles,
  BarChart3,
  Filter,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface McpTool {
  id: string;
  name: string;
  slug: string;
  provider: string;
  description: string;
  category: string;
  docsUrl: string;
  requiresApiKey: boolean;
  envKeyName: string | null;
  tags: string[];
  popular: boolean;
  isActivated: boolean;
  activatedAt: string | null;
}

interface CategoryMeta {
  label: string;
  description: string;
  emoji: string;
  count: number;
}

interface CatalogData {
  tools: McpTool[];
  categories: Record<string, CategoryMeta>;
  totalTools: number;
  activatedCount: number;
  userPlan: string;
  isProUser: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export default function McpToolsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [apiKeyModal, setApiKeyModal] = useState<{ tool: McpTool } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const getToken = useCallback(async () => {
    if (!user) return '';
    try {
      return await user.getIdToken();
    } catch {
      return '';
    }
  }, [user]);

  const fetchCatalog = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedCategory) params.set('category', selectedCategory);

      const res = await fetch(`/api/v1/mcp-tools?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCatalog(data.data);
        setError(null);
      } else {
        setError(data.error || 'Erreur de chargement');
      }
    } catch {
      setError('Impossible de charger le catalogue');
    } finally {
      setLoading(false);
    }
  }, [getToken, searchQuery, selectedCategory]);

  const handleToggle = async (tool: McpTool) => {
    if (!catalog?.isProUser) return;

    // If activating and tool needs API key, show modal
    if (!tool.isActivated && tool.requiresApiKey) {
      setApiKeyModal({ tool });
      setApiKeyInput('');
      return;
    }

    await toggleTool(tool.id, tool.isActivated);
  };

  const toggleTool = async (toolId: string, isCurrentlyActive: boolean, config?: Record<string, unknown>) => {
    setTogglingId(toolId);
    try {
      const token = await getToken();
      const endpoint = isCurrentlyActive ? 'deactivate' : 'activate';
      const res = await fetch(`/api/v1/mcp-tools/${toolId}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: config ? JSON.stringify({ config }) : '{}',
      });
      const data = await res.json();
      if (data.success) {
        await fetchCatalog();
      } else {
        setError(data.error || 'Erreur lors de la modification');
        setTimeout(() => setError(null), 5000);
      }
    } catch {
      setError('Erreur réseau');
      setTimeout(() => setError(null), 5000);
    } finally {
      setTogglingId(null);
      setApiKeyModal(null);
    }
  };

  const handleApiKeySubmit = () => {
    if (!apiKeyModal || !apiKeyInput.trim()) return;
    const tool = apiKeyModal.tool;
    const configKey = tool.envKeyName || 'apiKey';
    toggleTool(tool.id, false, { [configKey]: apiKeyInput.trim() });
  };

  const initialLoadDone = React.useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }
    if (user) {
      fetchCatalog();
      initialLoadDone.current = true;
    }
  }, [user, authLoading, router, fetchCatalog]);

  // Debounce search (skip first render — already handled above)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    const timeout = setTimeout(() => fetchCatalog(), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCategory, user, fetchCatalog]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const categories = catalog?.categories ? Object.entries(catalog.categories) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Outils MCP
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {catalog?.totalTools ?? 0} intégrations disponibles — Activez vos outils préférés
          </p>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white font-medium">{catalog?.activatedCount ?? 0} actifs</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
            catalog?.isProUser
              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30'
              : 'bg-gray-800/50 border-gray-600/30'
          }`}>
            <Crown className={`w-4 h-4 ${catalog?.isProUser ? 'text-yellow-400' : 'text-gray-500'}`} />
            <span className={`text-sm font-medium ${catalog?.isProUser ? 'text-white' : 'text-gray-400'}`}>
              {catalog?.isProUser ? 'Plan Pro' : 'Plan Gratuit'}
            </span>
          </div>
        </div>
      </div>

      {/* Pro upgrade banner for free users */}
      {catalog && !catalog.isProUser && (
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" />
                Passez au plan Pro pour activer les Outils MCP
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Accédez à {catalog.totalTools} intégrations : GitHub, Notion, MongoDB, AWS, Stripe et bien plus.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/billing')}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30 whitespace-nowrap"
            >
              Upgrader — 14,99€/mois
            </button>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un outil..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={selectedCategory || ''}
            onChange={e => setSelectedCategory(e.target.value || null)}
            className="pl-10 pr-8 py-2.5 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white focus:border-purple-500 focus:outline-none appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.emoji} {meta.label} ({meta.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Category chips */}
      {!selectedCategory && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className="bg-[#1a1b2e] border border-purple-500/20 rounded-xl p-3 hover:border-purple-500/40 transition text-left group"
            >
              <span className="text-2xl">{meta.emoji}</span>
              <p className="text-sm font-medium text-white mt-1.5">{meta.label}</p>
              <p className="text-xs text-gray-500">{meta.count} outils</p>
            </button>
          ))}
        </div>
      )}

      {/* Tools grid */}
      {catalog && catalog.tools.length === 0 ? (
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-12 text-center">
          <Search className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">Aucun outil trouvé pour cette recherche.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog?.tools.map(tool => (
            <div
              key={tool.id}
              className={`bg-[#1a1b2e] border rounded-xl p-4 transition relative group ${
                tool.isActivated
                  ? 'border-green-500/30 shadow-sm shadow-green-500/10'
                  : 'border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              {/* Popular badge */}
              {tool.popular && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Populaire
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{tool.name}</h3>
                    {tool.isActivated && (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.provider}</p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(tool)}
                  disabled={!catalog?.isProUser || togglingId === tool.id}
                  className={`flex-shrink-0 ml-2 transition ${
                    !catalog?.isProUser ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
                  }`}
                  title={
                    !catalog?.isProUser
                      ? 'Plan Pro requis'
                      : tool.isActivated
                        ? 'Désactiver'
                        : 'Activer'
                  }
                >
                  {togglingId === tool.id ? (
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  ) : tool.isActivated ? (
                    <ToggleRight className="w-8 h-8 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-500" />
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{tool.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {tool.requiresApiKey && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full text-[10px] font-medium">
                      <Key className="w-2.5 h-2.5" />
                      API Key
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full text-[10px] font-medium">
                    {catalog?.categories[tool.category]?.emoji} {catalog?.categories[tool.category]?.label}
                  </span>
                </div>
                <a
                  href={tool.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-purple-400 transition"
                  title="Documentation"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Key Modal */}
      {apiKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Clé API requise</h2>
                <p className="text-xs text-gray-400">{apiKeyModal.tool.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Pour activer <strong className="text-white">{apiKeyModal.tool.name}</strong>,
              vous devez fournir votre clé API {apiKeyModal.tool.provider}.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1.5">
                {apiKeyModal.tool.envKeyName || 'API Key'}
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Votre clé API..."
                className="w-full px-4 py-2.5 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleApiKeySubmit()}
              />
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Votre clé sera chiffrée et stockée de manière sécurisée.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setApiKeyModal(null)}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleApiKeySubmit}
                disabled={!apiKeyInput.trim() || togglingId === apiKeyModal.tool.id}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {togglingId === apiKeyModal.tool.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Activer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
