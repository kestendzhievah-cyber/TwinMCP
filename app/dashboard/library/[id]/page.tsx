'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Sparkles, ArrowLeft, BookOpen, Settings, Github, Globe, Download, Users,
  Clock, CheckCircle, ExternalLink, Copy, Terminal, Code, Star, GitFork,
  FileText, Tag, Shield, Layers, Play
} from 'lucide-react';
import { librariesData } from '@/lib/mcp-libraries-data';

export default function LibraryDetailPage() {
  const params = useParams();
  const libraryId = params.id as string;
  const library = useMemo(() => librariesData[libraryId], [libraryId]);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!library) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bibliothèque non trouvée</h1>
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">Retour au dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-[#1a1b2e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">TwinMCP</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard/docs" className="hidden sm:flex text-gray-300 hover:text-white transition items-center gap-1 text-sm">
                <BookOpen className="w-4 h-4" /><span className="hidden lg:inline">Docs</span>
              </Link>
              <Link href="/dashboard/settings" className="hidden lg:flex text-gray-300 hover:text-white transition items-center gap-1 text-sm">
                <Settings className="w-4 h-4" /><span>Paramètres</span>
              </Link>
              <Link href="/dashboard" className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Retour</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
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

      {/* Footer */}
      <footer className="border-t border-purple-500/20 py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">© 2026 TwinMCP - Propulsé par <Link href="/" className="text-purple-400 hover:text-purple-300">NéoTech</Link></p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/about" className="text-gray-400 hover:text-white transition">À propos</Link>
            <Link href="/contact" className="text-gray-400 hover:text-white transition">Contact</Link>
            <Link href="/legal" className="text-gray-400 hover:text-white transition">Mentions légales</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
