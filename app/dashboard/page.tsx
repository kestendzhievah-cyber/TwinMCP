'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Server,
  XCircle,
  RefreshCw,
  Activity,
  AlertTriangle,
  Settings,
  Cloud,
  Terminal,
  Box,
  FileText,
  CreditCard,
  Cpu,
  Ship,
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

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: object;
}

interface MCPServerStatus {
  isOnline: boolean;
  serverInfo: { name: string; version: string } | null;
  tools: MCPTool[];
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'trending' | 'recent' | 'skills'>('popular');
  const [activeSection, setActiveSection] = useState<'tools' | 'libraries' | 'mcp-status'>('tools');
  
  // État du serveur MCP
  const [mcpStatus, setMcpStatus] = useState<MCPServerStatus>({
    isOnline: false,
    serverInfo: null,
    tools: [],
    lastChecked: new Date(),
    responseTime: 0,
  });
  const [mcpLoading, setMcpLoading] = useState(true);
  const [mcpRefreshing, setMcpRefreshing] = useState(false);

  // Vérifier le statut du serveur MCP
  const checkMCPStatus = useCallback(async () => {
    const startTime = Date.now();
    setMcpRefreshing(true);

    try {
      const toolsResponse = await fetch('/api/mcp/tools', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!toolsResponse.ok) {
        throw new Error(`Server responded with ${toolsResponse.status}`);
      }

      const toolsData = await toolsResponse.json();
      const responseTime = Date.now() - startTime;

      setMcpStatus({
        isOnline: true,
        serverInfo: toolsData.serverInfo || { name: 'twinmcp-server', version: '1.0.0' },
        tools: toolsData.tools || [],
        lastChecked: new Date(),
        responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      setMcpStatus({
        isOnline: false,
        serverInfo: null,
        tools: [],
        lastChecked: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setMcpLoading(false);
      setMcpRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkMCPStatus();
    const interval = setInterval(checkMCPStatus, 30000);
    return () => clearInterval(interval);
  }, [checkMCPStatus]);

  // Outils MCP
  const tools: Tool[] = [
    // === CLOUD & INFRASTRUCTURE ===
    {
      id: '1',
      name: 'AWS Core',
      category: 'CLOUD',
      author: 'awslabs',
      description: 'Point de départ pour utiliser les serveurs MCP awslabs.',
      icon: <Cloud className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-yellow-500',
      users: 156,
      downloads: '500K+',
      isOfficial: true,
    },
    {
      id: '2',
      name: 'AWS Bedrock AgentCore',
      category: 'CLOUD',
      author: 'awslabs',
      description: 'Documentation sur les services de la plateforme AgentCore.',
      icon: <Cloud className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-yellow-500',
      users: 89,
      downloads: '200K+',
      isOfficial: true,
    },
    {
      id: '3',
      name: 'Amazon Kendra Index',
      category: 'CLOUD',
      author: 'awslabs',
      description: 'Recherche d\'entreprise et amélioration RAG.',
      icon: <Search className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-yellow-500',
      users: 45,
      downloads: '100K+',
      isOfficial: true,
    },
    {
      id: '4',
      name: 'Amazon Neptune',
      category: 'DATABASE',
      author: 'awslabs',
      description: 'Requêtes sur base graphe avec Cypher et Gremlin.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-blue-500 to-cyan-500',
      users: 34,
      downloads: '80K+',
      isOfficial: true,
    },
    {
      id: '5',
      name: 'Amazon Q Business',
      category: 'AI',
      author: 'awslabs',
      description: 'Assistant IA pour contenu ingéré avec accès anonyme.',
      icon: <Sparkles className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 67,
      downloads: '150K+',
      isOfficial: true,
    },
    {
      id: '6',
      name: 'Azure Kubernetes (AKS)',
      category: 'CLOUD',
      author: 'Azure',
      description: 'Serveur MCP officiel AKS.',
      icon: <Cloud className="w-6 h-6" />,
      iconBg: 'from-blue-500 to-blue-600',
      users: 78,
      downloads: '200K+',
      isOfficial: true,
    },
    // === SEARCH & AI ===
    {
      id: '7',
      name: 'Brave Search',
      category: 'SEARCH',
      author: 'brave',
      description: 'Recherche Web (pages, images, news, vidéos) via l\'API Brave Search.',
      icon: <Search className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-red-500',
      users: 234,
      downloads: '1M+',
      isOfficial: true,
    },
    {
      id: '8',
      name: 'Perplexity',
      category: 'AI',
      author: 'perplexityai',
      description: 'Connecteur à l\'API Perplexity pour la recherche web temps réel.',
      icon: <Sparkles className="w-6 h-6" />,
      iconBg: 'from-teal-500 to-cyan-500',
      users: 189,
      downloads: '800K+',
      isOfficial: true,
    },
    {
      id: '9',
      name: 'Context7',
      category: 'DEVOPS',
      author: 'upstash',
      description: 'Documentation de code à jour pour LLMs et éditeurs de code IA.',
      icon: <BookOpen className="w-6 h-6" />,
      iconBg: 'from-emerald-500 to-green-500',
      users: 145,
      downloads: '500K+',
      isOfficial: true,
    },
    {
      id: '10',
      name: 'TwinMCP',
      category: 'DEVOPS',
      author: 'twinmcp',
      description: 'Documentation de code à jour pour LLMs et éditeurs de code IA.',
      icon: <Sparkles className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 312,
      downloads: '1M+',
      isOfficial: true,
    },
    // === DATABASES ===
    {
      id: '11',
      name: 'Couchbase',
      category: 'DATABASE',
      author: 'Couchbase-Ecosystem',
      description: 'Base de données document distribuée avec moteur de recherche et capacités analytiques.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-red-500 to-red-600',
      users: 67,
      downloads: '150K+',
      isOfficial: true,
    },
    {
      id: '12',
      name: 'MongoDB',
      category: 'DATABASE',
      author: 'mongodb-js',
      description: 'Connexion aux bases MongoDB et clusters MongoDB Atlas.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-green-500 to-green-600',
      users: 234,
      downloads: '800K+',
      isOfficial: true,
    },
    {
      id: '13',
      name: 'Elasticsearch',
      category: 'DATABASE',
      author: 'elastic',
      description: 'Interaction en langage naturel avec tes index Elasticsearch.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-yellow-500 to-orange-500',
      users: 156,
      downloads: '500K+',
      isOfficial: true,
    },
    {
      id: '14',
      name: 'Neon',
      category: 'DATABASE',
      author: 'neondatabase',
      description: 'Interaction avec l\'API de gestion Neon et les bases de données associées.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-green-400 to-emerald-500',
      users: 89,
      downloads: '300K+',
      isOfficial: true,
    },
    {
      id: '15',
      name: 'Airtable',
      category: 'DATABASE',
      author: 'domdomegg',
      description: 'Accès direct aux bases Airtable (schemas, requêtes, enregistrements) pour automatiser des workflows.',
      icon: <Database className="w-6 h-6" />,
      iconBg: 'from-blue-400 to-blue-500',
      users: 123,
      downloads: '400K+',
      isOfficial: false,
    },
    // === DEVOPS & TOOLS ===
    {
      id: '16',
      name: 'Desktop Commander',
      category: 'DEVOPS',
      author: 'wonderwhy-er',
      description: 'Recherche, mise à jour, gestion de fichiers et exécution de commandes terminal avec IA.',
      icon: <Terminal className="w-6 h-6" />,
      iconBg: 'from-slate-600 to-slate-700',
      users: 178,
      downloads: '600K+',
      isOfficial: false,
    },
    {
      id: '17',
      name: 'Docker Hub',
      category: 'DEVOPS',
      author: 'docker',
      description: 'Serveur MCP officiel Docker Hub.',
      icon: <Box className="w-6 h-6" />,
      iconBg: 'from-blue-500 to-blue-600',
      users: 289,
      downloads: '1M+',
      isOfficial: true,
    },
    {
      id: '18',
      name: 'GitHub Official',
      category: 'DEVOPS',
      author: 'github',
      description: 'Intégration officielle GitHub, automation et interaction avancée avec les API GitHub.',
      icon: <Github className="w-6 h-6" />,
      iconBg: 'from-gray-700 to-gray-800',
      users: 456,
      downloads: '2M+',
      isOfficial: true,
    },
    {
      id: '19',
      name: 'Playwright',
      category: 'DEVOPS',
      author: 'microsoft',
      description: 'Serveur MCP Playwright pour l\'automatisation de navigateurs.',
      icon: <div className="grid grid-cols-2 gap-0.5"><div className="w-2.5 h-2.5 bg-red-500"></div><div className="w-2.5 h-2.5 bg-green-500"></div><div className="w-2.5 h-2.5 bg-blue-500"></div><div className="w-2.5 h-2.5 bg-yellow-500"></div></div>,
      iconBg: 'from-slate-700 to-slate-800',
      users: 234,
      downloads: '800K+',
      isOfficial: true,
    },
    {
      id: '20',
      name: 'Heroku',
      category: 'CLOUD',
      author: 'heroku',
      description: 'Serveur MCP Heroku basé sur le CLI Heroku.',
      icon: <Cloud className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-purple-600',
      users: 145,
      downloads: '400K+',
      isOfficial: true,
    },
    // === MONITORING ===
    {
      id: '21',
      name: 'Grafana',
      category: 'MONITORING',
      author: 'grafana',
      description: 'Serveur MCP pour Grafana - visualisation et monitoring.',
      icon: <BarChart3 className="w-6 h-6" />,
      iconBg: 'from-orange-500 to-orange-600',
      users: 167,
      downloads: '500K+',
      isOfficial: true,
    },
    // === COMMUNICATION & PRODUCTIVITY ===
    {
      id: '22',
      name: 'Slack',
      category: 'COMMUNICATION',
      author: 'modelcontextprotocol',
      description: 'Interaction avec les Workspaces Slack via l\'API Slack.',
      icon: <MessageSquare className="w-6 h-6" />,
      iconBg: 'from-purple-600 to-purple-700',
      users: 198,
      downloads: '700K+',
      isOfficial: true,
    },
    {
      id: '23',
      name: 'Notion',
      category: 'PRODUCTIVITY',
      author: 'makenotion',
      description: 'Serveur MCP officiel Notion.',
      icon: <FileText className="w-6 h-6" />,
      iconBg: 'from-gray-700 to-gray-800',
      users: 345,
      downloads: '1M+',
      isOfficial: true,
    },
    // === FINANCE ===
    {
      id: '24',
      name: 'Stripe',
      category: 'FINANCE',
      author: 'stripe',
      description: 'Interaction avec les services Stripe via l\'API Stripe.',
      icon: <CreditCard className="w-6 h-6" />,
      iconBg: 'from-indigo-500 to-purple-500',
      users: 234,
      downloads: '800K+',
      isOfficial: true,
    },
    // === SCRAPING & AUTOMATION ===
    {
      id: '25',
      name: 'Apify',
      category: 'AUTOMATION',
      author: 'apify',
      description: 'Accès aux outils Apify pour scraping, extraction et automatisation web.',
      icon: <Globe className="w-6 h-6" />,
      iconBg: 'from-green-500 to-teal-500',
      users: 156,
      downloads: '500K+',
      isOfficial: true,
    },
    // === SPECIALIZED ===
    {
      id: '26',
      name: 'Arm',
      category: 'HARDWARE',
      author: 'arm',
      description: 'Outils spécialisés pour développement et optimisation sur architecture Arm.',
      icon: <Cpu className="w-6 h-6" />,
      iconBg: 'from-blue-500 to-cyan-500',
      users: 67,
      downloads: '150K+',
      isOfficial: true,
    },
    {
      id: '27',
      name: 'ArXiv',
      category: 'RESEARCH',
      author: 'jasonleinart',
      description: 'Accès et gestion locale de papiers arXiv, avec outils de recherche et d\'analyse.',
      icon: <BookOpen className="w-6 h-6" />,
      iconBg: 'from-red-500 to-pink-500',
      users: 89,
      downloads: '200K+',
      isOfficial: false,
    },
    {
      id: '28',
      name: 'AIS Fleet',
      category: 'SPECIALIZED',
      author: 'ais-fleet',
      description: 'Analyse et requêtes sur les données AIS de trafic maritime.',
      icon: <Ship className="w-6 h-6" />,
      iconBg: 'from-blue-600 to-blue-700',
      users: 23,
      downloads: '50K+',
      isOfficial: false,
    },
    // === REFERENCE TOOLS ===
    {
      id: '29',
      name: 'Fetch (Reference)',
      category: 'DEVOPS',
      author: 'modelcontextprotocol',
      description: 'Récupère une URL et extrait son contenu en markdown.',
      icon: <Zap className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 312,
      downloads: '1M+',
      isOfficial: true,
    },
    {
      id: '30',
      name: 'Time (Reference)',
      category: 'DEVOPS',
      author: 'modelcontextprotocol',
      description: 'Conversion de temps et fuseaux horaires.',
      icon: <Clock className="w-6 h-6" />,
      iconBg: 'from-purple-500 to-pink-500',
      users: 145,
      downloads: '500K+',
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
            </div>

            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
              <Link href="/pricing" className="hidden md:block text-gray-300 hover:text-white transition font-medium text-sm underline">
                Plans
              </Link>
              <Link href="/dashboard/docs" className="hidden sm:flex text-gray-300 hover:text-white transition font-medium items-center gap-1 text-sm">
                <BookOpen className="w-4 h-4" />
                <span className="hidden lg:inline">Docs</span>
              </Link>
              <Link href="/dashboard/settings" className="hidden lg:flex text-gray-300 hover:text-white transition font-medium items-center gap-1 text-sm">
                <Settings className="w-4 h-4" />
                <span>Paramètres</span>
              </Link>
              <Link
                href="/dashboard/agent-builder"
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs sm:text-sm font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-1.5"
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Chat avec Docs
            </button>
            <Link
              href="/dashboard/docs"
              className="px-6 py-3 bg-[#1a1b2e] border border-purple-500/30 rounded-xl text-white font-medium hover:bg-purple-500/10 transition flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Explorer la documentation
            </Link>
          </div>
        </div>

        {/* Section Toggle */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
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
          <button
            onClick={() => setActiveSection('mcp-status')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              activeSection === 'mcp-status'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-[#1a1b2e] text-gray-400 hover:text-white border border-purple-500/30'
            }`}
          >
            <Server className="w-4 h-4" />
            Statut MCP
            {mcpStatus.isOnline ? (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <span className="w-2 h-2 bg-red-500 rounded-full" />
            )}
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
                  onClick={() => router.push(`/dashboard/tools/${tool.id}`)}
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

        {/* MCP Server Status Section */}
        {activeSection === 'mcp-status' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-400" />
                Statut du Serveur MCP
              </h3>
              <button
                onClick={checkMCPStatus}
                disabled={mcpRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1b2e] border border-purple-500/30 rounded-lg text-gray-300 hover:text-white hover:border-purple-500/50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${mcpRefreshing ? 'animate-spin' : ''}`} />
                Rafraîchir
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Server Status Card */}
              <div className="bg-[#1a1b2e] rounded-xl border border-purple-500/20 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    mcpStatus.isOnline 
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' 
                      : 'bg-gradient-to-br from-red-500/20 to-orange-500/20'
                  }`}>
                    {mcpLoading ? (
                      <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                    ) : mcpStatus.isOnline ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">
                      {mcpLoading ? 'Vérification...' : mcpStatus.isOnline ? 'En ligne' : 'Hors ligne'}
                    </h4>
                    {mcpStatus.serverInfo && (
                      <p className="text-sm text-gray-500">
                        {mcpStatus.serverInfo.name} v{mcpStatus.serverInfo.version}
                      </p>
                    )}
                  </div>
                </div>
                
                {mcpStatus.error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{mcpStatus.error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-[#0f1020] rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">{mcpStatus.tools.length}</div>
                    <div className="text-xs text-gray-500">Outils</div>
                  </div>
                  <div className="text-center p-3 bg-[#0f1020] rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">{mcpStatus.responseTime}<span className="text-sm">ms</span></div>
                    <div className="text-xs text-gray-500">Latence</div>
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-gray-500">
                  Dernière vérification: {mcpStatus.lastChecked.toLocaleTimeString('fr-FR')}
                </div>
              </div>

              {/* Tools List */}
              <div className="lg:col-span-2 bg-[#1a1b2e] rounded-xl border border-purple-500/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-purple-500/20">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Outils MCP Disponibles ({mcpStatus.tools.length})
                  </h4>
                </div>
                
                {mcpStatus.isOnline && mcpStatus.tools.length > 0 ? (
                  <div className="divide-y divide-purple-500/10 max-h-96 overflow-y-auto">
                    {mcpStatus.tools.map((tool, index) => (
                      <div
                        key={index}
                        className="px-6 py-4 hover:bg-purple-500/5 transition"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white">{tool.name}</span>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : mcpLoading ? (
                  <div className="px-6 py-12 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-600 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-500">Chargement des outils...</p>
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <XCircle className="w-8 h-8 text-red-500/50 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">Impossible de charger les outils MCP</p>
                    <button
                      onClick={checkMCPStatus}
                      className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 transition"
                    >
                      Réessayer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* API Endpoints Info */}
            {mcpStatus.isOnline && (
              <div className="mt-6 bg-[#1a1b2e] rounded-xl border border-purple-500/20 p-6">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Points d'accès API MCP
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 bg-[#0f1020] rounded-lg">
                    <code className="text-xs text-green-400">GET</code>
                    <p className="text-sm text-gray-300 mt-1">/api/mcp/tools</p>
                    <p className="text-xs text-gray-500 mt-1">Liste des outils</p>
                  </div>
                  <div className="p-3 bg-[#0f1020] rounded-lg">
                    <code className="text-xs text-blue-400">POST</code>
                    <p className="text-sm text-gray-300 mt-1">/api/mcp/call</p>
                    <p className="text-xs text-gray-500 mt-1">Exécuter un outil</p>
                  </div>
                  <div className="p-3 bg-[#0f1020] rounded-lg">
                    <code className="text-xs text-purple-400">POST</code>
                    <p className="text-sm text-gray-300 mt-1">/api/mcp/initialize</p>
                    <p className="text-xs text-gray-500 mt-1">Initialiser le serveur</p>
                  </div>
                  <div className="p-3 bg-[#0f1020] rounded-lg">
                    <code className="text-xs text-orange-400">POST</code>
                    <p className="text-sm text-gray-300 mt-1">/api/mcp/query-docs</p>
                    <p className="text-xs text-gray-500 mt-1">Rechercher docs</p>
                  </div>
                </div>
              </div>
            )}
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
