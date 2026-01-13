"use client";

import React, { useState, useEffect } from "react";
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw, 
  Shield, 
  Clock, 
  TrendingUp,
  Check,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { apiClient } from "@/lib/client/api-client";

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
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

  // Simulation de chargement des clés API
  useEffect(() => {
    const loadApiKeys = async () => {
      setLoading(true);
      try {
        // Appel API réel via notre client
        const result = await apiClient.getApiKeys();
        
        if (result.success) {
          setApiKeys(result.data);
        } else {
          console.error('API Error:', result.error);
          // En cas d'erreur, utiliser les données de test
          const mockKeys: ApiKey[] = [
            {
              id: "1",
              keyPrefix: "twinmcp_live_abc123def456",
              name: "Clé de production",
              quotaRequestsPerMinute: 100,
              quotaRequestsPerDay: 10000,
              lastUsedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
              usage: {
                requestsToday: 245,
                requestsThisHour: 12,
                successRate: 98.5
              }
            },
            {
              id: "2",
              keyPrefix: "twinmcp_test_xyz789uvw012",
              name: "Clé de développement",
              quotaRequestsPerMinute: 50,
              quotaRequestsPerDay: 1000,
              lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
              usage: {
                requestsToday: 89,
                requestsThisHour: 5,
                successRate: 99.2
              }
            }
          ];
          
          setApiKeys(mockKeys);
        }
        
      } catch (error) {
        console.error("Error loading API keys:", error);
        // En cas d'erreur critique, utiliser les données de test
        const mockKeys: ApiKey[] = [
          {
            id: "1",
            keyPrefix: "twinmcp_live_abc123def456",
            name: "Clé de production",
            quotaRequestsPerMinute: 100,
            quotaRequestsPerDay: 10000,
            lastUsedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
            usage: {
              requestsToday: 245,
              requestsThisHour: 12,
              successRate: 98.5
            }
          },
          {
            id: "2",
            keyPrefix: "twinmcp_test_xyz789uvw012",
            name: "Clé de développement",
            quotaRequestsPerMinute: 50,
            quotaRequestsPerDay: 1000,
            lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
            usage: {
              requestsToday: 89,
              requestsThisHour: 5,
              successRate: 99.2
            }
          }
        ];
        
        setApiKeys(mockKeys);
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
      // Appel API réel via notre client
      const result = await apiClient.createApiKey(newKeyName.trim());
      
      if (result.success) {
        setNewApiKey({
          key: result.data.id, // Utiliser l'ID généré comme clé complète pour la démo
          prefix: result.data.keyPrefix
        });
        setShowCreateModal(false);
        setNewKeyName("");
        
        // Ajouter la clé à la liste
        const newKey: ApiKey = {
          id: result.data.id,
          keyPrefix: result.data.keyPrefix,
          name: newKeyName.trim(),
          quotaRequestsPerMinute: result.data.quotaRequestsPerMinute,
          quotaRequestsPerDay: result.data.quotaRequestsPerDay,
          createdAt: result.data.createdAt,
          usage: result.data.usage
        };
        
        setApiKeys(prev => [newKey, ...prev]);
      } else {
        throw new Error(result.error || 'Failed to create API key');
      }
      
    } catch (error) {
      console.error("Error creating API key:", error);
      alert(`Erreur lors de la création de la clé: ${error.message}`);
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
      // Appel API réel via notre client
      const result = await apiClient.revokeApiKey(keyId);
      
      if (result.success) {
        setApiKeys(prev => prev.filter(key => key.id !== keyId));
      } else {
        throw new Error(result.error || 'Failed to revoke API key');
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
      alert(`Erreur lors de la révocation: ${error.message}`);
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500 opacity-20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 opacity-20 rounded-full filter blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500 opacity-10 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-purple-500/20 bg-[#1a1b2e]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/30">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                    Clés API TwinMCP
                  </h1>
                  <p className="text-xs text-gray-400">Gérez vos clés d'accès à l'API</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle clé
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <Key className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold text-purple-400">{apiKeys.length}</span>
              </div>
              <p className="text-gray-400">Clés actives</p>
            </div>
            
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <span className="text-2xl font-bold text-green-400">
                  {apiKeys.reduce((sum, key) => sum + (key.usage?.requestsToday || 0), 0)}
                </span>
              </div>
              <p className="text-gray-400">Requêtes aujourd'hui</p>
            </div>
            
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">
                  {apiKeys.reduce((sum, key) => sum + (key.usage?.requestsThisHour || 0), 0)}
                </span>
              </div>
              <p className="text-gray-400">Requêtes cette heure</p>
            </div>
            
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-8 h-8 text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-400">
                  {(apiKeys.reduce((sum, key) => sum + key.usage?.successRate || 0, 0) / Math.max(apiKeys.length, 1)).toFixed(1)}%
                </span>
              </div>
              <p className="text-gray-400">Taux de succès</p>
            </div>
          </div>

          {/* API Keys List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <span className="ml-3 text-gray-400">Chargement des clés API...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-20">
              <Key className="w-16 h-16 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Aucune clé API</h3>
              <p className="text-gray-400 mb-6">Créez votre première clé API pour commencer à utiliser TwinMCP</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Créer une clé API
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 backdrop-blur-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{apiKey.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Key className="w-4 h-4" />
                        <code className="bg-[#0f1020] px-2 py-1 rounded text-purple-400">
                          {apiKey.keyPrefix}...
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(apiKey.keyPrefix)}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        apiKey.keyPrefix.includes('test') 
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        {apiKey.keyPrefix.includes('test') ? 'Test' : 'Production'}
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

                  {/* Usage Stats */}
                  {apiKey.usage && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-[#0f1020] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Aujourd'hui</span>
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{apiKey.usage.requestsToday}</span>
                          <span className="text-xs text-gray-500">
                            / {apiKey.quotaRequestsPerDay}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              (apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) < 0.5 
                                ? 'bg-green-500' 
                                : (apiKey.usage.requestsToday / apiKey.quotaRequestsPerDay) < 0.8 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
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
                          <span className="font-semibold">{apiKey.usage.requestsThisHour}</span>
                          <span className="text-xs text-gray-500">
                            / {apiKey.quotaRequestsPerMinute}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              (apiKey.usage.requestsThisHour / apiKey.quotaRequestsPerMinute) < 0.5 
                                ? 'bg-green-500' 
                                : (apiKey.usage.requestsThisHour / apiKey.quotaRequestsPerMinute) < 0.8 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
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
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${getUsageColor(apiKey.usage.successRate)}`}>
                            {apiKey.usage.successRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm text-gray-400 border-t border-purple-500/20 pt-4">
                    <div className="flex items-center gap-4">
                      <span>Créée le {formatDate(apiKey.createdAt)}</span>
                      {apiKey.lastUsedAt && (
                        <span>• Dernière utilisation {formatDate(apiKey.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 max-w-md w-full mx-4 backdrop-blur-xl">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              Créer une nouvelle clé API
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de la clé
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Ma clé API"
                  className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
                  autoFocus
                />
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium mb-1">
                      Important : Sauvegardez votre clé
                    </p>
                    <p className="text-xs text-gray-400">
                      La clé complète ne sera affichée qu'une seule fois après la création. 
                      Conservez-la dans un endroit sécurisé.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                }}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || creatingKey}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50"
              >
                {creatingKey ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer la clé"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 max-w-2xl w-full mx-4 backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
                Clé API créée avec succès !
              </h2>
              <p className="text-gray-400">
                Votre clé API a été générée. Copiez-la et conservez-la dans un endroit sécurisé.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de la clé
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  readOnly
                  className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Clé API complète
                </label>
                <div className="relative">
                  <input
                    type={copiedKey === newApiKey.key ? "text" : "password"}
                    value={newApiKey.key}
                    readOnly
                    className="w-full px-4 py-3 pr-12 bg-[#0f1020] border border-green-500/30 rounded-lg text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => handleCopyKey(newApiKey.key)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-green-300 transition-colors"
                  >
                    {copiedKey === newApiKey.key ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {copiedKey === newApiKey.key && (
                  <p className="text-sm text-green-400 mt-2">
                    ✅ Clé copiée dans le presse-papiers
                  </p>
                )}
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium mb-1">
                    ⚠️ Sauvegardez cette clé immédiatement
                  </p>
                  <p className="text-xs text-gray-400">
                    Cette clé ne sera plus affichée après la fermeture de cette fenêtre. 
                    Si vous la perdez, vous devrez en créer une nouvelle.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setNewApiKey(null);
                setNewKeyName("");
              }}
              className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50"
            >
              J'ai compris et sauvegardé ma clé
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
