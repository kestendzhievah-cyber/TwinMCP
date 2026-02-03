import { NextRequest, NextResponse } from 'next/server';

// Library catalog data - in production, this would come from the database
const LIBRARY_CATALOG = [
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
    id: '/mongodb/docs',
    name: 'MongoDB',
    vendor: 'MongoDB',
    ecosystem: 'npm',
    language: 'JavaScript/TypeScript',
    description: 'The database for modern applications',
    repo: 'https://github.com/mongodb/node-mongodb-native',
    docs: 'https://www.mongodb.com/docs/',
    versions: ['8.0.0', '7.0.0', '6.0.18'],
    defaultVersion: '8.0.0',
    popularity: 95,
    tokens: 189000,
    snippets: 920,
    lastCrawled: '2026-01-02T15:30:00Z',
    tags: ['database', 'nosql', 'backend']
  },
  {
    id: '/supabase/supabase',
    name: 'Supabase',
    vendor: 'Supabase',
    ecosystem: 'npm',
    language: 'JavaScript/TypeScript',
    description: 'The open source Firebase alternative',
    repo: 'https://github.com/supabase/supabase-js',
    docs: 'https://supabase.com/docs',
    versions: ['2.45.6', '2.44.0', '2.43.0'],
    defaultVersion: '2.45.6',
    popularity: 92,
    tokens: 156000,
    snippets: 780,
    lastCrawled: '2026-01-03T08:15:00Z',
    tags: ['baas', 'database', 'auth', 'realtime']
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
    id: '/expressjs/express',
    name: 'Express.js',
    vendor: 'OpenJS Foundation',
    ecosystem: 'npm',
    language: 'JavaScript',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    repo: 'https://github.com/expressjs/express',
    docs: 'https://expressjs.com/',
    versions: ['5.0.1', '4.21.2', '4.20.0'],
    defaultVersion: '5.0.1',
    popularity: 97,
    tokens: 145000,
    snippets: 720,
    lastCrawled: '2026-01-02T18:00:00Z',
    tags: ['backend', 'api', 'rest', 'server']
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
    id: '/microsoft/typescript',
    name: 'TypeScript',
    vendor: 'Microsoft',
    ecosystem: 'npm',
    language: 'TypeScript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
    repo: 'https://github.com/microsoft/TypeScript',
    docs: 'https://www.typescriptlang.org/docs/',
    versions: ['5.7.3', '5.6.3', '5.5.4'],
    defaultVersion: '5.7.3',
    popularity: 99,
    tokens: 267000,
    snippets: 1450,
    lastCrawled: '2026-01-03T06:00:00Z',
    tags: ['language', 'types', 'compiler']
  },
  {
    id: '/django/django',
    name: 'Django',
    vendor: 'Django Software Foundation',
    ecosystem: 'pip',
    language: 'Python',
    description: 'The Web framework for perfectionists with deadlines',
    repo: 'https://github.com/django/django',
    docs: 'https://docs.djangoproject.com/',
    versions: ['5.1.5', '5.0.10', '4.2.18'],
    defaultVersion: '5.1.5',
    popularity: 94,
    tokens: 234000,
    snippets: 1320,
    lastCrawled: '2026-01-02T22:00:00Z',
    tags: ['python', 'web', 'backend', 'orm']
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

// GET - List all libraries with optional filtering
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search')?.toLowerCase();
  const ecosystem = searchParams.get('ecosystem');
  const language = searchParams.get('language');
  const tag = searchParams.get('tag');
  const sortBy = searchParams.get('sortBy') || 'popularity';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  let libraries = [...LIBRARY_CATALOG];
  
  // Apply filters
  if (search) {
    libraries = libraries.filter(lib => 
      lib.name.toLowerCase().includes(search) ||
      lib.description.toLowerCase().includes(search) ||
      lib.tags.some(t => t.includes(search))
    );
  }
  
  if (ecosystem) {
    libraries = libraries.filter(lib => lib.ecosystem === ecosystem);
  }
  
  if (language) {
    libraries = libraries.filter(lib => lib.language.toLowerCase().includes(language.toLowerCase()));
  }
  
  if (tag) {
    libraries = libraries.filter(lib => lib.tags.includes(tag));
  }
  
  // Sort
  switch (sortBy) {
    case 'name':
      libraries.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'tokens':
      libraries.sort((a, b) => b.tokens - a.tokens);
      break;
    case 'snippets':
      libraries.sort((a, b) => b.snippets - a.snippets);
      break;
    case 'updated':
      libraries.sort((a, b) => new Date(b.lastCrawled).getTime() - new Date(a.lastCrawled).getTime());
      break;
    case 'popularity':
    default:
      libraries.sort((a, b) => b.popularity - a.popularity);
  }
  
  // Paginate
  const total = libraries.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedLibraries = libraries.slice(start, end);
  
  return NextResponse.json({
    libraries: paginatedLibraries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    },
    filters: {
      ecosystems: ['npm', 'pip', 'cargo', 'composer'],
      languages: ['JavaScript/TypeScript', 'Python', 'Rust', 'PHP'],
      tags: [...new Set(LIBRARY_CATALOG.flatMap(lib => lib.tags))]
    },
    stats: {
      totalLibraries: LIBRARY_CATALOG.length,
      totalTokens: LIBRARY_CATALOG.reduce((sum, lib) => sum + lib.tokens, 0),
      totalSnippets: LIBRARY_CATALOG.reduce((sum, lib) => sum + lib.snippets, 0)
    }
  });
}
