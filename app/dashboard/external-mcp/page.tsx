'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Server,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  ExternalLink,
  Shield,
  Key,
} from 'lucide-react';

interface ExternalServer {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC';
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  errorMessage: string | null;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  toolsDiscovered: any;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  HEALTHY: { label: 'En ligne', color: 'text-green-400 bg-green-500/20', icon: <Wifi className="w-3 h-3" /> },
  DEGRADED: { label: 'Dégradé', color: 'text-yellow-400 bg-yellow-500/20', icon: <AlertTriangle className="w-3 h-3" /> },
  DOWN: { label: 'Hors ligne', color: 'text-red-400 bg-red-500/20', icon: <WifiOff className="w-3 h-3" /> },
  UNKNOWN: { label: 'Inconnu', color: 'text-gray-400 bg-gray-500/20', icon: <Clock className="w-3 h-3" /> },
};

const AUTH_LABELS: Record<string, string> = {
  NONE: 'Aucune',
  API_KEY: 'Clé API',
  BEARER: 'Bearer Token',
  BASIC: 'Basic Auth',
};

export default function ExternalMcpPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formAuthType, setFormAuthType] = useState<'NONE' | 'API_KEY' | 'BEARER' | 'BASIC'>('NONE');
  const [formSecret, setFormSecret] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) return '';
    try {
      return await user.getIdToken();
    } catch {
      return '';
    }
  }, [user]);

  const fetchServers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/v1/external-mcp', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setServers(data.data);
        setError(null);
      } else {
        setError(data.error || 'Erreur de chargement');
      }
    } catch (err) {
      setError('Impossible de charger les serveurs');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const handleAdd = async () => {
    if (!formName.trim() || !formUrl.trim()) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const token = await getToken();
      const res = await fetch('/api/v1/external-mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          baseUrl: formUrl.trim(),
          authType: formAuthType,
          secret: formSecret || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormName('');
        setFormUrl('');
        setFormAuthType('NONE');
        setFormSecret('');
        fetchServers();
      } else {
        setFormError(data.error || 'Erreur lors de la création');
      }
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleTest = async (serverId: string) => {
    setTestingId(serverId);
    try {
      const token = await getToken();
      await fetch(`/api/v1/external-mcp/${serverId}/health`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchServers();
    } catch {
      // Error will be reflected in server status
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('Supprimer ce serveur MCP externe ?')) return;

    setDeletingId(serverId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/v1/external-mcp/${serverId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchServers();
      } else {
        setError(data.error);
        setTimeout(() => setError(null), 5000);
      }
    } catch {
      setError('Erreur lors de la suppression');
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return undefined;
    }
    if (user) {
      fetchServers();
      const interval = setInterval(fetchServers, 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user, authLoading, router, fetchServers]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Serveurs MCP Externes</h1>
          <p className="text-gray-400 text-sm mt-1">
            Connectez vos serveurs MCP existants pour utiliser leurs outils dans TwinMCP
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2 shadow-lg shadow-purple-500/30"
        >
          <Plus className="w-5 h-5" />
          Ajouter un serveur
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 ? (
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-12 text-center">
          <Server className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucun serveur connecté</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Ajoutez un serveur MCP externe pour exposer ses outils dans votre espace TwinMCP.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter un serveur
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => {
            const statusInfo = STATUS_CONFIG[server.status] || STATUS_CONFIG.UNKNOWN;
            const toolCount = Array.isArray(server.toolsDiscovered) ? server.toolsDiscovered.length : 0;

            return (
              <div
                key={server.id}
                className="bg-[#1a1b2e] border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/40 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Server className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{server.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {server.baseUrl}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="bg-[#0f1020] rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Auth</p>
                    <p className="text-sm font-medium text-white flex items-center gap-1">
                      {server.authType !== 'NONE' && <Shield className="w-3 h-3 text-green-400" />}
                      {AUTH_LABELS[server.authType]}
                    </p>
                  </div>
                  <div className="bg-[#0f1020] rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Outils</p>
                    <p className="text-sm font-medium text-white">{toolCount}</p>
                  </div>
                  <div className="bg-[#0f1020] rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Latence</p>
                    <p className="text-sm font-medium text-white">
                      {server.lastLatencyMs != null ? `${server.lastLatencyMs}ms` : '—'}
                    </p>
                  </div>
                  <div className="bg-[#0f1020] rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-0.5">Dernier check</p>
                    <p className="text-sm font-medium text-white">
                      {server.lastCheckedAt
                        ? new Date(server.lastCheckedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>

                {server.errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3">
                    <p className="text-xs text-red-400">{server.errorMessage}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(server.id)}
                    disabled={testingId === server.id}
                    className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition text-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testingId === server.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Tester
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    disabled={deletingId === server.id}
                    className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition text-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingId === server.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4">Ajouter un serveur MCP</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Mon serveur MCP"
                  className="w-full px-4 py-2.5 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">URL de base</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://my-mcp-server.example.com"
                  className="w-full px-4 py-2.5 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Authentification</label>
                <select
                  value={formAuthType}
                  onChange={(e) => setFormAuthType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="NONE">Aucune</option>
                  <option value="API_KEY">Clé API (X-API-Key)</option>
                  <option value="BEARER">Bearer Token</option>
                  <option value="BASIC">Basic Auth (user:pass)</option>
                </select>
              </div>

              {formAuthType !== 'NONE' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    {formAuthType === 'API_KEY' ? 'Clé API' : formAuthType === 'BEARER' ? 'Token' : 'user:password'}
                  </label>
                  <input
                    type="password"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder="Votre secret..."
                    className="w-full px-4 py-2.5 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Le secret sera chiffré au repos
                  </p>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormError(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={!formName.trim() || !formUrl.trim() || formSubmitting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Ajout...</>
                ) : (
                  'Ajouter'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
