"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  BookOpen, 
  Code2, 
  Server, 
  Database, 
  Shield, 
  Zap, 
  Users, 
  Globe,
  ChevronRight,
  Search,
  Library,
  Boxes,
  GitBranch,
  FileText,
  Terminal,
  Key,
  Workflow
} from "lucide-react";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [searchQuery, setSearchQuery] = useState("");

  const sections = [
    { id: "introduction", title: "Introduction", icon: BookOpen },
    { id: "architecture", title: "Architecture", icon: Boxes },
    { id: "features", title: "Fonctionnalités", icon: Zap },
    { id: "getting-started", title: "Démarrage rapide", icon: Terminal },
    { id: "api", title: "API & Intégration", icon: Code2 },
    { id: "security", title: "Sécurité", icon: Shield },
  ];

  const features = [
    {
      icon: Library,
      title: "Bibliothèque complète",
      description: "Accédez à des centaines de documentations de bibliothèques populaires, toujours à jour."
    },
    {
      icon: Search,
      title: "Recherche intelligente",
      description: "Trouvez instantanément les informations dont vous avez besoin grâce à notre moteur de recherche sémantique."
    },
    {
      icon: GitBranch,
      title: "Multi-versions",
      description: "Support de plusieurs versions de chaque bibliothèque pour une compatibilité maximale."
    },
    {
      icon: Zap,
      title: "Réponses instantanées",
      description: "Obtenez des extraits de documentation pertinents en quelques millisecondes."
    },
    {
      icon: Key,
      title: "API simple",
      description: "Intégrez TwinMCP dans vos outils avec notre API RESTful et nos SDK."
    },
    {
      icon: Shield,
      title: "Sécurisé",
      description: "Authentification OAuth 2.0 et clés API avec quotas personnalisables."
    }
  ];

  const integrations = [
    { name: "Cursor", status: "Disponible", icon: "🖱️" },
    { name: "Claude Code", status: "Disponible", icon: "🤖" },
    { name: "VS Code", status: "Disponible", icon: "💻" },
    { name: "Opencode", status: "Disponible", icon: "📝" },
    { name: "Windsurf", status: "Disponible", icon: "🏄" },
  ];

  const popularLibraries = [
    { name: "React", category: "Frontend", docs: "1,250+" },
    { name: "Next.js", category: "Framework", docs: "890+" },
    { name: "TypeScript", category: "Langage", docs: "2,100+" },
    { name: "Prisma", category: "ORM", docs: "650+" },
    { name: "Tailwind CSS", category: "CSS", docs: "480+" },
    { name: "Node.js", category: "Runtime", docs: "1,800+" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
              <span className="text-lg sm:text-2xl font-bold text-white">TwinMCP</span>
              <span className="text-xs sm:text-sm text-purple-400 border border-purple-500/30 px-1.5 sm:px-2 py-0.5 rounded-full">Docs</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none w-40 lg:w-64 text-sm"
                />
              </div>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition text-sm sm:text-base">
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="flex gap-4 lg:gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-48 lg:w-64 flex-shrink-0 hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                      activeSection === section.id
                        ? "bg-purple-500/20 text-white border border-purple-500/30"
                        : "text-gray-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Introduction Section */}
            <section id="introduction" className="mb-12">
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
                  Bienvenue sur TwinMCP
                </h1>
                <p className="text-sm sm:text-base lg:text-xl text-gray-300 mb-4 sm:mb-6">
                  TwinMCP est un serveur MCP (Model Context Protocol) qui fournit aux IDE et LLM 
                  des extraits de documentation toujours à jour pour n'importe quelle bibliothèque logicielle.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Link 
                    href="/signup"
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center justify-center gap-2"
                  >
                    Commencer gratuitement
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Link>
                  <Link 
                    href="/dashboard/agent-builder"
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl hover:bg-slate-800 transition text-center"
                  >
                    Ajouter des bibliothèques
                  </Link>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">500+</div>
                  <div className="text-xs sm:text-sm text-gray-400">Bibliothèques</div>
                </div>
                <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">5,000+</div>
                  <div className="text-xs sm:text-sm text-gray-400">Développeurs</div>
                </div>
                <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">10M+</div>
                  <div className="text-xs sm:text-sm text-gray-400">Requêtes/mois</div>
                </div>
                <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">99.9%</div>
                  <div className="text-xs sm:text-sm text-gray-400">Disponibilité</div>
                </div>
              </div>
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Comment ça fonctionne
              </h2>
              
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
                <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Terminal className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">1. Connexion</h3>
                    <p className="text-gray-400 text-sm">
                      Connectez votre IDE (Cursor, VS Code, etc.) à TwinMCP via le protocole MCP standard.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">2. Requête</h3>
                    <p className="text-gray-400 text-sm">
                      Posez une question sur une bibliothèque. Notre moteur identifie automatiquement la documentation pertinente.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">3. Réponse</h3>
                    <p className="text-gray-400 text-sm">
                      Recevez des extraits de documentation précis et à jour, optimisés pour votre LLM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Architecture Diagram */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg sm:rounded-xl p-3 sm:p-6 font-mono text-xs sm:text-sm overflow-x-auto">
                <pre className="text-gray-300">
{`┌─────────────────────────────────────────────────────────────┐
│                     Votre IDE / LLM                          │
│        (Cursor, Claude Code, VS Code, Windsurf)             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ Protocole MCP (stdio/HTTP)
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     TwinMCP Server                           │
│                                                              │
│   ┌──────────────────┐    ┌──────────────────┐              │
│   │  resolve-library │    │    query-docs    │              │
│   │  Identifie la    │    │  Recherche dans  │              │
│   │  bibliothèque    │    │  la documentation│              │
│   └──────────────────┘    └──────────────────┘              │
│                                                              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              Base de Documentation TwinMCP                   │
│                                                              │
│   📚 500+ bibliothèques  •  🔄 Mise à jour quotidienne      │
│   🔍 Recherche sémantique  •  📖 Multi-versions             │
└─────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </section>

            {/* Features Section */}
            <section id="features" className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Fonctionnalités
              </h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 hover:border-purple-500/40 transition">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 border border-purple-500/30 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-gray-400 text-xs sm:text-sm">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Integrations Section */}
            <section id="getting-started" className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <Terminal className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Intégrations supportées
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {integrations.map((integration, index) => (
                  <div key={index} className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center hover:border-purple-500/40 transition">
                    <div className="text-2xl sm:text-3xl mb-2">{integration.icon}</div>
                    <div className="font-semibold text-white text-sm sm:text-base">{integration.name}</div>
                    <div className="text-[10px] sm:text-xs text-green-400">{integration.status}</div>
                  </div>
                ))}
              </div>

              {/* Quick Start Code */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg sm:rounded-xl overflow-hidden">
                <div className="bg-slate-800/50 px-3 sm:px-4 py-2 border-b border-slate-700 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                  <span className="ml-2 text-xs sm:text-sm text-gray-400">Installation</span>
                </div>
                <pre className="p-3 sm:p-4 text-xs sm:text-sm overflow-x-auto">
                  <code className="text-green-400">
{`# Installation du package TwinMCP
npm install @twinmcp/mcp

# Configuration dans votre IDE
# Ajoutez TwinMCP comme serveur MCP dans les paramètres

# Exemple d'utilisation avec API
curl -X POST https://api.twinmcp.com/mcp \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "query-docs", "params": {"library": "react", "query": "useState hook"}}'`}
                  </code>
                </pre>
              </div>
            </section>

            {/* Popular Libraries */}
            <section id="api" className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <Library className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Bibliothèques populaires
              </h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {popularLibraries.map((lib, index) => (
                  <div key={index} className="bg-slate-800/50 border border-purple-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center justify-between hover:border-purple-500/40 transition">
                    <div>
                      <div className="font-semibold text-white text-sm sm:text-base">{lib.name}</div>
                      <div className="text-xs sm:text-sm text-gray-400">{lib.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-purple-400 font-semibold text-sm sm:text-base">{lib.docs}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">snippets</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 sm:mt-6 text-center">
                <Link 
                  href="/dashboard/agent-builder"
                  className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition text-sm sm:text-base"
                >
                  Voir toutes les bibliothèques
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </Link>
              </div>
            </section>

            {/* Security Section */}
            <section id="security" className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Sécurité & Confidentialité
              </h2>
              
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8">
                <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Authentification</h3>
                    <ul className="space-y-2 sm:space-y-3">
                      <li className="flex items-start gap-2 sm:gap-3">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300 text-xs sm:text-sm">OAuth 2.0 avec Google et GitHub</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300">Clés API avec quotas personnalisables</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300">Révocation instantanée des accès</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Protection des données</h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300">Chiffrement TLS pour toutes les communications</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300">Conformité RGPD</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300">Aucune conservation de vos requêtes</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA Section */}
            <section className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                Prêt à commencer ?
              </h2>
              <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 max-w-2xl mx-auto">
                Rejoignez des milliers de développeurs qui utilisent TwinMCP pour accéder 
                instantanément à la documentation dont ils ont besoin.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link 
                  href="/signup"
                  className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl hover:from-purple-600 hover:to-pink-600 transition"
                >
                  Créer un compte gratuit
                </Link>
                <Link 
                  href="/contact"
                  className="px-6 sm:px-8 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl hover:bg-slate-800 transition"
                >
                  Contacter l'équipe
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
