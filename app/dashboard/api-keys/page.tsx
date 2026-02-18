"use client";

import React, { useState, useEffect } from "react";
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
  XCircle
} from "lucide-react";
import { apiClient } from "@/lib/client/api-client";

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  tier?: string;
  quotaRequestsPerMinute: number;
  quotaRequestsPerDay: number;
  lastUsedAt?: string;
  createdAt: string;
  usage?: {
    requestsToday: number;
    requestsThisHour: number;
    successRate: number;
  };
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{ key: string; prefix: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chargement des clés API depuis le backend
  useEffect(() => {
    const loadApiKeys = async () => {
      setLoading(true);
      try {
        const result = await apiClient.getApiKeys();
        
        if (result.success && Array.isArray(result.data)) {
          setApiKeys(result.data);
        } else {
          console.error('API Error:', result.error);
          setApiKeys([]);
        }
      } catch (error) {
        console.error("Error loading API keys:", error);
        setApiKeys([]);
      } finally {
        setLoading(false);
      }
    };

    loadApiKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setCreatingKey(true);
    try {
      const result = await apiClient.createApiKey(newKeyName.trim());
      
      if (result.success && result.data) {
        // result.data.key = the full raw API key (only shown once)
        // result.data.id = the database record ID
        setNewApiKey({
          key: result.data.key,
          prefix: result.data.keyPrefix
        });
        setShowCreateModal(false);
        setNewKeyName("");
        
        // Ajouter la clé à la liste locale
        const newKey: ApiKey = {
          id: result.data.id,
          keyPrefix: result.data.keyPrefix,
          name: result.data.name || newKeyName.trim(),
          quotaRequestsPerMinute: result.data.quotaRequestsPerMinute || 20,
          quotaRequestsPerDay: result.data.quotaRequestsPerDay || 200,
          createdAt: result.data.createdAt,
          usage: result.data.usage || { requestsToday: 0, requestsThisHour: 0, successRate: 100 }
        };
        
        setApiKeys(prev => [newKey, ...prev]);
      } else {
        throw new Error(result.error || 'Failed to create API key');
      }
      
    } catch (error) {
      console.error("Error creating API key:", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir révoquer cette clé ? Cette action est irréversible.")) {
      return;
    }

    setRevokingKey(keyId);
    try {
      const result = await apiClient.revokeApiKey(keyId);
      
      if (result.success) {
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
      } else {
        throw new Error(result.error || 'Failed to revoke API key');
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setRevokingKey(null);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-400';
    if (percentage < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-[60] max-w-md animate-in slide-in-from-top-2">
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 shadow-lg backdrop-blur-sm">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Erreur</p>
              <p className="text-sm text-red-400/80 mt-0.5">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="w-7 h-7 text-purple-400" />
            Clés API
          </h1>
          <p className="text-gray-400 mt-1">Gérez vos clés d&apos;accès à l&apos;API</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30 flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          Nouvelle clé
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Key className="w-6 h-6 text-purple-400" />
            <span className="text-2xl font-bold text-purple-400">{apiKeys.length}</span>
          </div>
          <p className="text-gray-400 text-sm">Clés actives</p>
        </div>
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {apiKeys.reduce((sum, key) => sum + (key.usage?.requestsToday || 0), 0)}
            </span>
          </div>
          <p className="text-gray-400 text-sm">Requêtes aujourd&apos;hui</p>
        </div>
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">
              {apiKeys.reduce((sum, key) => sum + (key.usage?.requestsThisHour || 0), 0)}
            </span>
          </div>
          <p className="text-gray-400 text-sm">Requêtes cette heure</p>
        </div>
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Shield className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">
              {(apiKeys.reduce((sum, key) => sum + (key.usage?.successRate ?? 0), 0) / Math.max(apiKeys.length, 1)).toFixed(1)}%
            </span>
          </div>
          <p className="text-gray-400 text-sm">Taux de succès</p>
        </div>
      </div>

      {/* API Keys List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
          <span className="ml-3 text-gray-400">Chargement des clés API...</span>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 text-center">
          <Key className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucune clé API</h3>
          <p className="text-gray-400 mb-6">Créez votre première clé API pour commencer</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer une clé API
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{apiKey.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <code className="bg-[#0f1020] px-2 py-1 rounded text-purple-400">
                      {apiKey.keyPrefix}...
                    </code>
                    <button
                      onClick={() => handleCopyKey(apiKey.keyPrefix)}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {copiedKey === apiKey.keyPrefix ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    apiKey.tier === 'free' || apiKey.keyPrefix.includes('free')
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                    {apiKey.tier === 'free' || apiKey.keyPrefix.includes('free') ? 'Free' : 'Production'}
                  </span>
                  <button
                    onClick={() => handleRevokeKey(apiKey.id)}
                    disabled={revokingKey === apiKey.id}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                  >
                    {revokingKey === apiKey.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {apiKey.usage && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-[#0f1020] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Aujourd&apos;hui</span>
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{apiKey.usage.requestsToday}</span>
                      <span className="text-xs text-gray-500">/ {apiKey.quotaRequestsPerDay}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) < 0.5 ? 'bg-green-500' :
                          (apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) < 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-[#0f1020] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Cette heure</span>
                      <Clock className="w-3 h-3 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{apiKey.usage.requestsThisHour}</span>
                      <span className="text-xs text-gray-500">/ {apiKey.quotaRequestsPerMinute}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (apiKey.usage.requestsThisHour / apiKey.quotaRequestsPerMinute) < 0.5 ? 'bg-green-500' :
                          (apiKey.usage.requestsThisHour / apiKey.quotaRequestsPerMinute) < 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((apiKey.usage.requestsThisHour / apiKey.quotaRequestsPerMinute) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-[#0f1020] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Succès</span>
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <span className={`font-semibold ${getUsageColor(apiKey.usage.successRate)}`}>
                      {apiKey.usage.successRate}%
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center text-sm text-gray-500 border-t border-purple-500/10 pt-3">
                <span>Créée le {formatDate(apiKey.createdAt)}</span>
                {apiKey.lastUsedAt && (
                  <span className="ml-4">• Dernière utilisation {formatDate(apiKey.lastUsedAt)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                onKeyDown={(e) => { if (e.key === 'Enter' && newKeyName.trim() && !creatingKey) handleCreateKey(); }}
                placeholder="Ex: Production, Développement..."
                className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                La clé complète ne sera affichée qu&apos;une seule fois.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setNewKeyName(""); }}
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
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Création...</>
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
                <Check className="w-8 h-8 text-green-400" />
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
                  onClick={() => handleCopyKey(newApiKey.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 hover:text-green-300"
                >
                  {copiedKey === newApiKey.key ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copiedKey === newApiKey.key && (
                <p className="text-sm text-green-400 mt-2">Copiée !</p>
              )}
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Cette clé ne sera plus jamais affichée. Sauvegardez-la maintenant !
              </p>
            </div>
            <button
              onClick={() => { setNewApiKey(null); setNewKeyName(""); }}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
            >
              J&apos;ai sauvegardé ma clé
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
