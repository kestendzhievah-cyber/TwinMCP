import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ImportRequest {
  source: string;
  url: string;
  name?: string;
}

interface RepoMetadata {
  description: string;
  stars: number;
  language: string;
  defaultBranch: string;
  topics: string[];
}

// Extract user ID from Firebase JWT token
function extractUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.user_id || payload.sub || payload.uid || null;
  } catch {
    return null;
  }
}

// Parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace('.git', '').replace(/\/$/, '') };
  }
  return null;
}

// Parse GitLab URL
function parseGitLabUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/gitlab\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace('.git', '').replace(/\/$/, '') };
  }
  return null;
}

// Parse Bitbucket URL
function parseBitbucketUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace('.git', '').replace(/\/$/, '') };
  }
  return null;
}

// Determine ecosystem from source/URL
function determineEcosystem(source: string, url: string): string {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('python') || lowerUrl.includes('pip') || lowerUrl.includes('pypi')) {
    return 'pip';
  }
  if (lowerUrl.includes('rust') || lowerUrl.includes('cargo') || lowerUrl.includes('crates.io')) {
    return 'cargo';
  }
  if (lowerUrl.includes('php') || lowerUrl.includes('composer') || lowerUrl.includes('packagist')) {
    return 'composer';
  }
  
  return 'npm';
}

// Determine language from source/URL
function determineLanguage(source: string, url: string): string {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('python') || lowerUrl.includes('pip') || lowerUrl.includes('pypi') || lowerUrl.includes('.py')) {
    return 'Python';
  }
  if (lowerUrl.includes('rust') || lowerUrl.includes('cargo') || lowerUrl.includes('.rs')) {
    return 'Rust';
  }
  if (lowerUrl.includes('php') || lowerUrl.includes('composer')) {
    return 'PHP';
  }
  if (lowerUrl.includes('java') && !lowerUrl.includes('javascript')) {
    return 'Java';
  }
  if (lowerUrl.includes('go') || lowerUrl.includes('golang')) {
    return 'Go';
  }
  
  return 'JavaScript/TypeScript';
}

// Fetch real metadata from GitHub API (public, no auth required for public repos)
async function fetchGitHubMetadata(owner: string, repo: string): Promise<RepoMetadata | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TwinMCP-Import'
      },
      signal: controller.signal,
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return {
      description: data.description || '',
      stars: data.stargazers_count || 0,
      language: data.language || '',
      defaultBranch: data.default_branch || 'main',
      topics: data.topics || []
    };
  } catch {
    return null; // Graceful fallback if API is unreachable
  }
}

