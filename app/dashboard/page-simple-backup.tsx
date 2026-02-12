'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, Plus, Key, AlertTriangle, Eye, EyeOff, Trash2 } from 'lucide-react';

export default function SimpleDashboard() {
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; createdAt: string }>>([]);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateApiKey = () => {
    return "tmcp_sk_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const createApiKey = () => {
    if (!newKeyName.trim()) {
      setError("Nom de la clé requis");
      return;
    }

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
    setMessage("Nouvelle clé API créée avec succès");
    setTimeout(() => setMessage(null), 3000);
  };

  const deleteApiKey = (keyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette clé API ?")) {
      return;
    }

    const updatedKeys = apiKeys.filter(key => key.id !== keyId);
    setApiKeys(updatedKeys);
    localStorage.setItem('twinme_api_keys', JSON.stringify(updatedKeys));
    
    setMessage("Clé API supprimée avec succès");
    setTimeout(() => setMessage(null), 3000);
  };

  const copyApiKeyToClipboard = async (key: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      setError("Impossible de copier la clé API");
      setTimeout(() => setError(null), 2000);
    }
  };

  useEffect(() => {
    try {
      const storedKeys = localStorage.getItem('twinme_api_keys');
      if (storedKeys) {
        const keys = JSON.parse(storedKeys);
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Dashboard TwinMCP</h1>
        
        {/* API Keys Section */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                Gestion des Clés API
              </h2>
              <p className="text-sm text-gray-400">Créez et gérez vos clés API</p>
            </div>
            <button 
              onClick={() => setIsCreatingKey(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Clé API
            </button>
          </div>

          {(message || error) && (
            <div className="mb-4">
              {message && <div className="text-sm text-green-300">{message}</div>}
              {error && <div className="text-sm text-red-300">{error}</div>}
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
      </div>
    </div>
  );
}
