'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy, Check, Eye, EyeOff, Plus, Code, Zap, Book, Terminal, Sparkles,
  Zap as ZapIcon,
  Crown,
  Settings,
  LogOut,
  Bot,
  MessageSquare,
  TrendingUp,
  DollarSign,
  BarChart3,
  Pause,
  Play,
  Edit,
  Trash2,
  Eye as EyeIcon,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Download,
  QrCode,
  Key,
  AlertTriangle,
} from 'lucide-react';

const MCP_STORAGE_KEY = 'twinme_mcp_config';

interface MCPServerConfig {
  url: string;
  headers?: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

const getRootDomain = (hostname: string) => {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
};

function tryParseMcpConfig(text: string): { ok: true; config: MCPConfig } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'JSON invalide' };
    }

    const mcpServersRaw = (parsed as any).mcpServers;
    if (!mcpServersRaw || typeof mcpServersRaw !== 'object') {
      return { ok: false, error: "Champ 'mcpServers' manquant" };
    }

    const normalized: Record<string, MCPServerConfig> = {};
    for (const [id, cfg] of Object.entries(mcpServersRaw as Record<string, any>)) {
      if (!cfg || typeof cfg !== 'object') continue;
      if (typeof cfg.url !== 'string' || !cfg.url.trim()) continue;

      const headersRaw = cfg.headers;
      const headers: Record<string, string> | undefined =
        headersRaw && typeof headersRaw === 'object'
          ? Object.fromEntries(
              Object.entries(headersRaw as Record<string, any>)
                .filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
                .map(([k, v]) => [k, String(v)])
            )
          : undefined;

      normalized[String(id)] = {
        url: cfg.url,
        ...(headers && Object.keys(headers).length ? { headers } : {}),
      };
    }

    return { ok: true, config: { mcpServers: normalized } };
  } catch (error: any) {
    return { ok: false, error: error?.message ? String(error.message) : 'JSON invalide' };
  }
}

