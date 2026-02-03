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
  BarChart3,
  Server,
  XCircle,
  RefreshCw,
  Activity,
  AlertTriangle,
  Cloud,
  Terminal,
  Box,
  FileText,
  CreditCard,
  Cpu,
  Key,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface MCPServerStatus {
  isOnline: boolean;
  serverInfo: { name: string; version: string } | null;
  tools: { name: string; description: string }[];
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [mcpStatus, setMcpStatus] = useState<MCPServerStatus>({
    isOnline: false,
    serverInfo: null,
    tools: [],
    lastChecked: new Date(),
    responseTime: 0,
  });
  const [mcpLoading, setMcpLoading] = useState(true);

  // Quick stats
  const stats = [
    { label: 'Bibliothèques', value: '12', icon: BookOpen, color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-600/10' },
    { label: 'Requêtes/jour', value: '1,234', icon: BarChart3, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/10' },
    { label: 'Clés API', value: '3', icon: Key, color: 'text-green-400', bg: 'from-green-500/20 to-green-600/10' },
    { label: 'Uptime', value: '99.9%', icon: Activity, color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/10' },
  ];

  // Check MCP status
  const checkMCPStatus = useCallback(async () => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/mcp');
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      setMcpStatus({
        isOnline: true,
        serverInfo: { name: data.name || 'TwinMCP', version: data.version || '1.0.0' },
        tools: data.tools || [],
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      setMcpStatus({
        isOnline: false,
        serverInfo: null,
        tools: [],
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setMcpLoading(false);
    }
  }, []);

  useEffect(() => {
    checkMCPStatus();
    const interval = setInterval(checkMCPStatus, 30000);
    return () => clearInterval(interval);
  }, [checkMCPStatus]);

  // Quick actions
  const quickActions = [
    { name: 'Ajouter Documentation', href: '/dashboard/agent-builder', icon: Plus, color: 'from-purple-500 to-pink-500' },
    { name: 'Gérer Clés API', href: '/dashboard/api-keys', icon: Key, color: 'from-green-500 to-emerald-500' },
    { name: 'Voir Analytics', href: '/dashboard/analytics', icon: BarChart3, color: 'from-blue-500 to-cyan-500' },
    { name: 'Chat avec Docs', href: '/chat', icon: MessageSquare, color: 'from-orange-500 to-red-500' },
  ];

  // Popular libraries
  const libraries = [
    { name: 'Next.js', source: '/vercel/next.js', tokens: '572K', snippets: '2.1K', updated: '4 jours' },
    { name: 'React', source: '/facebook/react', tokens: '1.2M', snippets: '3.8K', updated: '3 jours' },
    { name: 'MongoDB', source: '/mongodb/docs', tokens: '312K', snippets: '1.5K', updated: '1 jour' },
    { name: 'Prisma', source: '/prisma/prisma', tokens: '445K', snippets: '2.0K', updated: '2 jours' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Bienvenue sur <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">TwinMCP</span>
          </h1>
          <p className="text-gray-400">
            Documentation à jour pour les LLMs et éditeurs de code IA
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/agent-builder"
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2 shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-5 h-5" />
            Ajouter Docs
          </Link>
          <Link
            href="/chat"
            className="px-5 py-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white font-medium rounded-xl hover:bg-purple-500/10 transition flex items-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            Chat
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${stat.bg} backdrop-blur-xl border border-purple-500/20 rounded-2xl p-5 hover:border-purple-500/40 transition`}
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-gray-400 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* MCP Server Status */}
      <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Statut Serveur MCP
          </h2>
          <button
            onClick={checkMCPStatus}
            disabled={mcpLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${mcpLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Card */}
          <div className="flex items-center gap-4 p-4 bg-[#0f1020] rounded-xl">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              mcpStatus.isOnline ? 'bg-green-500/20' : 'bg-red-500/20'
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
              <p className="font-semibold text-white">
                {mcpLoading ? 'Vérification...' : mcpStatus.isOnline ? 'En ligne' : 'Hors ligne'}
              </p>
              {mcpStatus.serverInfo && (
                <p className="text-sm text-gray-500">v{mcpStatus.serverInfo.version}</p>
              )}
            </div>
          </div>

          {/* Tools Count */}
          <div className="flex items-center gap-4 p-4 bg-[#0f1020] rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-white">{mcpStatus.tools.length} Outils</p>
              <p className="text-sm text-gray-500">resolve-library, query-docs</p>
            </div>
          </div>

          {/* Response Time */}
          <div className="flex items-center gap-4 p-4 bg-[#0f1020] rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-white">{mcpStatus.responseTime}ms</p>
              <p className="text-sm text-gray-500">Latence</p>
            </div>
          </div>
        </div>

        {mcpStatus.error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{mcpStatus.error}</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Actions rapides</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="group p-5 bg-[#1a1b2e] border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <p className="font-medium text-white group-hover:text-purple-400 transition">{action.name}</p>
              <ArrowRight className="w-4 h-4 text-gray-500 mt-2 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Libraries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            Bibliothèques populaires
          </h2>
          <Link
            href="/dashboard/library"
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
          >
            Voir tout
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-[#0f1020] text-xs font-medium text-gray-400 uppercase tracking-wider">
            <div className="col-span-4">Nom</div>
            <div className="col-span-3">Source</div>
            <div className="col-span-2 text-right">Tokens</div>
            <div className="col-span-2 text-right">Snippets</div>
            <div className="col-span-1 text-right">MAJ</div>
          </div>
          <div className="divide-y divide-purple-500/10">
            {libraries.map((lib, index) => (
              <Link
                key={index}
                href={`/dashboard/library/${index + 1}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-purple-500/5 transition items-center"
              >
                <div className="col-span-4 md:col-span-4">
                  <span className="font-medium text-white hover:text-purple-400 transition">{lib.name}</span>
                </div>
                <div className="col-span-8 md:col-span-3 flex items-center gap-2 text-gray-400 text-sm">
                  <Github className="w-4 h-4" />
                  <span className="truncate">{lib.source}</span>
                </div>
                <div className="hidden md:block col-span-2 text-right text-gray-300">{lib.tokens}</div>
                <div className="hidden md:block col-span-2 text-right text-gray-400">{lib.snippets}</div>
                <div className="hidden md:block col-span-1 text-right text-gray-500 text-sm">{lib.updated}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Commencer avec TwinMCP
            </h2>
            <p className="text-gray-400 text-sm">
              Configurez TwinMCP dans Cursor, Claude Code ou OpenCode en quelques minutes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/docs"
              className="px-5 py-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white font-medium rounded-xl hover:bg-purple-500/10 transition flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Documentation
            </Link>
            <Link
              href="/dashboard/mcp-guide"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2"
            >
              Guide d'intégration
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
