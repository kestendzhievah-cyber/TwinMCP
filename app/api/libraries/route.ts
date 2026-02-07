import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Singleton Prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Default library catalog (fallback when database is unavailable)
const DEFAULT_LIBRARY_CATALOG = [
  {
    id: '/vercel/next.js',
    name: 'Next.js',
    vendor: 'Vercel',
    ecosystem: 'npm',
    language: 'JavaScript/TypeScript',
    description: 'The React Framework for the Web',
    repo: 'https://github.com/vercel/next.js',
    docs: 'https://nextjs.org/docs',
    versions: ['15.0.4', '14.2.20', '14.1.0', '13.5.7'],
    defaultVersion: '15.0.4',
    popularity: 98,
    tokens: 245000,
    snippets: 1250,
    lastCrawled: '2026-01-03T10:00:00Z',
    tags: ['react', 'ssr', 'framework', 'frontend']
  },
  {
    id: '/facebook/react',
    name: 'React',
    vendor: 'Meta',
    ecosystem: 'npm',
    language: 'JavaScript/TypeScript',
    description: 'A JavaScript library for building user interfaces',
    repo: 'https://github.com/facebook/react',
    docs: 'https://react.dev',
    versions: ['19.0.0', '18.3.1', '18.2.0', '17.0.2'],
    defaultVersion: '19.0.0',
    popularity: 100,
    tokens: 312000,
    snippets: 1800,
    lastCrawled: '2026-01-03T10:00:00Z',
    tags: ['ui', 'components', 'frontend', 'hooks']
  },
  {
    id: '/prisma/prisma',
    name: 'Prisma',
    vendor: 'Prisma',
    ecosystem: 'npm',
    language: 'JavaScript/TypeScript',
    description: 'Next-generation Node.js and TypeScript ORM',
    repo: 'https://github.com/prisma/prisma',
    docs: 'https://www.prisma.io/docs',
    versions: ['6.2.0', '5.22.0', '5.21.0'],
    defaultVersion: '6.2.0',
    popularity: 90,
    tokens: 178000,
    snippets: 850,
    lastCrawled: '2026-01-03T09:00:00Z',
    tags: ['orm', 'database', 'typescript']
  },
  {
    id: '/tailwindlabs/tailwindcss',
    name: 'Tailwind CSS',
    vendor: 'Tailwind Labs',
    ecosystem: 'npm',
    language: 'CSS',
    description: 'A utility-first CSS framework for rapidly building custom designs',
    repo: 'https://github.com/tailwindlabs/tailwindcss',
    docs: 'https://tailwindcss.com/docs',
    versions: ['4.0.0', '3.4.17', '3.3.6'],
    defaultVersion: '4.0.0',
    popularity: 96,
    tokens: 198000,
    snippets: 1100,
    lastCrawled: '2026-01-03T07:30:00Z',
    tags: ['css', 'styling', 'frontend', 'utility']
  },
  {
    id: '/fastapi/fastapi',
    name: 'FastAPI',
    vendor: 'Sebastián Ramírez',
    ecosystem: 'pip',
    language: 'Python',
    description: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production',
    repo: 'https://github.com/fastapi/fastapi',
    docs: 'https://fastapi.tiangolo.com/',
    versions: ['0.115.6', '0.114.0', '0.113.0'],
    defaultVersion: '0.115.6',
    popularity: 93,
    tokens: 167000,
    snippets: 890,
    lastCrawled: '2026-01-03T04:00:00Z',
    tags: ['python', 'api', 'async', 'openapi']
  }
];

