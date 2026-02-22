'use client';

import React from 'react';
import { AlertTriangle, CheckCircle, Wrench, Terminal, RefreshCw, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function TroubleshootingPage() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const commonIssues = [
    {
      problem: "Le serveur ne démarre pas",
      solution: "Vérifiez que Node.js 18+ est installé et que les dépendances sont correctement installées avec --legacy-peer-deps",
      code: "node --version\nnpm install --legacy-peer-deps"
    },
    {
      problem: "Erreur d'authentification 401",
      solution: "Vérifiez que votre clé API est valide et correctement configurée dans .env.local",
      code: "curl -X POST ${APP_URL}/api/v1/mcp/auth \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"apiKey\":\"your-api-key\"}'"
    },
    {
      problem: "Firebase connection error",
      solution: "Assurez-vous que les variables Firebase dans .env.local sont correctement configurées",
      code: "NEXT_PUBLIC_FIREBASE_API_KEY=your-key\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project"
    },
    {
      problem: "MCP tool execution timeout",
      solution: "Augmentez le timeout dans la configuration ou vérifiez la connectivité réseau",
      code: "// Dans next.config.js\nmodule.exports = {\n  experimental: {\n    serverComponentsExternalPackages: ['@modelcontextprotocol/sdk']\n  }\n}"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-purple-400">
          <Link href="/dashboard/docs" className="hover:text-fuchsia-300">Docs</Link>
          <span>/</span>
          <span>Dépannage</span>
        </div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
          Dépannage TwinMCP
        </h1>
        <p className="text-gray-400 text-lg">
          Solutions aux problèmes courants lors de l'installation et de l'utilisation de TwinMCP
        </p>
      </div>

      {/* Quick Diagnostics */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-blue-300 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Diagnostics rapides
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Vérifiez la version de Node.js: <code className="text-fuchsia-400">node --version</code></span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Vérifiez les variables d'environnement: <code className="text-fuchsia-400">cat .env.local</code></span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Testez la connectivité: <code className="text-fuchsia-400">curl {APP_URL}/api/v1/mcp/health</code></span>
          </div>
        </div>
      </div>

      {/* Common Issues */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Problèmes courants</h2>
        
        {commonIssues.map((issue, index) => (
          <div key={index} className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-100 mb-2">{issue.problem}</h3>
                <p className="text-gray-300 mb-4">{issue.solution}</p>
                <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
                  <pre className="text-green-400 whitespace-pre-wrap">{issue.code}</pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Error Codes */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Codes d'erreur</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-red-400">400 Bad Request</h4>
                <p className="text-gray-300 text-sm">Requête invalide, vérifiez les paramètres</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-yellow-400">401 Unauthorized</h4>
                <p className="text-gray-300 text-sm">Clé API invalide ou manquante</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-orange-400">403 Forbidden</h4>
                <p className="text-gray-300 text-sm">Permissions insuffisantes</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-purple-400">429 Too Many Requests</h4>
                <p className="text-gray-300 text-sm">Limite de débit dépassée</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-red-400">500 Internal Server Error</h4>
                <p className="text-gray-300 text-sm">Erreur serveur, réessayez plus tard</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-400">503 Service Unavailable</h4>
                <p className="text-gray-300 text-sm">Service temporairement indisponible</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Mode */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Mode debug</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" />
            Activer le mode debug
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-200 mb-2">Variables d'environnement</h4>
              <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
                <pre className="text-green-400">
{`# Debug mode
DEBUG=true
LOG_LEVEL=debug

# Verbose logging
VERBOSE=true`}
                </pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-200 mb-2">Logs détaillés</h4>
              <p className="text-gray-300 text-sm">
                En mode debug, vous verrez des logs détaillés dans la console pour identifier les problèmes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Issues */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Problèmes de performance</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-yellow-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">Lenteur au démarrage</h3>
                <p className="text-gray-300 mb-3">
                  Si le serveur met du temps à démarrer, vérifiez :
                </p>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• La disponibilité des services externes (Firebase)</li>
                  <li>• Les ressources système disponibles (RAM, CPU)</li>
                  <li>• La configuration du cache Redis si utilisé</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-yellow-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">Timeout d'exécution</h3>
                <p className="text-gray-300 mb-3">
                  Pour les outils qui prennent du temps :
                </p>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• Utilisez l'exécution asynchrone avec jobId</li>
                  <li>• Augmentez le timeout dans la configuration</li>
                  <li>• Optimisez le code de l'outil</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Help */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-fuchsia-300 mb-4">Obtenir de l'aide</h3>
        <div className="space-y-3">
          <Link href="/dashboard/docs/api-guide" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Consulter la documentation API</span>
          </Link>
          <Link href="/dashboard/docs/installation" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Revoir le guide d'installation</span>
          </Link>
          <div className="flex items-center gap-3 text-gray-300">
            <ArrowRight className="w-4 h-4" />
            <span>Contacter le support: support@twinmcp.com</span>
          </div>
        </div>
      </div>

      {/* Health Check */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Vérification de santé</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Endpoint de santé</h3>
          <p className="text-gray-300 mb-4">
            Utilisez cet endpoint pour vérifier que le serveur fonctionne correctement :
          </p>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
            <pre className="text-green-400">
{`GET /api/v1/mcp/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-04T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "cache": "connected",
    "mcp": "running"
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
