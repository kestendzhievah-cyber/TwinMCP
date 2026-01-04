'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { useRouter } from 'next/navigation';

interface MCPConfiguration {
  id: string;
  name: string;
  description?: string;
  configData: any;
  status: string;
  createdAt: string;
  product?: { name: string };
}

export default function MCPConfigurationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [configurations, setConfigurations] = useState<MCPConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: '', description: '', configData: '{}' });

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    fetchConfigurations();
  }, [user]);

  const fetchConfigurations = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/mcp-configurations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setConfigurations(data);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConfiguration = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/mcp-configurations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newConfig),
      });
      if (response.ok) {
        setShowCreateForm(false);
        setNewConfig({ name: '', description: '', configData: '{}' });
        fetchConfigurations();
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    }
  };

  const testConfiguration = async (id: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/mcp-configurations/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      alert(`Test: ${result.message}`);
      fetchConfigurations();
    } catch (error) {
      console.error('Erreur lors du test:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configurations MCP</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Nouvelle Configuration
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Créer une Configuration</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom de la configuration"
              value={newConfig.name}
              onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              placeholder="Description"
              value={newConfig.description}
              onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <textarea
              placeholder="Données de configuration (JSON)"
              value={newConfig.configData}
              onChange={(e) => setNewConfig({ ...newConfig, configData: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
            />
            <div className="flex space-x-2">
              <button
                onClick={createConfiguration}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Créer
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {configurations.map((config) => (
          <div key={config.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">{config.name}</h3>
                {config.description && <p className="text-gray-600">{config.description}</p>}
                <p className="text-sm text-gray-500">Produit: {config.product?.name || 'Aucun'}</p>
              </div>
              <span className={`px-2 py-1 rounded text-sm ${
                config.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                config.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {config.status}
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => testConfiguration(config.id)}
                className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Tester
              </button>
              <button className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 text-sm">
                Modifier
              </button>
              <button className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
