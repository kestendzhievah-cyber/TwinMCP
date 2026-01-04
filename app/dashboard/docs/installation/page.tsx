'use client';

import React from 'react';
import { Terminal, CheckCircle, AlertCircle, Download, Play, ArrowRight, Settings } from 'lucide-react';
import Link from 'next/link';

export default function InstallationPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-purple-400">
          <Link href="/dashboard/docs" className="hover:text-fuchsia-300">Docs</Link>
          <span>/</span>
          <span>Installation</span>
        </div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
          Installation de TwinMCP
        </h1>
        <p className="text-gray-400 text-lg">
          Guide complet pour installer et configurer votre premier serveur MCP
        </p>
      </div>

      {/* Prerequisites */}
      <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          Prérequis
        </h2>
        <ul className="space-y-2 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-fuchsia-400 mt-1">•</span>
            <span>Node.js 18.0.0 ou supérieur</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-fuchsia-400 mt-1">•</span>
            <span>npm 9.0.0 ou supérieur</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-fuchsia-400 mt-1">•</span>
            <span>Un éditeur de code (VS Code recommandé)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-fuchsia-400 mt-1">•</span>
            <span>Connaissances de base en JavaScript/TypeScript</span>
          </li>
        </ul>
      </div>

      {/* Installation Steps */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Étapes d'installation</h2>

        {/* Step 1 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <h3 className="text-xl font-semibold text-gray-100">Cloner le projet</h3>
          </div>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-fuchsia-400" />
              <span className="text-gray-400">Terminal</span>
            </div>
            <code className="text-green-400">git clone https://github.com/kestendzhievah-cyber/TwinMe.IA</code>
            <br />
            <code className="text-green-400">cd TwinMe.IA</code>
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <h3 className="text-xl font-semibold text-gray-100">Installer les dépendances</h3>
          </div>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-fuchsia-400" />
              <span className="text-gray-400">Terminal</span>
            </div>
            <code className="text-green-400">npm install --legacy-peer-deps</code>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-yellow-300 text-sm">
                <p className="font-semibold mb-1">Note</p>
                <p>L'option --legacy-peer-deps est nécessaire pour résoudre les conflits de dépendances avec Next.js 15.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-xl font-semibold text-gray-100">Configurer les variables d'environnement</h3>
          </div>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-fuchsia-400" />
              <span className="text-gray-400">Terminal</span>
            </div>
            <code className="text-green-400">cp .env.example .env.local</code>
          </div>
          <p className="text-gray-300">
            Modifiez le fichier .env.local avec vos configuration Firebase et autres clés API.
          </p>
        </div>

        {/* Step 4 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
            <h3 className="text-xl font-semibold text-gray-100">Démarrer le serveur de développement</h3>
          </div>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-fuchsia-400" />
              <span className="text-gray-400">Terminal</span>
            </div>
            <code className="text-green-400">npm run dev</code>
          </div>
          <p className="text-gray-300">
            Le serveur démarrera sur http://localhost:3000
          </p>
        </div>
      </div>

      {/* MCP Configuration */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-100">Configuration du serveur MCP</h2>
        
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Configuration JSON
          </h3>
          <p className="text-gray-300">
            Ajoutez cette configuration dans votre client MCP (Cursor, Claude Desktop, etc.) :
          </p>
          <div className="bg-[#0a0a0f] border border-purple-700/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-green-400">
{`{
  "mcpServers": {
    "twinmcp": {
      "url": "http://localhost:3000/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN"
      }
    }
  }
}`}
            </pre>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-blue-300 text-sm">
              <p className="font-semibold mb-1">Astuce</p>
              <p>Vous pouvez générer un token JWT via l'interface d'administration dans le dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-fuchsia-300 mb-4">Prochaines étapes</h3>
        <div className="space-y-3">
          <Link href="/dashboard/docs/api-keys" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Gérer vos clés API</span>
          </Link>
          <Link href="/dashboard/docs/api-guide" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Explorer la documentation API</span>
          </Link>
          <Link href="/dashboard/docs/best-practices" className="flex items-center gap-3 text-gray-300 hover:text-fuchsia-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>Bonnes pratiques de configuration</span>
          </Link>
        </div>
      </div>

      {/* Verification */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-100">Vérification de l'installation</h3>
        <div className="bg-[#1a1a2e] border border-purple-700/30 rounded-xl p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">Le serveur démarre sans erreur</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">L'interface dashboard est accessible</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">Les endpoints MCP répondent</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-300">La configuration Firebase est valide</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
