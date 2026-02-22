'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Sparkles, ArrowLeft, BookOpen, Settings, Github, Globe, Download, Users,
  Clock, CheckCircle, ExternalLink, Copy, Terminal, Code, Star, GitFork,
  FileText, Tag, Shield, Layers, Play
} from 'lucide-react';
import { librariesData, type MCPLibraryData } from '@/lib/mcp-libraries-data';

interface RuntimeLibrary {
  id: string;
  name: string;
  vendor: string;
  ecosystem: string;
  language: string;
  description: string;
  repo: string;
  docs: string;
  defaultVersion: string;
  tokens: number;
  snippets: number;
  lastCrawled: string;
  tags: string[];
  isUserImported?: boolean;
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (!Number.isFinite(diffDays) || diffDays < 0) return 'récemment';
  if (diffDays === 0) return 'aujourd\'hui';
  if (diffDays === 1) return '1 jour';
  if (diffDays < 30) return `${diffDays} jours`;
  return `${Math.floor(diffDays / 30)} mois`;
}

function buildInstallCommand(ecosystem: string, packageName: string): string {
  if (ecosystem === 'pip') return `pip install ${packageName}`;
  if (ecosystem === 'cargo') return `cargo add ${packageName}`;
  return `npm install ${packageName}`;
}

function toDetailLibrary(lib: RuntimeLibrary): MCPLibraryData {
  const sourceType: 'github' | 'website' = lib.repo.includes('github.com') ? 'github' : 'website';
  const packageName = lib.name.toLowerCase().replace(/\s+/g, '-');
  const categories = lib.tags?.length ? lib.tags.slice(0, 4) : [lib.ecosystem, 'documentation'];
  const features = lib.tags?.length
    ? lib.tags.slice(0, 5).map((tag) => `Support ${tag}`)
    : ['Documentation indexée', 'Recherche contextuelle', 'Intégration MCP'];

  return {
    id: lib.id,
    name: lib.name,
    source: sourceType === 'github' ? `/${lib.vendor}/${lib.name}` : lib.repo || lib.docs,
    sourceType,
    tokens: formatCompactNumber(lib.tokens),
    snippets: formatCompactNumber(lib.snippets),
    lastUpdate: formatRelativeDate(lib.lastCrawled),
    isVerified: !!lib.isUserImported,
    description: lib.description,
    longDescription: lib.description || 'Bibliothèque importée et prête à être utilisée avec votre serveur MCP.',
    version: lib.defaultVersion || '1.0.0',
    language: lib.language || 'Unknown',
    license: 'N/A',
    stars: '—',
    forks: '—',
    contributors: 0,
    categories,
    features,
    installation: buildInstallCommand(lib.ecosystem, packageName),
    usage: `// Exemple d\'utilisation\nconst client = createMcpClient({ libraryId: "${lib.id}" });\nconst result = await client.query("Comment utiliser ${lib.name} ?");`,
    documentation: lib.docs || lib.repo,
    repository: lib.repo,
    examples: [
      { title: 'Connexion au serveur MCP', code: `Connecter ${lib.name} à votre serveur MCP` },
      { title: 'Recherche de documentation', code: `Rechercher des snippets dans ${lib.name}` },
    ],
  };
}

