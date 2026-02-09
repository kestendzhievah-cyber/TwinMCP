'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Github, 
  ChevronRight, 
  Sparkles,
  ArrowRight,
  Globe,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Database,
  Code,
  X,
  ExternalLink,
  Zap,
  Shield,
  RefreshCw,
  Plus,
  Rocket,
  Library
} from 'lucide-react';

// Icônes personnalisées pour les sources
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
  placeholder: string;
  available: boolean;
}

interface ImportResult {
  success: boolean;
  message?: string;
  savedToDb?: boolean;
  data?: {
    libraryId: string;
    name: string;
    source: string;
    status: string;
    tokensCount: number;
    snippetsCount: number;
    createdAt: string;
    library?: any;
  };
  error?: string;
}

// Helper to save library to localStorage
function saveLibraryToLocalStorage(library: any) {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem('twinmcp_user_libraries');
    const libraries = stored ? JSON.parse(stored) : [];
    
    // Check if already exists
    const existingIndex = libraries.findIndex((lib: any) => lib.id === library.id);
    if (existingIndex >= 0) {
      libraries[existingIndex] = library;
    } else {
      libraries.unshift(library);
    }
    
    // Keep only last 50 libraries
    const trimmed = libraries.slice(0, 50);
    localStorage.setItem('twinmcp_user_libraries', JSON.stringify(trimmed));
  } catch {
    // Ignore localStorage errors
  }
}

