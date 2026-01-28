'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Sparkles,
  Search,
  Star,
  TrendingUp,
  Clock,
  Lightbulb,
  Github,
  Globe,
  CheckCircle,
  MessageSquare,
  Download,
  Users,
  Wrench,
  BookOpen,
  Zap,
  Database,
  Mail,
  BarChart3,
  Building2,
} from 'lucide-react';

interface Library {
  id: string;
  name: string;
  source: string;
  sourceType: 'github' | 'website';
  tokens: string;
  snippets: string;
  lastUpdate: string;
  isVerified: boolean;
}

interface Tool {
  id: string;
  name: string;
  category: string;
  author: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  users: number;
  downloads: string;
  isOfficial?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'trending' | 'recent' | 'skills'>('popular');
  const [activeSection, setActiveSection] = useState<'tools' | 'libraries'>('tools');

  // Outils MCP
  const tools: Tool[] = [
    {
      id: '1',
      name: 'Fetch (Reference)',
      category: 'DEVOPS',
      author: 'modelcontextprotocol',
      description: 'Fetches a URL from the internet and extracts its contents as markdown.',
      icon: <Zap className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 1,
      downloads: '1M+',
      isOfficial: true,
    },
    {
      id: '2',
      name: 'Playwright',
      category: 'DEVOPS',
      author: 'microsoft',
      description: 'Playwright MCP server.',
      icon: <div className="grid grid-cols-2 gap-0.5"><div className="w-2.5 h-2.5 bg-red-500"></div><div className="w-2.5 h-2.5 bg-green-500"></div><div className="w-2.5 h-2.5 bg-blue-500"></div><div className="w-2.5 h-2.5 bg-yellow-500"></div></div>,
      iconBg: 'from-slate-700 to-slate-800',
      users: 22,
      downloads: '500K+',
      isOfficial: true,
    },
    {
      id: '3',
      name: 'Time (Reference)',
      category: 'DEVOPS',
      author: 'modelcontextprotocol',
      description: 'Time and timezone conversion capabilities.',
      icon: <Clock className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 2,
      downloads: '100K+',
      isOfficial: true,
    },
    {
      id: '4',
      name: 'Slack',
      category: 'COMMUNICATION',
      author: 'modelcontextprotocol',
      description: 'Interact with Slack Workspaces over the Slack API.',
      icon: <MessageSquare className="w-6 h-6" />,
      iconBg: 'from-purple-600 to-purple-700',
      users: 8,
      downloads: '100K+',
      isOfficial: true,
    },
    {
      id: '5',
      name: 'TwinMCP',
      category: 'DEVOPS',
      author: 'twinmcp',
      description: 'TwinMCP Server -- Up-to-date code documentation for LLMs and AI code editors.',
      icon: <Sparkles className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 2,
      downloads: '100K+',
      isOfficial: true,
    },
    {
      id: '6',
      name: 'Grafana',
      category: 'MONITORING',
      author: 'grafana',
      description: 'MCP server for Grafana.',
      icon: <BarChart3 className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-orange-600',
      users: 56,
      downloads: '100K+',
      isOfficial: true,
    },
  ];

  // Bibliothèques
  const libraries: Library[] = [
    {
      id: '1',
      name: 'Next.js',
      source: '/vercel/next.js',
      sourceType: 'github',
      tokens: '572K',
      snippets: '2,1K',
      lastUpdate: '4 jours',
      isVerified: true,
    },
    {
      id: '2',
      name: 'Better Auth',
      source: '/better-auth/better-auth',
      sourceType: 'github',
      tokens: '443K',
      snippets: '2,1K',
      lastUpdate: '2 jours',
      isVerified: true,
    },
    {
      id: '3',
      name: 'Claude Code',
      source: '/anthropics/claude-code',
      sourceType: 'github',
      tokens: '214K',
      snippets: '790',
      lastUpdate: '1 semaine',
      isVerified: true,
    },
    {
      id: '4',
      name: 'AI SDK',
      source: 'ai-sdk.dev',
      sourceType: 'website',
      tokens: '902K',
      snippets: '5,7K',
      lastUpdate: '6 jours',
      isVerified: true,
    },
    {
      id: '5',
      name: 'Vercel AI SDK',
      source: '/vercel/ai',
      sourceType: 'github',
      tokens: '936K',
      snippets: '4,4K',
      lastUpdate: '14 heures',
      isVerified: true,
    },
    {
      id: '6',
      name: 'React',
      source: '/facebook/react',
      sourceType: 'github',
      tokens: '1,2M',
      snippets: '3,8K',
      lastUpdate: '3 jours',
      isVerified: true,
    },
  ];

  const tabs = [
    { id: 'popular', label: 'Populaires', icon: Star },
    { id: 'trending', label: 'Tendances', icon: TrendingUp },
    { id: 'recent', label: 'Récents', icon: Clock },
    { id: 'skills', label: 'Skills', icon: Lightbulb, isNew: true },
  ];