// POST - Receive client-side libraries for merging
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientLibraries: any[] = body.clientLibraries || [];
    
    // Just acknowledge receipt - these are already stored client-side
    return NextResponse.json({
      success: true,
      received: clientLibraries.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}

// GET - List all libraries with optional filtering
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search')?.toLowerCase();
  const ecosystem = searchParams.get('ecosystem');
  const language = searchParams.get('language');
  const tag = searchParams.get('tag');
  const sortBy = searchParams.get('sortBy') || 'popularity';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const includeDefaults = searchParams.get('includeDefaults') !== 'false';
  
  // Client-side libraries passed as JSON in header (base64 encoded)
  let clientLibraries: any[] = [];
  const clientLibsHeader = searchParams.get('clientLibraries');
  if (clientLibsHeader) {
    try {
      clientLibraries = JSON.parse(decodeURIComponent(clientLibsHeader));
    } catch {
      // Ignore parse errors
    }
  }

  let allLibraries: any[] = [];
  let dbLibraries: any[] = [];

  // Try to fetch from database
  try {
    const whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (ecosystem && ecosystem !== 'all') {
      whereClause.ecosystem = ecosystem;
    }
    
    if (language) {
      whereClause.language = { contains: language, mode: 'insensitive' };
    }
    
    if (tag) {
      whereClause.tags = { has: tag };
    }

    const libraries = await prisma.library.findMany({
      where: whereClause,
      include: {
        versions: {
          where: { isLatest: true },
          take: 1
        }
      },
      orderBy: sortBy === 'name' 
        ? { name: 'asc' }
        : sortBy === 'tokens'
          ? { totalTokens: 'desc' }
          : sortBy === 'updated'
            ? { lastCrawledAt: 'desc' }
            : { popularityScore: 'desc' }
    });

    // Transform database libraries to match expected format
    dbLibraries = libraries.map(lib => ({
      id: lib.id,
      name: lib.displayName,
      vendor: lib.vendor || 'Unknown',
      ecosystem: lib.ecosystem,
      language: lib.language,
      description: lib.description || '',
      repo: lib.repoUrl || '',
      docs: lib.docsUrl || '',
      versions: lib.versions.map(v => v.version),
      defaultVersion: lib.defaultVersion || lib.versions[0]?.version || '1.0.0',
      popularity: Math.round(lib.popularityScore),
      tokens: lib.totalTokens,
      snippets: lib.totalSnippets,
      lastCrawled: lib.lastCrawledAt?.toISOString() || lib.createdAt.toISOString(),
      tags: lib.tags,
      isUserImported: true
    }));

  } catch (dbError) {
    console.warn('Database unavailable, using client libraries and defaults');
  }

  // Process client-side libraries
  const processedClientLibs = clientLibraries.map(lib => ({
    id: lib.id,
    name: lib.name || lib.displayName,
    vendor: lib.vendor || 'Unknown',
    ecosystem: lib.ecosystem || 'npm',
    language: lib.language || 'JavaScript/TypeScript',
    description: lib.description || '',
    repo: lib.repo || lib.repoUrl || '',
    docs: lib.docs || lib.docsUrl || '',
    versions: lib.versions || ['1.0.0'],
    defaultVersion: lib.defaultVersion || '1.0.0',
    popularity: lib.popularity || 50,
    tokens: lib.tokens || 0,
    snippets: lib.snippets || 0,
    lastCrawled: lib.lastCrawled || lib.createdAt || new Date().toISOString(),
    tags: lib.tags || [],
    isUserImported: true
  }));

  // Filter client libraries based on search params
  let filteredClientLibs = processedClientLibs;
  if (search) {
    filteredClientLibs = filteredClientLibs.filter(lib => 
      lib.name.toLowerCase().includes(search) ||
      lib.description.toLowerCase().includes(search)
    );
  }
  if (ecosystem && ecosystem !== 'all') {
    filteredClientLibs = filteredClientLibs.filter(lib => lib.ecosystem === ecosystem);
  }

  // Merge: client libraries first, then DB libraries, then defaults
  const existingIds = new Set<string>();
  
  // Add client libraries first
  for (const lib of filteredClientLibs) {
    if (!existingIds.has(lib.id)) {
      allLibraries.push(lib);
      existingIds.add(lib.id);
    }
  }
  
  // Add DB libraries
  for (const lib of dbLibraries) {
    if (!existingIds.has(lib.id)) {
      allLibraries.push(lib);
      existingIds.add(lib.id);
    }
  }

  // Combine with default catalog if enabled
  if (includeDefaults) {
    let filteredDefaults = [...DEFAULT_LIBRARY_CATALOG];
    
    if (search) {
      filteredDefaults = filteredDefaults.filter(lib => 
        lib.name.toLowerCase().includes(search) ||
        lib.description.toLowerCase().includes(search) ||
        lib.tags.some(t => t.includes(search))
      );
    }
    
    if (ecosystem && ecosystem !== 'all') {
      filteredDefaults = filteredDefaults.filter(lib => lib.ecosystem === ecosystem);
    }
    
    if (language) {
      filteredDefaults = filteredDefaults.filter(lib => 
        lib.language.toLowerCase().includes(language.toLowerCase())
      );
    }
    
    if (tag) {
      filteredDefaults = filteredDefaults.filter(lib => lib.tags.includes(tag));
    }

    // Add defaults that don't already exist
    for (const lib of filteredDefaults) {
      if (!existingIds.has(lib.id)) {
        allLibraries.push({ ...lib, isUserImported: false });
        existingIds.add(lib.id);
      }
    }
  }

  // Sort combined list
  switch (sortBy) {
    case 'name':
      allLibraries.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'tokens':
      allLibraries.sort((a, b) => b.tokens - a.tokens);
      break;
    case 'snippets':
      allLibraries.sort((a, b) => b.snippets - a.snippets);
      break;
    case 'updated':
      allLibraries.sort((a, b) => 
        new Date(b.lastCrawled).getTime() - new Date(a.lastCrawled).getTime()
      );
      break;
    case 'popularity':
    default:
      // User-imported libraries get a boost, then sort by popularity
      allLibraries.sort((a, b) => {
        if (a.isUserImported && !b.isUserImported) return -1;
        if (!a.isUserImported && b.isUserImported) return 1;
        return b.popularity - a.popularity;
      });
  }
  
  // Paginate
  const total = allLibraries.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedLibraries = allLibraries.slice(start, end);
  
  // Collect all unique tags and ecosystems
  const allTags = new Set<string>();
  const allEcosystems = new Set<string>();
  const allLanguages = new Set<string>();
  
  allLibraries.forEach(lib => {
    lib.tags.forEach((t: string) => allTags.add(t));
    allEcosystems.add(lib.ecosystem);
    allLanguages.add(lib.language);
  });

  const userImportedCount = allLibraries.filter(lib => lib.isUserImported).length;

  return NextResponse.json({
    libraries: paginatedLibraries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    },
    filters: {
      ecosystems: Array.from(allEcosystems),
      languages: Array.from(allLanguages),
      tags: Array.from(allTags)
    },
    stats: {
      totalLibraries: total,
      userImported: userImportedCount,
      defaultCatalog: total - userImportedCount,
      totalTokens: allLibraries.reduce((sum, lib) => sum + lib.tokens, 0),
      totalSnippets: allLibraries.reduce((sum, lib) => sum + lib.snippets, 0)
    }
  });
}