// Helper to get libraries from localStorage
function getLibrariesFromLocalStorage(): any[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('twinmcp_user_libraries');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function AjouterBibliotheques() {
  const router = useRouter();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentImports, setRecentImports] = useState<NonNullable<ImportResult['data']>[]>([]);

  // Load recent imports from localStorage on mount
  useEffect(() => {
    const storedLibraries = getLibrariesFromLocalStorage();
    const recent = storedLibraries.slice(0, 5).map((lib: any) => ({
      libraryId: lib.id,
      name: lib.name,
      source: lib.source,
      status: 'completed',
      tokensCount: lib.tokens,
      snippetsCount: lib.snippets,
      createdAt: lib.createdAt
    }));
    setRecentImports(recent);
  }, []);

  const librarySources: LibrarySource[] = [
    {
      id: 'github',
      name: 'GitHub',
      icon: <Github className="w-6 h-6" />,
      description: 'Importer depuis un dépôt GitHub public ou privé',
      placeholder: 'https://github.com/utilisateur/depot',
      available: true
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      icon: <GitLabIcon />,
      description: 'Importer depuis un projet GitLab',
      placeholder: 'https://gitlab.com/utilisateur/projet',
      available: true
    },
    {
      id: 'bitbucket',
      name: 'Bitbucket',
      icon: <BitbucketIcon />,
      description: 'Importer depuis un dépôt Bitbucket',
      placeholder: 'https://bitbucket.org/utilisateur/depot',
      available: true
    },
    {
      id: 'openapi',
      name: 'OpenAPI',
      icon: <OpenAPIIcon />,
      description: 'Spécification OpenAPI/Swagger JSON ou YAML',
      placeholder: 'https://api.exemple.com/openapi.json',
      available: true
    },
    {
      id: 'llms',
      name: 'LLMs.txt',
      icon: <FileText className="w-6 h-6" />,
      description: 'Fichier llms.txt pour documentation LLM',
      placeholder: 'https://exemple.com/llms.txt',
      available: true
    },
    {
      id: 'website',
      name: 'Site Web',
      icon: <Globe className="w-6 h-6" />,
      description: 'Extraire la documentation depuis un site web',
      placeholder: 'https://docs.exemple.com',
      available: true
    }
  ];

  const handleImport = useCallback(async () => {
    if (!selectedSource || !importUrl.trim()) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/libraries/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: selectedSource,
          url: importUrl.trim(),
          name: libraryName.trim() || undefined,
        }),
      });

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.success && result.data) {
        // Save to localStorage for persistence
        if (result.data.library) {
          saveLibraryToLocalStorage(result.data.library);
        }
        
        setRecentImports(prev => [result.data!, ...prev.slice(0, 4)]);
        // Réinitialiser le formulaire après succès et rediriger vers la bibliothèque
        setTimeout(() => {
          setImportUrl('');
          setLibraryName('');
          // Rediriger vers la page de la bibliothèque après 2 secondes
          router.push('/dashboard/library');
        }, 2000);
      }
    } catch (error) {
      setImportResult({
        success: false,
        error: 'Erreur de connexion. Veuillez réessayer.'
      });
    } finally {
      setIsImporting(false);
    }
  }, [importUrl, selectedSource, libraryName, router]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && importUrl.trim() && !isImporting) {
      handleImport();
    }
  }, [importUrl, isImporting, handleImport]);

  const clearSelection = useCallback(() => {
    setSelectedSource(null);
    setImportUrl('');
    setLibraryName('');
    setImportResult(null);
  }, []);

  const selectedSourceData = librarySources.find(s => s.id === selectedSource);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600/20 via-pink-500/10 to-purple-800/20 border border-purple-500/30">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-32 h-32 bg-purple-500 rounded-full blur-3xl" />
          <div className="absolute bottom-4 right-8 w-40 h-40 bg-pink-500 rounded-full blur-3xl" />
        </div>
        
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">
                    Déployer un Serveur MCP
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Importez votre documentation en quelques clics
                  </p>
                </div>
              </div>
              
              {/* Features Pills */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-sm text-purple-300">
                  <Zap className="w-3.5 h-3.5" />
                  Import rapide
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm text-green-300">
                  <Shield className="w-3.5 h-3.5" />
                  Sécurisé
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm text-blue-300">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Mise à jour auto
                </span>
              </div>
            </div>

            {/* Right Stats */}
            <div className="flex gap-4 lg:gap-6">
              <div className="text-center p-4 bg-[#1a1b2e]/50 rounded-xl border border-purple-500/20">
                <div className="text-2xl lg:text-3xl font-bold text-white">6</div>
                <div className="text-xs text-gray-400">Sources</div>
              </div>
              <div className="text-center p-4 bg-[#1a1b2e]/50 rounded-xl border border-purple-500/20">
                <div className="text-2xl lg:text-3xl font-bold text-purple-400">{recentImports.length}</div>
                <div className="text-xs text-gray-400">Importés</div>
              </div>
              <Link 
                href="/dashboard/library"
                className="hidden lg:flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition group"
              >
                <Library className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition" />
                <div className="text-xs text-gray-400 mt-1">Voir tout</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Selection */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              Choisir une source
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {librarySources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => {
                    setSelectedSource(source.id);
                    setImportResult(null);
                  }}
                  disabled={!source.available}
                  className={`group p-4 rounded-xl border transition-all text-left ${
                    selectedSource === source.id
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                      : source.available
                        ? 'bg-[#0f1020] border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5'
                        : 'bg-gray-900/30 border-gray-700/30 opacity-50 cursor-not-allowed'
                  }`}
                  data-testid={`source-${source.id}`}
                >
                  <div className={`mb-2 ${
                    selectedSource === source.id 
                      ? 'text-purple-400' 
                      : 'text-gray-400 group-hover:text-purple-400'
                  }`}>
                    {source.icon}
                  </div>
                  <p className={`font-medium text-sm ${
                    selectedSource === source.id ? 'text-white' : 'text-gray-300'
                  }`}>
                    {source.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {source.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Import Form */}
            {selectedSource && selectedSourceData && (
              <div className="mt-6 pt-6 border-t border-purple-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <span className="text-purple-400">{selectedSourceData.icon}</span>
                    Importer depuis {selectedSourceData.name}
                  </h3>
                  <button
                    onClick={clearSelection}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">URL *</label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={selectedSourceData.placeholder}
                    className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                    data-testid="import-url-input"
                  />
                </div>

                {/* Optional Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Nom personnalisé <span className="text-gray-600">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={libraryName}
                    onChange={(e) => setLibraryName(e.target.value)}
                    placeholder="Ex: Ma Bibliothèque"
                    className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                    data-testid="import-name-input"
                  />
                </div>

                {/* Result Message */}
                {importResult && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${
                    importResult.success 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={importResult.success ? 'text-green-300' : 'text-red-300'}>
                        {importResult.success ? importResult.message : importResult.error}
                      </p>
                      {importResult.success && importResult.data && (
                        <div className="mt-2 text-sm text-gray-400">
                          <p>Bibliothèque: <span className="text-white">{importResult.data.name}</span></p>
                          <p>Tokens estimés: <span className="text-white">{importResult.data.tokensCount?.toLocaleString()}</span></p>
                          <p>Snippets: <span className="text-white">{importResult.data.snippetsCount?.toLocaleString()}</span></p>
                          <p className="mt-2 text-purple-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Redirection vers la bibliothèque...
                          </p>
                        </div>
                      )}
                    </div>
                    {importResult.success && (
                      <Link 
                        href="/dashboard/library"
                        className="text-purple-400 hover:text-purple-300 transition flex-shrink-0"
                        title="Voir dans la bibliothèque"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                    )}
                  </div>
                )}

                {/* Import Button */}
                <button
                  onClick={handleImport}
                  disabled={!importUrl.trim() || isImporting}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                  data-testid="import-btn"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Importer la documentation
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Imports */}
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Imports récents
            </h3>
            
            {recentImports.length > 0 ? (
              <div className="space-y-3">
                {recentImports.map((imp, index) => (
                  <div key={index} className="p-3 bg-[#0f1020] rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">{imp.name}</span>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        {imp.source}
                      </span>
                      <span>{imp.tokensCount?.toLocaleString()} tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun import récent</p>
                <p className="text-xs mt-1">Sélectionnez une source pour commencer</p>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Conseils
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>Utilisez des dépôts publics pour un import plus rapide</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>Les fichiers README et docs/ sont automatiquement indexés</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>Les mises à jour sont synchronisées automatiquement</span>
              </li>
            </ul>
            
            <Link
              href="/dashboard/docs"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/30 transition text-sm font-medium"
            >
              <BookOpen className="w-4 h-4" />
              Voir la documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
