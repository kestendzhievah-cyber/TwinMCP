'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Filter,
  Github,
  Globe,
  CheckCircle,
  Clock,
  Star,
  TrendingUp,
  BookOpen,
  RefreshCw,
  Download,
  ChevronDown,
  Grid,
  List,
} from 'lucide-react';

interface Library {
  id: string;
  name: string;
  vendor: string;
  ecosystem: string;
  language: string;
  description: string;
  repo: string;
  docs: string;
  versions: string[];
  defaultVersion: string;
  popularity: number;
  tokens: number;
  snippets: number;
  lastCrawled: string;
  tags: string[];
  isUserImported?: boolean;
}

export default function LibrariesPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEcosystem, setSelectedEcosystem] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState({ userImported: 0, totalLibraries: 0 });

  // Fetch libraries from API
  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (selectedEcosystem !== 'all') params.append('ecosystem', selectedEcosystem);
        params.append('sortBy', sortBy);
        params.append('limit', '50');

        const response = await fetch(`/api/libraries?${params}`);
        const data = await response.json();
        setLibraries(data.libraries || []);
        setStats({
          userImported: data.stats?.userImported || 0,
          totalLibraries: data.stats?.totalLibraries || data.libraries?.length || 0
        });
      } catch (error) {
        console.error('Failed to fetch libraries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibraries();
  }, [searchQuery, selectedEcosystem, sortBy]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `${diffDays} jours`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semaines`;
    return `${Math.floor(diffDays / 30)} mois`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-purple-400" />
            Bibliothèques
          </h1>
          <p className="text-gray-400 mt-1">
            {libraries.length} bibliothèques indexées avec documentation à jour
          </p>
        </div>
        <Link
          href="/dashboard/agent-builder"
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2 w-fit shadow-lg shadow-purple-500/30"
        >
          <Plus className="w-5 h-5" />
          Ajouter une bibliothèque
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une bibliothèque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition"
          />
        </div>

        {/* Ecosystem Filter */}
        <div className="relative">
          <select
            value={selectedEcosystem}
            onChange={(e) => setSelectedEcosystem(e.target.value)}
            className="appearance-none px-4 py-3 pr-10 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition cursor-pointer"
          >
            <option value="all">Tous les écosystèmes</option>
            <option value="npm">NPM</option>
            <option value="pip">Python (pip)</option>
            <option value="cargo">Rust (cargo)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none px-4 py-3 pr-10 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition cursor-pointer"
          >
            <option value="popularity">Popularité</option>
            <option value="name">Nom</option>
            <option value="tokens">Tokens</option>
            <option value="updated">Mise à jour</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[#1a1b2e] border border-purple-500/20 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraries.map((lib) => (
            <Link
              key={lib.id}
              href={`/dashboard/library/${encodeURIComponent(lib.id)}`}
              className="group bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-5 hover:border-purple-500/40 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-purple-400 transition">
                      {lib.name}
                    </h3>
                    <p className="text-xs text-gray-500">{lib.vendor}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  {lib.ecosystem}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {lib.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-[#0f1020] rounded-lg">
                  <p className="text-lg font-semibold text-white">{formatNumber(lib.tokens)}</p>
                  <p className="text-xs text-gray-500">tokens</p>
                </div>
                <div className="text-center p-2 bg-[#0f1020] rounded-lg">
                  <p className="text-lg font-semibold text-white">{formatNumber(lib.snippets)}</p>
                  <p className="text-xs text-gray-500">snippets</p>
                </div>
                <div className="text-center p-2 bg-[#0f1020] rounded-lg">
                  <p className="text-lg font-semibold text-white">{lib.popularity}</p>
                  <p className="text-xs text-gray-500">score</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(lib.lastCrawled)}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  v{lib.defaultVersion}
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-3">
                {lib.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-[#0f1020] text-xs font-medium text-gray-400 uppercase tracking-wider">
            <div className="col-span-4">Bibliothèque</div>
            <div className="col-span-2">Écosystème</div>
            <div className="col-span-2 text-right">Tokens</div>
            <div className="col-span-2 text-right">Snippets</div>
            <div className="col-span-2 text-right">Mise à jour</div>
          </div>
          <div className="divide-y divide-purple-500/10">
            {libraries.map((lib) => (
              <Link
                key={lib.id}
                href={`/dashboard/library/${encodeURIComponent(lib.id)}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-purple-500/5 transition items-center"
              >
                <div className="col-span-12 lg:col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white hover:text-purple-400 transition">{lib.name}</h3>
                    <p className="text-xs text-gray-500">{lib.vendor}</p>
                  </div>
                </div>
                <div className="hidden lg:block col-span-2">
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    {lib.ecosystem}
                  </span>
                </div>
                <div className="hidden lg:block col-span-2 text-right text-gray-300">
                  {formatNumber(lib.tokens)}
                </div>
                <div className="hidden lg:block col-span-2 text-right text-gray-400">
                  {formatNumber(lib.snippets)}
                </div>
                <div className="hidden lg:flex col-span-2 items-center justify-end gap-2 text-gray-500 text-sm">
                  <Clock className="w-4 h-4" />
                  {formatDate(lib.lastCrawled)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && libraries.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucune bibliothèque trouvée</h3>
          <p className="text-gray-400 mb-6">Essayez une autre recherche ou ajoutez une nouvelle bibliothèque</p>
          <Link
            href="/dashboard/agent-builder"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition"
          >
            <Plus className="w-5 h-5" />
            Ajouter une bibliothèque
          </Link>
        </div>
      )}
    </div>
  );
}
