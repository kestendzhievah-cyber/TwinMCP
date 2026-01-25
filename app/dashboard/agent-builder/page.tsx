'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Github, 
  ChevronRight, 
  Sparkles,
  Plus,
  ArrowRight,
  User,
  ExternalLink,
  Globe,
  FileText,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// Icon components for library sources
const GitLabIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
  </svg>
);

const BitbucketIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
  </svg>
);

const OpenAPIIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center font-mono text-sm font-bold">
    {'{*}'}
  </div>
);

interface LibrarySource {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

export default function AddLibrariesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const librarySources: LibrarySource[] = [
    {
      id: 'github',
      name: 'GitHub',
      icon: <Github className="w-6 h-6" />,
      description: 'Importer depuis un repository GitHub',
      available: true
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      icon: <GitLabIcon />,
      description: 'Importer depuis GitLab',
      available: true
    },
    {
      id: 'bitbucket',
      name: 'Bitbucket',
      icon: <BitbucketIcon />,
      description: 'Importer depuis Bitbucket',
      available: true
    },
    {
      id: 'openapi',
      name: 'OpenAPI',
      icon: <OpenAPIIcon />,
      description: 'Importer une spécification OpenAPI',
      available: true
    },
    {
      id: 'llms',
      name: 'LLMs.txt',
      icon: <FileText className="w-6 h-6" />,
      description: 'Importer depuis un fichier LLMs.txt',
      available: true
    },
    {
      id: 'website',
      name: 'Website',
      icon: <Globe className="w-6 h-6" />,
      description: 'Scraper la documentation d\'un site web',
      available: true
    }
  ];

  const handleSourceClick = (sourceId: string) => {
    setSelectedSource(sourceId);
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    
    setIsImporting(true);
    
    // Simulate import
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsImporting(false);
    setImportSuccess(true);
    
    setTimeout(() => {
      setImportSuccess(false);
      setSelectedSource(null);
      setImportUrl('');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-lg fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-2">
                <Sparkles className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold text-white">TwinMCP</span>
              </Link>
            </div>

            <div className="flex items-center space-x-6">
              <Link href="/pricing" className="text-gray-300 hover:text-white transition text-sm">
                Plans
              </Link>
              <Link href="/dashboard/docs" className="text-gray-300 hover:text-white transition text-sm flex items-center gap-1">
                <Github className="w-4 h-4" />
                Install
              </Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition text-sm">
                More...
              </Link>
              <button 
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Docs
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Add Libraries Card */}
          <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-2xl p-8 mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Add Libraries</h1>
            <p className="text-gray-400 mb-8">Select and add your documentation source</p>

            {/* Library Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {librarySources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => handleSourceClick(source.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    selectedSource === source.id
                      ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'bg-slate-700/30 border-slate-600/50 hover:border-purple-500/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${selectedSource === source.id ? 'text-purple-400' : 'text-gray-400'}`}>
                      {source.icon}
                    </div>
                    <span className={`font-medium ${selectedSource === source.id ? 'text-white' : 'text-gray-300'}`}>
                      {source.name}
                    </span>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${selectedSource === source.id ? 'text-purple-400' : 'text-gray-500'}`} />
                </button>
              ))}
            </div>

            {/* Import Form (shown when source is selected) */}
            {selectedSource && (
              <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Import from {librarySources.find(s => s.id === selectedSource)?.name}
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder={`Enter ${selectedSource === 'github' ? 'GitHub repository URL' : selectedSource === 'website' ? 'Website URL' : 'URL or path'}...`}
                    className="flex-1 bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                  />
                  <button
                    onClick={handleImport}
                    disabled={isImporting || !importUrl.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : importSuccess ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Success!
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Import
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Sign in prompt */}
            {!user && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                <User className="w-5 h-5 text-amber-400" />
                <span className="text-amber-300">
                  Please{' '}
                  <Link href="/login" className="underline hover:text-amber-200 font-semibold">
                    sign in
                  </Link>
                  {' '}to add libraries.
                </span>
              </div>
            )}
          </div>

          {/* See Tasks in Progress */}
          <div className="text-center">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition group"
            >
              <Clock className="w-4 h-4" />
              See Tasks in Progress
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2026, TwinMCP is a project by{' '}
            <Link href="/" className="text-purple-400 hover:text-purple-300 underline">
              TwinMCP Team
            </Link>
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/about" className="text-gray-400 hover:text-white transition">About</Link>
            <Link href="/contact" className="text-gray-400 hover:text-white transition">Contact</Link>
            <Link href="/legal" className="text-gray-400 hover:text-white transition">Legal</Link>
            <a href="https://twitter.com/twinmcp" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition flex items-center gap-1">
              Follow on X
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
