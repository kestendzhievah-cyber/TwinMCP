'use client';

import React, { useState, useCallback } from 'react';
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
  Settings,
  ArrowLeft,
  Database,
  Code,
  X
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
  data?: {
    libraryId: string;
    name: string;
    source: string;
    status: string;
    tokensCount: number;
    snippetsCount: number;
    createdAt: string;
  };
  error?: string;
}

export default function AjouterBibliotheques() {
  const router = useRouter();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentImports, setRecentImports] = useState<NonNullable<ImportResult['data']>[]>([]);

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
      description: 'Importer une spécification OpenAPI/Swagger',
      placeholder: 'https://api.exemple.com/openapi.json',
      available: true
    },
    {
      id: 'llms',
      name: 'LLMs.txt',
      icon: <FileText className="w-6 h-6" />,
      description: 'Importer depuis un fichier LLMs.txt',
      placeholder: 'https://exemple.com/llms.txt',
      available: true
    },
    {
      id: 'website',
      name: 'Site Web',
      icon: <Globe className="w-6 h-6" />,
      description: 'Extraire la documentation d\'un site web',
      placeholder: 'https://docs.exemple.com',
      available: true
    }
  ];

  const handleSourceClick = useCallback((sourceId: string) => {
    setSelectedSource(sourceId);
    setImportUrl('');
    setLibraryName('');
    setImportResult(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!importUrl.trim() || !selectedSource) return;
    
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
          name: libraryName.trim() || undefined
        }),
      });

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.success && result.data) {
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
        error: 'Erreur de connexion au serveur. Veuillez réessayer.'
      });
    } finally {
      setIsImporting(false);
    }
  }, [importUrl, selectedSource, libraryName]);

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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-[#1a1b2e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/dashboard" className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <span className="text-base sm:text-xl font-bold text-white">TwinMCP</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
              <Link href="/pricing" className="hidden md:block text-gray-300 hover:text-white transition font-medium text-sm underline">
                Tarifs
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
                href="/dashboard"
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs sm:text-sm font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Retour</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu Principal */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-8 sm:py-12">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Ajouter une bibliothèque
            </span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Sélectionnez une source et importez votre documentation pour la rendre accessible aux LLMs
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 sm:p-8 mb-8">
          {/* Grille des sources */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              Sources disponibles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {librarySources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => handleSourceClick(source.id)}
                  disabled={!source.available}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 text-left ${
                    selectedSource === source.id
                      ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                      : source.available
                        ? 'bg-[#0f1020] border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10'
                        : 'bg-[#0f1020]/50 border-gray-700/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${selectedSource === source.id ? 'text-purple-400' : 'text-gray-400'}`}>
                      {source.icon}
                    </div>
                    <div>
                      <span className={`font-medium block ${selectedSource === source.id ? 'text-white' : 'text-gray-300'}`}>
                        {source.name}
                      </span>
                      <span className="text-xs text-gray-500 hidden sm:block">
                        {source.description}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 ${selectedSource === source.id ? 'text-purple-400' : 'text-gray-600'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Formulaire d'import */}
          {selectedSource && selectedSourceData && (
            <div className="bg-[#0f1020] border border-purple-500/20 rounded-xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-purple-400" />
                  Importer depuis {selectedSourceData.name}
                </h3>
                <button
                  onClick={clearSelection}
                  className="p-1 text-gray-500 hover:text-white transition rounded-lg hover:bg-purple-500/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-400 text-sm mb-4">
                {selectedSourceData.description}
              </p>

              <div className="space-y-4">
                {/* Champ URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    URL de la source *
                  </label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={selectedSourceData.placeholder}
                    className="w-full bg-[#1a1b2e] border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                  />
                </div>

                {/* Champ Nom (optionnel) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom de la bibliothèque (optionnel)
                  </label>
                  <input
                    type="text"
                    value={libraryName}
                    onChange={(e) => setLibraryName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ex: React, Next.js, Mon API..."
                    className="w-full bg-[#1a1b2e] border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"
                  />
                </div>

                {/* Message de résultat */}
                {importResult && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 ${
                    importResult.success 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={importResult.success ? 'text-green-300' : 'text-red-300'}>
                        {importResult.success ? importResult.message : importResult.error}
                      </p>
                      {importResult.success && importResult.data && (
                        <div className="mt-2 text-sm text-gray-400">
                          <p>Bibliothèque: <span className="text-white">{importResult.data.name}</span></p>
                          <p>Tokens estimés: <span className="text-white">{importResult.data.tokensCount?.toLocaleString()}</span></p>
                          <p>Snippets: <span className="text-white">{importResult.data.snippetsCount?.toLocaleString()}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bouton d'import */}
                <button
                  onClick={handleImport}
                  disabled={isImporting || !importUrl.trim()}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Importation en cours...
                    </>
                  ) : importResult?.success ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Importé avec succès !
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      Importer la bibliothèque
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Imports récents */}
        {recentImports.length > 0 && (
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Imports récents
            </h3>
            <div className="space-y-3">
              {recentImports.map((item, index) => (
                <div
                  key={`${item.libraryId}-${index}`}
                  className="flex items-center justify-between p-3 bg-[#0f1020] rounded-lg border border-purple-500/10"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.tokensCount?.toLocaleString()} tokens • {item.snippetsCount?.toLocaleString()} snippets
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                    {item.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lien retour */}
        <div className="text-center mt-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition group"
          >
            <Clock className="w-4 h-4" />
            Voir les tâches en cours
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 py-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 TwinMCP - Propulsé par{' '}
            <Link href="/" className="text-purple-400 hover:text-purple-300">
              NéoTech
            </Link>
          </p>
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
