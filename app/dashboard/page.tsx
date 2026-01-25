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

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'trending' | 'recent' | 'skills'>('popular');

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
      name: 'Tailwind CSS',
      source: 'tailwindcss.com/docs',
      sourceType: 'website',
      tokens: '326K',
      snippets: '2,1K',
      lastUpdate: '1 jour',
      isVerified: true,
    },
    {
      id: '7',
      name: 'React',
      source: '/facebook/react',
      sourceType: 'github',
      tokens: '1,2M',
      snippets: '3,8K',
      lastUpdate: '3 jours',
      isVerified: true,
    },
    {
      id: '8',
      name: 'Prisma',
      source: '/prisma/prisma',
      sourceType: 'github',
      tokens: '654K',
      snippets: '1,9K',
      lastUpdate: '5 jours',
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-gradient-to-r from-purple-100/50 to-pink-100/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">TwinMCP</span>
              </Link>
              <Link
                href="/login"
                className="ml-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2"
              >
                Se connecter
              </Link>
            </div>

            <div className="flex items-center gap-6">
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition font-medium underline">
                Plans
              </Link>
              <Link href="/dashboard/analytics" className="text-gray-600 hover:text-gray-900 transition font-medium flex items-center gap-1">
                <Github className="w-4 h-4" />
                Install
              </Link>
              <Link href="/dashboard/settings" className="text-gray-600 hover:text-gray-900 transition font-medium underline">
                More...
              </Link>
              <Link
                href="/dashboard/agent-builder"
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Docs
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Documentation à jour</span>
          </h1>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            pour les LLMs et éditeurs de code IA
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Obtenez la documentation et le code les plus récents dans Cursor, Claude ou d'autres LLMs
          </p>

          {/* Search Bar */}
          <div className="flex items-center gap-4 max-w-3xl">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une bibliothèque (ex: Next, React)"
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition shadow-sm"
              />
            </div>
            <span className="text-gray-400">ou</span>
            <button
              onClick={() => router.push('/chat')}
              className="px-6 py-4 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition shadow-sm flex items-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Chat avec Docs
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 pb-4 border-b-2 transition font-medium ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Bibliothèque</div>
            <div className="col-span-3">Source</div>
            <div className="col-span-1 text-right">Tokens</div>
            <div className="col-span-2 text-right">Snippets</div>
            <div className="col-span-2 text-right">Mise à jour</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {filteredLibraries.map((lib) => (
              <div
                key={lib.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-purple-50/50 transition cursor-pointer items-center"
                onClick={() => router.push(`/dashboard/library/${lib.id}`)}
              >
                {/* Library Name */}
                <div className="col-span-4">
                  <span className="font-semibold text-purple-600 hover:text-purple-700">
                    {lib.name}
                  </span>
                </div>

                {/* Source */}
                <div className="col-span-3 flex items-center gap-2 text-gray-600">
                  {lib.sourceType === 'github' ? (
                    <Github className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Globe className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="truncate">{lib.source}</span>
                </div>

                {/* Tokens */}
                <div className="col-span-1 text-right text-gray-600 font-medium">
                  {lib.tokens}
                </div>

                {/* Snippets */}
                <div className="col-span-2 text-right text-gray-600">
                  {lib.snippets}
                </div>

                {/* Last Update */}
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <span className="text-gray-500">{lib.lastUpdate}</span>
                  {lib.isVerified && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredLibraries.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune bibliothèque trouvée</h3>
            <p className="text-gray-500 mb-4">Essayez une autre recherche ou ajoutez une nouvelle bibliothèque</p>
            <Link
              href="/dashboard/agent-builder"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition"
            >
              <Plus className="w-5 h-5" />
              Ajouter une bibliothèque
            </Link>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            {libraries.length} bibliothèques indexées • Mise à jour automatique quotidienne
          </p>
        </div>
      </div>
    </div>
  );
}