// Fetch real metadata from GitLab API (public projects)
async function fetchGitLabMetadata(owner: string, repo: string): Promise<RepoMetadata | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const res = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}`, {
      headers: { 'User-Agent': 'TwinMCP-Import' },
      signal: controller.signal,
      next: { revalidate: 3600 }
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return {
      description: data.description || '',
      stars: data.star_count || 0,
      language: '',
      defaultBranch: data.default_branch || 'main',
      topics: data.topics || data.tag_list || []
    };
  } catch {
    return null;
  }
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

    // Validate URL format and protocol
    const trimmedUrl = url.trim();
    try {
      const parsedUrl = new URL(trimmedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { success: false, error: 'Seules les URLs HTTP et HTTPS sont acceptées' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Format d'URL invalide" },
        { status: 400 }
      );
    }

    // Sanitize name input
    const sanitizedName = name ? name.replace(/<[^>]*>/g, '').trim().slice(0, 100) : undefined;

    const validSources = ['github', 'gitlab', 'bitbucket', 'openapi', 'llms', 'website'];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { success: false, error: 'Source non valide' },
        { status: 400 }
      );
    }

    // Get user ID from auth header (optional)
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      userId = extractUserIdFromToken(authHeader.substring(7));
    }

    // Parse URL and extract info
    let libraryName = '';
    let libraryId = '';
    let vendor = '';
    let repoUrl = trimmedUrl;
    let docsUrl = '';
    let repoMetadata: RepoMetadata | null = null;

    switch (source) {
      case 'github': {
        const parsed = parseGitHubUrl(trimmedUrl);
        if (!parsed) {
          return NextResponse.json(
            { success: false, error: 'URL GitHub invalide. Format: https://github.com/owner/repo' },
            { status: 400 }
          );
        }
        // Fetch real repo metadata from GitHub API
        repoMetadata = await fetchGitHubMetadata(parsed.owner, parsed.repo);
        libraryName = sanitizedName || parsed.repo;
        libraryId = `github-${parsed.owner}-${parsed.repo}`.toLowerCase();
        vendor = parsed.owner;
        docsUrl = `https://github.com/${parsed.owner}/${parsed.repo}#readme`;
        break;
      }
      case 'gitlab': {
        const parsed = parseGitLabUrl(trimmedUrl);
        if (!parsed) {
          return NextResponse.json(
            { success: false, error: 'URL GitLab invalide. Format: https://gitlab.com/owner/repo' },
            { status: 400 }
          );
        }
        repoMetadata = await fetchGitLabMetadata(parsed.owner, parsed.repo);
        libraryName = sanitizedName || parsed.repo;
        libraryId = `gitlab-${parsed.owner}-${parsed.repo}`.toLowerCase();
        vendor = parsed.owner;
        docsUrl = `https://gitlab.com/${parsed.owner}/${parsed.repo}/-/blob/main/README.md`;
        break;
      }
      case 'bitbucket': {
        const parsed = parseBitbucketUrl(trimmedUrl);
        if (!parsed) {
          return NextResponse.json(
            { success: false, error: 'URL Bitbucket invalide. Format: https://bitbucket.org/owner/repo' },
            { status: 400 }
          );
        }
        libraryName = sanitizedName || parsed.repo;
        libraryId = `bitbucket-${parsed.owner}-${parsed.repo}`.toLowerCase();
        vendor = parsed.owner;
        docsUrl = `https://bitbucket.org/${parsed.owner}/${parsed.repo}/src/master/README.md`;
        break;
      }
      case 'openapi': {
        const filename = trimmedUrl.split('/').pop()?.replace('.json', '').replace('.yaml', '').replace('.yml', '') || 'openapi-spec';
        libraryName = sanitizedName || filename;
        libraryId = `openapi-${filename}-${Date.now()}`.toLowerCase();
        vendor = 'OpenAPI';
        docsUrl = trimmedUrl;
        break;
      }
      case 'llms': {
        const filename = trimmedUrl.split('/').pop()?.replace('.txt', '') || 'llms-doc';
        libraryName = sanitizedName || filename;
        libraryId = `llms-${filename}-${Date.now()}`.toLowerCase();
        vendor = 'LLMs.txt';
        docsUrl = trimmedUrl;
        break;
      }
      case 'website': {
        try {
          const urlObj = new URL(trimmedUrl);
          libraryName = sanitizedName || urlObj.hostname.replace('www.', '').replace('docs.', '');
          libraryId = `website-${urlObj.hostname.replace(/\./g, '-')}-${Date.now()}`.toLowerCase();
          vendor = urlObj.hostname;
          docsUrl = trimmedUrl;
        } catch {
          return NextResponse.json(
            { success: false, error: 'URL de site web invalide' },
            { status: 400 }
          );
        }
        break;
      }
    }

    // Use real metadata if available, otherwise estimate
    const repoDescription = repoMetadata?.description || `Documentation importée depuis ${source}`;
    const popularity = repoMetadata?.stars ? Math.min(100, Math.round(Math.log10(repoMetadata.stars + 1) * 25)) : 50;
    const language = repoMetadata?.language || determineLanguage(source, trimmedUrl);
    const ecosystem = determineEcosystem(source, trimmedUrl);
    const extraTags = repoMetadata?.topics || [];
    // Estimate tokens based on repo size heuristic (real indexing happens async)
    const tokensCount = repoMetadata?.stars 
      ? Math.min(500000, Math.max(50000, repoMetadata.stars * 50))
      : 100000;
    const snippetsCount = Math.round(tokensCount / 200);

    // Prepare library data for response (will be stored client-side if DB fails)
    const libraryData = {
      id: libraryId,
      name: libraryName,
      displayName: libraryName,
      vendor,
      source,
      ecosystem,
      language,
      description: repoDescription,
      repo: repoUrl,
      docs: docsUrl,
      versions: ['1.0.0'],
      defaultVersion: '1.0.0',
      popularity,
      tokens: tokensCount,
      snippets: snippetsCount,
      tags: [...new Set([source, ecosystem, language.toLowerCase(), ...extraTags])],
      lastCrawled: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isUserImported: true
    };

    // Try to save to database
    let savedToDb = false;
    try {
      // Get or create default client
      let client = await prisma.client.findFirst({ where: { name: 'default' } });
      if (!client) {
        client = await prisma.client.create({
          data: { name: 'default', apiKeys: {} }
        });
      }

      // Check if library already exists
      const existingLibrary = await prisma.library.findUnique({
        where: { id: libraryId }
      });

      if (existingLibrary) {
        // Update existing library
        await prisma.library.update({
          where: { id: libraryId },
          data: {
            displayName: libraryName,
            repoUrl,
            docsUrl,
            lastCrawledAt: new Date(),
            totalTokens: tokensCount,
            totalSnippets: snippetsCount,
            updatedAt: new Date()
          }
        });
        savedToDb = true;
      } else {
        // Create new library
        await prisma.library.create({
          data: {
            id: libraryId,
            name: libraryName.toLowerCase().replace(/\s+/g, '-'),
            displayName: libraryName,
            description: repoDescription,
            vendor,
            repoUrl,
            docsUrl,
            defaultVersion: '1.0.0',
            popularityScore: popularity,
            totalSnippets: snippetsCount,
            totalTokens: tokensCount,
            language,
            ecosystem,
            tags: [...new Set([source, ecosystem, language.toLowerCase(), ...extraTags])],
            metadata: {
              importSource: source,
              originalUrl: trimmedUrl,
              importedBy: userId,
              importedAt: new Date().toISOString()
            },
            clientId: client.id,
            lastCrawledAt: new Date()
          }
        });

        // Create default version
        await prisma.libraryVersion.create({
          data: {
            libraryId: libraryId,
            version: '1.0.0',
            isLatest: true,
            releaseDate: new Date()
          }
        });
        savedToDb = true;
      }
    } catch (dbError) {
      console.warn('Database not available, library will be stored client-side:', dbError);
    }

    // Return success with library data
    // The client will store this in localStorage if needed
    return NextResponse.json({
      success: true,
      message: savedToDb 
        ? 'Bibliothèque importée avec succès' 
        : 'Bibliothèque importée (stockage local)',
      savedToDb,
      data: {
        libraryId: libraryData.id,
        name: libraryData.name,
        source,
        status: 'completed',
        tokensCount: libraryData.tokens,
        snippetsCount: libraryData.snippets,
        createdAt: libraryData.createdAt,
        // Include full library data for client-side storage
        library: libraryData
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    sources: [
      { id: 'github', name: 'GitHub', available: true, description: 'Importer depuis un dépôt GitHub' },
      { id: 'gitlab', name: 'GitLab', available: true, description: 'Importer depuis GitLab' },
      { id: 'bitbucket', name: 'Bitbucket', available: true, description: 'Importer depuis Bitbucket' },
      { id: 'openapi', name: 'OpenAPI', available: true, description: 'Spécification OpenAPI/Swagger' },
      { id: 'llms', name: 'LLMs.txt', available: true, description: 'Fichier LLMs.txt' },
      { id: 'website', name: 'Site Web', available: true, description: 'Extraire depuis un site web' }
    ]
  });
}
