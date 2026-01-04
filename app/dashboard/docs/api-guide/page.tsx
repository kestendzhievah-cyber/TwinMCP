'use client';

import React, { useState } from 'react';
import { Code, Copy, Check, Terminal, Key, Shield, Database, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ApiGuidePage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const codeExamples = [
    {
      title: 'Authentification',
      language: 'javascript',
      code: `// Authentification avec JWT
const response = await fetch('http://localhost:3000/api/v1/mcp/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    apiKey: 'your-api-key'
  })
});

const { token } = await response.json();`,
    },
    {
      title: 'Exécuter un outil MCP',
      language: 'javascript',
      code: `// Exécuter un outil MCP
const response = await fetch('http://localhost:3000/api/v1/mcp/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    tool: 'email',
    arguments: {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Message de test'
    }
  })
});

const result = await response.json();`,
    },
    {
      title: 'Liste des outils disponibles',
      language: 'javascript',
      code: `// Lister les outils disponibles
const response = await fetch('http://localhost:3000/api/v1/mcp/tools', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const tools = await response.json();`,
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-purple-400">
          <Link href="/dashboard/docs" className="hover:text-fuchsia-300">Docs</Link>
          <span>/</span>
          <span>Guide API</span>
        </div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
          Guide API TwinMCP
        </h1>
        <p className="text-gray-400 text-lg">
          Documentation complète pour intégrer et utiliser l'API TwinMCP
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-fuchsia-300 mb-4">Démarrage rapide</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-fuchsia-600 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
            <span className="text-gray-300">Obtenez votre clé API depuis le dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-fuchsia-600 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
            <span className="text-gray-300">Authentifiez-vous avec votre clé API</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-fuchsia-600 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
            <span className="text-gray-300">Utilisez les endpoints MCP pour exécuter des outils</span>
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Authentification</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            Clé API
          </h3>
          <p className="text-gray-300">
            Pour utiliser l'API TwinMCP, vous devez vous authentifier avec une clé API ou un token JWT.
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-200 mb-2">Méthode 1: Clé API</h4>
              <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
                <pre className="text-green-400">
{`POST /api/v1/mcp/auth
Content-Type: application/json

{
  "apiKey": "your-api-key-here"
}`}
                </pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-200 mb-2">Méthode 2: Token JWT</h4>
              <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
                <pre className="text-green-400">
{`Authorization: Bearer your-jwt-token`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Endpoints API</h2>
        
        <div className="space-y-4">
          {/* Auth Endpoint */}
          <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">POST /api/v1/mcp/auth</h3>
            <p className="text-gray-300 mb-4">Authentifiez-vous et obtenez un token JWT.</p>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-200">Request Body:</h4>
                <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-3 font-mono text-sm mt-2">
                  <pre className="text-green-400">
{`{
  "apiKey": "string"
}`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-200">Response:</h4>
                <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-3 font-mono text-sm mt-2">
                  <pre className="text-green-400">
{`{
  "token": "jwt-token-string",
  "expiresIn": "24h"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Execute Endpoint */}
          <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">POST /api/v1/mcp/execute</h3>
            <p className="text-gray-300 mb-4">Exécutez un outil MCP avec les arguments fournis.</p>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-200">Request Body:</h4>
                <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-3 font-mono text-sm mt-2">
                  <pre className="text-green-400">
{`{
  "tool": "tool-name",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-200">Response:</h4>
                <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-3 font-mono text-sm mt-2">
                  <pre className="text-green-400">
{`{
  "success": true,
  "result": "tool-output",
  "executionTime": 150
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Tools Endpoint */}
          <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">GET /api/v1/mcp/tools</h3>
            <p className="text-gray-300 mb-4">Listez tous les outils MCP disponibles.</p>
            
            <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-3 font-mono text-sm">
              <pre className="text-green-400">
{`[
  {
    "id": "email",
    "name": "Email Tool",
    "description": "Send emails",
    "category": "communication",
    "inputSchema": {...}
  }
]`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Exemples de code</h2>
        
        {codeExamples.map((example, index) => (
          <div key={index} className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">{example.title}</h3>
              <button
                onClick={() => copyToClipboard(example.code)}
                className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
              >
                {copiedCode === example.code ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400">{example.code}</pre>
            </div>
          </div>
        ))}
      </div>

      {/* Rate Limiting */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Limitation de débit</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-gray-100">Limites par défaut</h3>
          </div>
          
          <div className="space-y-3 text-gray-300">
            <div className="flex justify-between">
              <span>Requêtes par minute:</span>
              <span className="text-fuchsia-400">100</span>
            </div>
            <div className="flex justify-between">
              <span>Requêtes par heure:</span>
              <span className="text-fuchsia-400">1000</span>
            </div>
            <div className="flex justify-between">
              <span>Exécutions d'outils par jour:</span>
              <span className="text-fuchsia-400">10,000</span>
            </div>
          </div>
          
          <p className="text-gray-400 text-sm mt-4">
            Les limites peuvent être ajustées selon votre plan tarifaire.
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-fuchsia-300 mb-4">Pour aller plus loin</h3>
        <div className="space-y-3">
          <Link href="/dashboard/docs/api-keys" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Gérer vos clés API</span>
          </Link>
          <Link href="/dashboard/docs/best-practices" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Bonnes pratiques</span>
          </Link>
          <Link href="/dashboard/docs/troubleshooting" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Dépannage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