function getServerLogoUrl(_id: string, url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const root = getRootDomain(hostname);
    // Favicon service: no local assets needed
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(root)}&sz=64`;
  } catch {
    return null;
  }
}

export default function TwinMCPApiDocs() {
  const [showOverviewApiKey, setShowOverviewApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedLang, setSelectedLang] = useState<'nodejs' | 'python' | 'curl'>('nodejs');
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  const apiKey = 'tmcp_sk_1a2b3c4d5e6f7g8h9i0j';

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(`https://your-domain.com${url}`);
  };

  const copyTextToClipboard = async (text: string) => {
    setMcpUiError(null);
    try {
      await navigator.clipboard.writeText(text);
      setMcpUiMessage("Copié dans le presse-papiers");
      window.setTimeout(() => setMcpUiMessage(null), 1500);
    } catch {
      setMcpUiError("Impossible de copier (permissions navigateur)");
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // fall back to existing UI error slot if present
      setMcpUiError("Impossible de copier (permissions navigateur)");
    }
  };

  const handleAddOrUpdateMcpServer = () => {
    setMcpUiMessage(null);
    setMcpUiError(null);

    const id = mcpServerId.trim();
    const url = mcpServerUrl.trim();
    if (!id) {
      setMcpUiError("Identifiant serveur requis");
      return;
    }
    try {
      new URL(url);
    } catch {
      setMcpUiError("URL invalide");
      return;
    }

    const headers: Record<string, string> = {};
    const hk = mcpHeaderKey.trim();
    const hv = mcpHeaderValue;
    if (hk) headers[hk] = hv;

    setMcpServers(prev => ({
      ...prev,
      [id]: {
        url,
        ...(Object.keys(headers).length ? { headers } : {}),
      },
    }));
    setMcpUiMessage("Serveur ajouté/mis à jour");
    window.setTimeout(() => setMcpUiMessage(null), 1500);
  };

  const handleRemoveMcpServer = (id: string) => {
    setMcpUiMessage(null);
    setMcpUiError(null);
    setMcpServers(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleImportMcpConfig = () => {
    setMcpUiMessage(null);
    setMcpUiError(null);
    const result = tryParseMcpConfig(mcpImportText);
    if (result.ok === false) {
      setMcpUiError(result.error);
      return;
    }
    setMcpServers(result.config.mcpServers);
    setMcpUiMessage("Configuration importée");
    window.setTimeout(() => setMcpUiMessage(null), 1500);
  };

  const [mcpServers, setMcpServers] = useState<Record<string, MCPServerConfig>>({});
  const [mcpServerId, setMcpServerId] = useState("context7");
  const [mcpServerUrl, setMcpServerUrl] = useState("https://mcp.context7.com/mcp");
  const [mcpHeaderKey, setMcpHeaderKey] = useState("CONTEXT7_API_KEY");
  const [mcpHeaderValue, setMcpHeaderValue] = useState("");
  const [mcpImportText, setMcpImportText] = useState(
    JSON.stringify(
      {
        mcpServers: {
          context7: {
            url: "https://mcp.context7.com/mcp",
            headers: {
              CONTEXT7_API_KEY: "YOUR_API_KEY",
            },
          },
        },
      },
      null,
      2
    )
  );
  const [mcpUiMessage, setMcpUiMessage] = useState<string | null>(null);
  const [mcpUiError, setMcpUiError] = useState<string | null>(null);
  const [mcpHasLoadedFromStorage, setMcpHasLoadedFromStorage] = useState(false);
  
  // API Key Management State
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; createdAt: string; lastUsed?: string }>>([]);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  // API Key Management Functions
  const generateApiKey = () => {
    return "tmcp_sk_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const copyApiKeyToClipboard = async (key: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      setMcpUiError("Impossible de copier la clé API");
      setTimeout(() => setMcpUiError(null), 2000);
    }
  };

  // Load API keys from database
  const loadApiKeys = async () => {
    try {
      // Temporarily use localStorage while fixing Firebase imports
      const storedKeys = localStorage.getItem('twinme_api_keys');
      if (storedKeys) {
        const keys = JSON.parse(storedKeys);
        setApiKeys(keys);
      }
    } catch (error: any) {
      console.error('Error loading API keys:', error);
      setMcpUiError("Erreur lors du chargement des clés API");
    }
  };

  // Create API key in database
  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      setMcpUiError("Nom de la clé requis");
      return;
    }

    try {
      // Temporarily use localStorage while fixing Firebase imports
      const newKey = {
        id: Date.now().toString(),
        name: newKeyName.trim(),
        key: generateApiKey(),
        createdAt: new Date().toISOString(),
      };

      const updatedKeys = [...apiKeys, newKey];
      setApiKeys(updatedKeys);
      localStorage.setItem('twinme_api_keys', JSON.stringify(updatedKeys));
      
      setNewKeyName('');
      setIsCreatingKey(false);
      setMcpUiMessage("Nouvelle clé API créée avec succès");
      setTimeout(() => setMcpUiMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating API key:', error);
      setMcpUiError(error.message || "Erreur lors de la création de la clé API");
      setTimeout(() => setMcpUiError(null), 3000);
    }
  };

  // Delete API key from database
  const deleteApiKey = async (keyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette clé API ? Cette action est irréversible.")) {
      return;
    }

    try {
      // Temporarily use localStorage while fixing Firebase imports
      const updatedKeys = apiKeys.filter(key => key.id !== keyId);
      setApiKeys(updatedKeys);
      localStorage.setItem('twinme_api_keys', JSON.stringify(updatedKeys));
      
      setMcpUiMessage("Clé API supprimée avec succès");
      setTimeout(() => setMcpUiMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      setMcpUiError(error.message || "Erreur lors de la suppression de la clé API");
      setTimeout(() => setMcpUiError(null), 3000);
    }
  };

  // Load API keys on component mount
  useEffect(() => {
    loadApiKeys();
  }, []);

  const mcpConfigText = useMemo(() => {
    const cfg: MCPConfig = { mcpServers };
    return JSON.stringify(cfg, null, 2);
  }, [mcpServers]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MCP_STORAGE_KEY);
      if (!raw) return;
      const parsed = tryParseMcpConfig(raw);
      if (!parsed.ok) return;
      setMcpServers(parsed.config.mcpServers);
    } catch {
      return;
    } finally {
      setMcpHasLoadedFromStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!mcpHasLoadedFromStorage) return;
    try {
      window.localStorage.setItem(MCP_STORAGE_KEY, mcpConfigText);
    } catch {
      return;
    }
  }, [mcpConfigText, mcpHasLoadedFromStorage]);

  const codeExamples = {
    nodejs: `const TwinMCP = require('twinmcp');

const client = new TwinMCP({
  apiKey: 'tmcp_sk_YOUR_API_KEY',
  baseURL: 'https://api.twinmcp.com/v1'
});

// Liste des outils disponibles
const tools = await client.tools.list();

// Exécuter un outil
const result = await client.tools.execute({
  toolId: 'email',
  arguments: {
    to: 'user@example.com',
    subject: 'Hello',
    body: 'Test message'
  }
});`,
    python: `from twinmcp import TwinMCP

client = TwinMCP(
    api_key='tmcp_sk_YOUR_API_KEY',
    base_url='https://api.twinmcp.com/v1'
)

# Liste des outils disponibles
tools = client.tools.list()

# Exécuter un outil
result = client.tools.execute(
    tool_id='email',
    arguments={
        'to': 'user@example.com',
        'subject': 'Hello',
        'body': 'Test message'
    }
)`,
    curl: `curl -X POST https://api.twinmcp.com/v1/tools/execute \\
  -H "Authorization: Bearer tmcp_sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "toolId": "email",
    "arguments": {
      "to": "user@example.com",
      "subject": "Hello",
      "body": "Test message"
    }
  }'`
  };

  const apiResponse = `{
  "success": true,
  "toolId": "email",
  "executionId": "exec_1a2b3c",
  "result": {
    "messageId": "msg_xyz789",
    "status": "sent",
    "timestamp": "2025-01-23T10:30:00.000Z"
  },
  "metadata": {
    "executionTime": 847,
    "cost": 0.001
  }
}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </div>

            <div className="flex items-center space-x-6">
              <a href="#" className="text-gray-300 hover:text-white transition text-sm">Plans</a>
              <a href="#" className="text-gray-300 hover:text-white transition text-sm">Docs</a>
              <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition text-sm">
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview', icon: Book },
            { id: 'libraries', label: 'Libraries', icon: Code },
            { id: 'members', label: 'Members', icon: ZapIcon },
            { id: 'rules', label: 'Rules', icon: Terminal }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition ${
                selectedTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* MCP Connect Section */}
        <section className="mb-8">
          <div
            className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
            style={{ boxShadow: '0 0 10px rgba(255, 255, 255, 0.1)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ZapIcon className="w-6 h-6 text-purple-300" />
                Connexion MCP
              </h2>
              <button
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm flex items-center gap-2"
                onClick={() => copyTextToClipboard(mcpConfigText)}
                title="Copier la configuration"
              >
                <Copy className="w-4 h-4" />
                Copier JSON
              </button>
            </div>

            {(mcpUiMessage || mcpUiError) && (
              <div className="mb-4">
                {mcpUiMessage && <div className="text-sm text-green-300">{mcpUiMessage}</div>}
                {mcpUiError && <div className="text-sm text-red-300">{mcpUiError}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-white/3 border border-white/6">
                <div className="font-semibold mb-3">Ajouter / Mettre à jour un serveur</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">ID</div>
                    <input
                      value={mcpServerId}
                      onChange={(e) => setMcpServerId(e.target.value)}
                      className="w-full bg-white/6 rounded-lg px-3 py-2 outline-none border border-white/6"
                      placeholder="context7"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 mb-1">URL MCP</div>
                    <input
                      value={mcpServerUrl}
                      onChange={(e) => setMcpServerUrl(e.target.value)}
                      className="w-full bg-white/6 rounded-lg px-3 py-2 outline-none border border-white/6"
                      placeholder="https://mcp.context7.com/mcp"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 mb-1">Header (clé)</div>
                    <input
                      value={mcpHeaderKey}
                      onChange={(e) => setMcpHeaderKey(e.target.value)}
                      className="w-full bg-white/6 rounded-lg px-3 py-2 outline-none border border-white/6"
                      placeholder="CONTEXT7_API_KEY"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 mb-1">Header (valeur)</div>
                    <input
                      value={mcpHeaderValue}
                      onChange={(e) => setMcpHeaderValue(e.target.value)}
                      className="w-full bg-white/6 rounded-lg px-3 py-2 outline-none border border-white/6"
                      placeholder="YOUR_API_KEY"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#ef4d95] font-semibold"
                    onClick={handleAddOrUpdateMcpServer}
                  >
                    Enregistrer
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10"
                    onClick={() => {
                      setMcpServerId("context7");
                      setMcpServerUrl("https://mcp.context7.com/mcp");
                      setMcpHeaderKey("CONTEXT7_API_KEY");
                      setMcpHeaderValue("");
                    }}
                  >
                    Pré-remplir Context7
                  </button>
                </div>

                <div className="mt-5">
                  <div className="font-semibold mb-2">Serveurs connectés ({Object.keys(mcpServers).length})</div>
                  {Object.keys(mcpServers).length === 0 ? (
                    <div className="text-sm text-white/50">Aucun serveur MCP configuré</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(mcpServers).map(([id, cfg]) => {
                        const logo = getServerLogoUrl(id, cfg.url);
                        const showFallback = !logo || !!logoErrors[id];
                        return (
                          <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-white/4 border border-white/6">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-white/6 border border-white/6 flex items-center justify-center overflow-hidden relative">
                                {logo && !logoErrors[id] && (
                                  <img
                                    src={logo}
                                    alt={`${id} logo`}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                      setLogoErrors(prev => ({ ...prev, [id]: true }));
                                    }}
                                  />
                                )}
                                {showFallback && (
                                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/70">
                                    {id.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{id}</div>
                                <div className="text-xs text-white/50 truncate">{cfg.url}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm flex items-center gap-2"
                                onClick={() => {
                                  setMcpServerId(id);
                                  setMcpServerUrl(cfg.url);
                                  const hk = cfg.headers ? Object.keys(cfg.headers)[0] : "";
                                  setMcpHeaderKey(hk || "");
                                  setMcpHeaderValue(hk && cfg.headers ? cfg.headers[hk] : "");
                                }}
                                title="Éditer"
                              >
                                <Edit className="w-4 h-4" />
                                Éditer
                              </button>
                              <button
                                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-red-600/40 text-sm flex items-center gap-2"
                                onClick={() => handleRemoveMcpServer(id)}
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                                Supprimer
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/3 border border-white/6">
                <div className="font-semibold mb-2">Configuration Cursor (mcpServers)</div>
                <div className="text-xs text-white/50 mb-3">
                  Copiez/collez ce JSON dans Cursor (ou importez-en un)
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-white/60">Export</div>
                    <button
                      className="text-sm text-purple-300 hover:text-purple-200 flex items-center gap-2"
                      onClick={() => copyTextToClipboard(mcpConfigText)}
                    >
                      <Copy className="w-4 h-4" />
                      Copier
                    </button>
                  </div>
                  <textarea
                    value={mcpConfigText}
                    readOnly
                    rows={10}
                    className="w-full bg-black/30 rounded-lg px-3 py-2 outline-none border border-white/10 font-mono text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-white/60">Import</div>
                    <button
                      className="text-sm text-purple-300 hover:text-purple-200"
                      onClick={handleImportMcpConfig}
                    >
                      Importer
                    </button>
                  </div>
                  <textarea
                    value={mcpImportText}
                    onChange={(e) => setMcpImportText(e.target.value)}
                    rows={10}
                    className="w-full bg-black/30 rounded-lg px-3 py-2 outline-none border border-white/10 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">REQUESTS</div>
            <div className="text-3xl font-bold text-white">0/200</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">PENDING UPLOADS</div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">PLAN</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Free
            </div>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                Gestion des Clés API
              </h2>
              <p className="text-sm text-gray-400">Créez et gérez vos clés API pour authentifier vos requêtes</p>
            </div>
            <button 
              onClick={() => setIsCreatingKey(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Clé API
            </button>
          </div>

          {(mcpUiMessage || mcpUiError) && (
            <div className="mb-4">
              {mcpUiMessage && <div className="text-sm text-green-300">{mcpUiMessage}</div>}
              {mcpUiError && <div className="text-sm text-red-300">{mcpUiError}</div>}
            </div>
          )}

          {/* Create New Key Form */}
          {isCreatingKey && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-purple-300 mb-3">Créer une nouvelle clé API</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Nom de la clé (ex: Production, Développement)"
                  className="flex-1 px-4 py-2 bg-white/6 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                  readOnly={false}
                  disabled={false}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  onClick={createApiKey}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  Créer
                </button>
                <button
                  onClick={() => {
                    setIsCreatingKey(false);
                    setNewKeyName('');
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="bg-white/3 border border-white/6 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{apiKey.name}</h3>
                      <div className="text-xs text-gray-400">
                        Créée le {new Date(apiKey.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono bg-black/30 px-3 py-1 rounded border border-white/10">
                        {showApiKey === apiKey.id ? apiKey.key : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowApiKey(showApiKey === apiKey.id ? null : apiKey.id)}
                        className="p-1 text-gray-400 hover:text-white transition"
                      >
                        {showApiKey === apiKey.id ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => copyApiKeyToClipboard(apiKey.key, apiKey.id)}
                        className="p-1 text-gray-400 hover:text-white transition"
                      >
                        {copiedKey === apiKey.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    {apiKey.lastUsed && (
                      <div className="text-xs text-gray-400 mt-2">
                        Dernière utilisation: {new Date(apiKey.lastUsed).toLocaleString('fr-FR')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteApiKey(apiKey.id)}
                    className="p-2 text-red-400 hover:text-red-300 transition"
                    title="Supprimer la clé"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {apiKeys.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Key className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p>Aucune clé API créée</p>
              <p className="text-sm">Cliquez sur "Nouvelle Clé API" pour commencer</p>
            </div>
          )}

          {/* Security Warning */}
          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-yellow-300 text-sm">
                <p className="font-semibold mb-1">⚠️ Sécurité</p>
                <p>Ne partagez jamais vos clés API. Elles donnent accès à toutes vos ressources TwinMCP.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connect Section */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6 mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white mb-1">Connect</h2>
            <button className="text-sm text-purple-400 hover:text-purple-300 transition">
              Clone the docs for installation
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-2 block">REST URL</label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono text-sm">
                  https://api.twinmcp.com/v1
                </div>
                <button
                  onClick={() => handleCopy('https://api.twinmcp.com/v1')}
                  className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">API URL</label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono text-sm">
                  twinmcp.com/api/v1
                </div>
                <button
                  onClick={() => handleCopy('twinmcp.com/api/v1')}
                  className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            {['Cursor', 'Claude Code', 'VS Code', 'Coda', 'Windsurf', 'Qwen CLI'].map((tool) => (
              <button
                key={tool}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600 text-gray-300 text-sm rounded-lg hover:border-purple-500/50 transition"
              >
                {tool}
              </button>
            ))}
            <button className="px-3 py-2 bg-slate-700/50 border border-slate-600 text-gray-300 text-sm rounded-lg hover:border-purple-500/50 transition">
              + More
            </button>
          </div>

          {/* Code Example */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-purple-500 text-white text-sm rounded font-medium">
                  Resoure
                </button>
                <button className="px-3 py-1 bg-slate-700 text-gray-300 text-sm rounded hover:bg-slate-600 transition">
                  Local
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-purple-500/20 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 font-mono">
                {`"mcpServers": {
  "twinmcp": {
    "command": "npx",
    "args": [
      "-y",
      "@twinmcp/mcp-sdk",
      "https://api.twinmcp.com/v1/mcp",
      "tmcp_sk_YOUR_API_KEY"
    ]
  }
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">API</h2>
            <p className="text-sm text-gray-400">
              Use the TwinMCP API to search libraries and fetch documentation programmatically
            </p>
          </div>

          <div className="flex space-x-2 mb-6">
            <button className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg font-medium">
              Search
            </button>
            <button className="px-4 py-2 bg-slate-700 text-gray-300 text-sm rounded-lg hover:bg-slate-600 transition">
              Context
            </button>
          </div>

          {/* Language Tabs */}
          <div className="flex space-x-2 mb-4">
            {[
              { id: 'nodejs' as const, label: 'Node.js' },
              { id: 'python' as const, label: 'Python' },
              { id: 'curl' as const, label: 'cURL' }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLang(lang.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  selectedLang === lang.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Code Block */}
          <div className="relative mb-6">
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => handleCopy(codeExamples[selectedLang])}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 font-mono">{codeExamples[selectedLang]}</pre>
            </div>
          </div>

          {/* Parameters */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Parameters</h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="text-purple-400 font-mono">toolId</span>
                <span className="text-gray-400 mx-2">:</span>
                <span className="text-gray-300">Library or query to search for</span>
              </div>
              <div className="flex">
                <span className="text-purple-400 font-mono">arguments</span>
                <span className="text-gray-400 mx-2">:</span>
                <span className="text-gray-300">Tool arguments for execution</span>
              </div>
            </div>
          </div>

          {/* Response */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Response</h3>
            <div className="bg-slate-900 border border-purple-500/20 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 font-mono">{apiResponse}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}