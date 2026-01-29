import { NextRequest, NextResponse } from 'next/server';

interface ImportRequest {
  source: string;
  url: string;
  name?: string;
}

interface ImportResult {
  success: boolean;
  libraryId?: string;
  name?: string;
  source?: string;
  status?: string;
  tokensCount?: number;
  snippetsCount?: number;
  error?: string;
}

// Fonction pour extraire les infos d'une URL GitHub
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace('.git', '') };
  }
  return null;
}

// Fonction pour extraire les infos d'une URL GitLab
function parseGitLabUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/gitlab\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace('.git', '') };
  }
  return null;
}

// Simuler l'import d'une bibliothèque (à remplacer par une vraie implémentation)
async function importLibrary(source: string, url: string): Promise<ImportResult> {
  // Simuler un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 1500));

  let name = '';
  let libraryId = '';

  switch (source) {
    case 'github': {
      const parsed = parseGitHubUrl(url);
      if (!parsed) {
        return { success: false, error: 'URL GitHub invalide' };
      }
      name = parsed.repo;
      libraryId = `github-${parsed.owner}-${parsed.repo}`;
      break;
    }
    case 'gitlab': {
      const parsed = parseGitLabUrl(url);
      if (!parsed) {
        return { success: false, error: 'URL GitLab invalide' };
      }
      name = parsed.repo;
      libraryId = `gitlab-${parsed.owner}-${parsed.repo}`;
      break;
    }
    case 'bitbucket': {
      const match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return { success: false, error: 'URL Bitbucket invalide' };
      }
      name = match[2].replace('.git', '');
      libraryId = `bitbucket-${match[1]}-${name}`;
      break;
    }
    case 'openapi': {
      name = url.split('/').pop()?.replace('.json', '').replace('.yaml', '') || 'openapi-spec';
      libraryId = `openapi-${Date.now()}`;
      break;
    }
    case 'llms': {
      name = url.split('/').pop()?.replace('.txt', '') || 'llms-doc';
      libraryId = `llms-${Date.now()}`;
      break;
    }
    case 'website': {
      try {
        const urlObj = new URL(url);
        name = urlObj.hostname.replace('www.', '');
        libraryId = `website-${name}-${Date.now()}`;
      } catch {
        return { success: false, error: 'URL de site web invalide' };
      }
      break;
    }
    default:
      return { success: false, error: 'Source non supportée' };
  }

  // Simuler des statistiques
  const tokensCount = Math.floor(Math.random() * 500000) + 100000;
  const snippetsCount = Math.floor(Math.random() * 3000) + 500;

  return {
    success: true,
    libraryId,
    name,
    source,
    status: 'processing',
    tokensCount,
    snippetsCount
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { source, url, name } = body;

    // Validation
    if (!source) {
      return NextResponse.json(
        { success: false, error: 'La source est requise' },
        { status: 400 }
      );
    }

    if (!url || !url.trim()) {
      return NextResponse.json(
        { success: false, error: "L'URL est requise" },
        { status: 400 }
      );
    }

    // Valider le format de l'URL
    const validSources = ['github', 'gitlab', 'bitbucket', 'openapi', 'llms', 'website'];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { success: false, error: 'Source non valide' },
        { status: 400 }
      );
    }

    // Importer la bibliothèque
    const result = await importLibrary(source, url.trim());

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Import démarré avec succès',
      data: {
        libraryId: result.libraryId,
        name: name || result.name,
        source: result.source,
        status: result.status,
        tokensCount: result.tokensCount,
        snippetsCount: result.snippetsCount,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Retourner les sources disponibles
  return NextResponse.json({
    sources: [
      { id: 'github', name: 'GitHub', available: true },
      { id: 'gitlab', name: 'GitLab', available: true },
      { id: 'bitbucket', name: 'Bitbucket', available: true },
      { id: 'openapi', name: 'OpenAPI', available: true },
      { id: 'llms', name: 'LLMs.txt', available: true },
      { id: 'website', name: 'Site Web', available: true }
    ]
  });
}