  const filteredLibraries = libraries.filter(lib =>
    lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-[#1a1b2e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <span className="text-base sm:text-xl font-bold text-white">TwinMCP</span>
              </Link>
              <Link
                href="/login"
                className="ml-2 sm:ml-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition"
              >
                Se connecter
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
              <Link href="/pricing" className="hidden md:block text-gray-300 hover:text-white transition font-medium text-sm underline">
                Plans
              </Link>
              <Link href="/dashboard/analytics" className="hidden sm:flex text-gray-300 hover:text-white transition font-medium items-center gap-1 text-sm">
                <Github className="w-4 h-4" />
                <span className="hidden lg:inline">Install</span>
              </Link>
              <Link href="/dashboard/settings" className="hidden lg:block text-gray-300 hover:text-white transition font-medium text-sm">
                More...
              </Link>
              <Link
                href="/dashboard/agent-builder"
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs sm:text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Docs</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Hero Section */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Documentation à jour</span>
          </h1>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 sm:mb-4">
            pour les LLMs et éditeurs de code IA
          </h2>
          <p className="text-gray-400 text-sm sm:text-base lg:text-lg mb-6 sm:mb-8">
            Obtenez la documentation et le code les plus récents dans Cursor, Claude ou d'autres LLMs
          </p>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 max-w-3xl">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (ex: Next, React)"
                className="w-full pl-12 pr-4 py-3 sm:py-4 bg-[#1a1b2e] border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
              />
            </div>
            <span className="text-gray-500 text-center text-sm hidden sm:inline">ou</span>
            <button
              onClick={() => router.push('/chat')}
              className="px-6 py-3 sm:py-4 bg-[#1a1b2e] border border-purple-500/30 rounded-xl text-white font-medium hover:bg-purple-500/10 transition flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Chat avec Docs
            </button>
          </div>
        </div>

        {/* Section Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setActiveSection('tools')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'tools'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-[#1a1b2e] text-gray-400 hover:text-white border border-purple-500/30'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Outils MCP
          </button>
          <button
            onClick={() => setActiveSection('libraries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'libraries'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-[#1a1b2e] text-gray-400 hover:text-white border border-purple-500/30'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Bibliothèques
          </button>
        </div>

        {/* Tools Section */}
        {activeSection === 'tools' && (
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-400" />
              Outils MCP disponibles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool) => (
                <div
                  key={tool.id}
                  className="bg-[#1a1b2e] border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/50 transition cursor-pointer group"
                  onClick={() => router.push(`/dashboard/marketplace`)}
                >
                  {/* Category Badge */}
                  <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-3">
                    {tool.category}
                  </div>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tool.iconBg} flex items-center justify-center text-white`}>
                        {tool.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white group-hover:text-purple-400 transition">
                            {tool.name}
                          </h4>
                          {tool.isOfficial && (
                            <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{tool.author}</p>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-white transition">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {tool.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{tool.users}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      <span>{tool.downloads}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Libraries Section */}
        {activeSection === 'libraries' && (
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              Bibliothèques de documentation
            </h3>

            {/* Tabs */}
            <div className="flex items-center gap-4 lg:gap-6 border-b border-purple-500/20 mb-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 pb-4 border-b-2 transition font-medium whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {tab.isNew && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full">
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Libraries Table */}
            <div className="bg-[#1a1b2e] rounded-xl border border-purple-500/20 overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-[#0f1020] border-b border-purple-500/20 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <div className="col-span-4">Bibliothèque</div>
                <div className="col-span-3">Source</div>
                <div className="col-span-1 text-right">Tokens</div>
                <div className="col-span-2 text-right">Snippets</div>
                <div className="col-span-2 text-right">Mise à jour</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-purple-500/10">
                {filteredLibraries.map((lib) => (
                  <div
                    key={lib.id}
                    className="md:grid md:grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-purple-500/5 transition cursor-pointer items-center"
                    onClick={() => router.push(`/dashboard/library/${lib.id}`)}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-purple-400 hover:text-purple-300 mb-1">
                            {lib.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                            {lib.sourceType === 'github' ? (
                              <Github className="w-3.5 h-3.5" />
                            ) : (
                              <Globe className="w-3.5 h-3.5" />
                            )}
                            <span className="truncate">{lib.source}</span>
                          </div>
                        </div>
                        {lib.isVerified && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-4">
                          <span><span className="font-medium text-gray-300">{lib.tokens}</span> tokens</span>
                          <span><span className="font-medium text-gray-300">{lib.snippets}</span> snippets</span>
                        </div>
                        <span>{lib.lastUpdate}</span>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:contents">
                      <div className="col-span-4">
                        <span className="font-semibold text-purple-400 hover:text-purple-300">
                          {lib.name}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center gap-2 text-gray-400">
                        {lib.sourceType === 'github' ? (
                          <Github className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                        <span className="truncate">{lib.source}</span>
                      </div>
                      <div className="col-span-1 text-right text-gray-300 font-medium">
                        {lib.tokens}
                      </div>
                      <div className="col-span-2 text-right text-gray-400">
                        {lib.snippets}
                      </div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-2">
                        <span className="text-gray-500">{lib.lastUpdate}</span>
                        {lib.isVerified && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {((activeSection === 'libraries' && filteredLibraries.length === 0) || 
          (activeSection === 'tools' && filteredTools.length === 0)) && (
          <div className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Aucun résultat trouvé</h3>
            <p className="text-gray-400 mb-6">Essayez une autre recherche ou ajoutez un nouvel élément</p>
            <Link
              href="/dashboard/agent-builder"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition"
            >
              <Plus className="w-5 h-5" />
              Ajouter
            </Link>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            {tools.length} outils • {libraries.length} bibliothèques indexées • Mise à jour automatique
          </p>
        </div>
      </div>
    </div>
  );
}