export default function LibraryDetailPage() {
  const params = useParams();
  const rawLibraryId = params.id as string;
  const libraryId = decodeURIComponent(rawLibraryId);
  const staticLibrary = useMemo(() => librariesData[libraryId], [libraryId]);
  const [runtimeLibrary, setRuntimeLibrary] = useState<RuntimeLibrary | null>(null);
  const [loading, setLoading] = useState(!staticLibrary);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (staticLibrary) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadRuntimeLibrary = async () => {
      try {
        const stored = localStorage.getItem('twinmcp_user_libraries');
        const localLibraries: RuntimeLibrary[] = stored ? JSON.parse(stored) : [];
        const localMatch = localLibraries.find((lib) => lib.id === libraryId);
        if (localMatch && !cancelled) {
          setRuntimeLibrary(localMatch);
          return;
        }

        const res = await fetch('/api/libraries?includeDefaults=true&limit=200', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) return;

        const data = await res.json();
        const apiMatch = (data.libraries || []).find((lib: RuntimeLibrary) => lib.id === libraryId);
        if (apiMatch && !cancelled) {
          setRuntimeLibrary(apiMatch);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRuntimeLibrary();

    return () => {
      cancelled = true;
    };
  }, [libraryId, staticLibrary]);

  const library = useMemo(() => {
    if (staticLibrary) return staticLibrary;
    if (runtimeLibrary) return toDetailLibrary(runtimeLibrary);
    return null;
  }, [staticLibrary, runtimeLibrary]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!library && loading) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-white mb-4">Chargement de la bibliothèque...</h1>
        <Link href="/dashboard/library" className="text-purple-400 hover:text-purple-300">Retour aux bibliothèques</Link>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-white mb-4">Bibliothèque non trouvée</h1>
        <Link href="/dashboard/library" className="text-purple-400 hover:text-purple-300">Retour aux bibliothèques</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/dashboard/library" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
        <ArrowLeft className="w-4 h-4" />
        Retour aux bibliothèques
      </Link>

        {/* En-tête */}
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 lg:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-white">{library.name}</h1>
                {library.isVerified && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs font-medium rounded-full">
                    <CheckCircle className="w-3 h-3" />Vérifié
                  </span>
                )}
                <span className="px-2 py-1 bg-[#0f1020] text-gray-400 text-xs font-medium rounded-full">{library.language}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                {library.sourceType === 'github' ? <Github className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                <span>{library.source}</span>
              </div>
              <p className="text-gray-300 text-lg mb-6">{library.longDescription}</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-gray-400"><FileText className="w-5 h-5" /><span>{library.tokens} tokens</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Code className="w-5 h-5" /><span>{library.snippets} snippets</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Clock className="w-5 h-5" /><span>Mis à jour il y a {library.lastUpdate}</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Tag className="w-5 h-5" /><span>v{library.version}</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <a href={library.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[#0f1020] border border-purple-500/20 rounded-lg text-gray-300 hover:text-white hover:border-purple-500/50 transition">
                <Github className="w-5 h-5" />Repository<ExternalLink className="w-4 h-4" />
              </a>
              <a href={library.documentation} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[#0f1020] border border-purple-500/20 rounded-lg text-gray-300 hover:text-white hover:border-purple-500/50 transition">
                <BookOpen className="w-5 h-5" />Documentation<ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Installation */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />Installation
              </h2>
              <div className="relative">
                <pre className="bg-[#0f1020] rounded-lg p-4 overflow-x-auto"><code className="text-green-400">{library.installation}</code></pre>
                <button onClick={() => copyToClipboard(library.installation, 'install')} className="absolute top-2 right-2 p-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition">
                  {copied === 'install' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Exemple d'utilisation */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" />Exemple d'utilisation
              </h2>
              <div className="relative">
                <pre className="bg-[#0f1020] rounded-lg p-4 overflow-x-auto text-sm"><code className="text-blue-300">{library.usage}</code></pre>
                <button onClick={() => copyToClipboard(library.usage, 'usage')} className="absolute top-2 right-2 p-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition">
                  {copied === 'usage' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Exemples de prompts */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-400" />Exemples de prompts
              </h2>
              <div className="space-y-4">
                {library.examples.map((example, index) => (
                  <div key={index} className="bg-[#0f1020] rounded-lg p-4">
                    <h3 className="text-white font-medium mb-2">{example.title}</h3>
                    <p className="text-gray-400 text-sm italic">"{example.code}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats GitHub */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Statistiques</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400"><Star className="w-5 h-5 text-yellow-500" /><span>Stars</span></div>
                  <span className="text-white font-medium">{library.stars}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400"><GitFork className="w-5 h-5 text-blue-400" /><span>Forks</span></div>
                  <span className="text-white font-medium">{library.forks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400"><Users className="w-5 h-5 text-green-400" /><span>Contributeurs</span></div>
                  <span className="text-white font-medium">{library.contributors}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400"><Shield className="w-5 h-5 text-purple-400" /><span>Licence</span></div>
                  <span className="text-white font-medium">{library.license}</span>
                </div>
              </div>
            </div>

            {/* Fonctionnalités */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Fonctionnalités</h2>
              <ul className="space-y-3">
                {library.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Catégories */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Catégories</h2>
              <div className="flex flex-wrap gap-2">
                {library.categories.map((category, index) => (
                  <span key={index} className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full">
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
