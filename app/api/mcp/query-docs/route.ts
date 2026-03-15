import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';

let _authService: any = null;
async function getAuthService() {
  if (!_authService) {
    const { prisma } = await import('@/lib/prisma');
    const { redis } = await import('@/lib/redis');
    const { AuthService } = await import('@/lib/services/auth.service');
    _authService = new AuthService(prisma, redis);
  }
  return _authService;
}

let _vectorService: any = null;
let _servicesReady = false;
async function ensureServices() {
  if (_servicesReady) return;
  _servicesReady = true;
  try {
    const { prisma } = await import('@/lib/prisma');
    let redis: any = null;
    try { redis = (await import('@/lib/redis')).redis; } catch { /* ok */ }
    try {
      const { VectorSearchService } = await import('@/lib/services/vector-search.service');
      _vectorService = new VectorSearchService(prisma, redis);
    } catch { /* ok */ }
  } catch {
    _servicesReady = false;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authService = await getAuthService();
    // Authentification via API Key
    const apiKey =
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'API key required',
          code: 'MISSING_API_KEY',
        },
        { status: 401 }
      );
    }

    const authResult = await authService.validateApiKey(apiKey);
    if (!authResult.success) {
      return NextResponse.json(
        {
          error: authResult.error,
          code: 'INVALID_API_KEY',
        },
        { status: 401 }
      );
    }

    // Parser le corps de la requête
    const body = await request.json();
    const { library_id, query, version, max_results, include_code, context_limit } = body;

    // Validation basique
    if (!library_id || typeof library_id !== 'string') {
      return NextResponse.json(
        {
          error: 'library_id parameter is required and must be a string',
          code: 'INVALID_LIBRARY_ID',
        },
        { status: 400 }
      );
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          error: 'query parameter is required and must be a string',
          code: 'INVALID_QUERY',
        },
        { status: 400 }
      );
    }

    // Exécuter la recherche de documentation
    await ensureServices();
    if (!_vectorService) {
      return NextResponse.json({
        success: true,
        data: {
          libraryId: library_id,
          query,
          results: [],
          totalResults: 0,
          totalTokens: 0,
          _note: 'VectorSearchService not available. Configure database and vector store for full documentation search.',
        },
      });
    }
    const result = await _vectorService.searchDocuments({
      library_id,
      query,
      version,
      max_results: max_results || 5,
      include_code: include_code !== false,
      context_limit: context_limit || 4000,
    });

    // Logger l'usage
    await authService.logUsage(
      authResult.apiKeyData!.id,
      'query-docs',
      library_id,
      query,
      result.totalTokens,
      Date.now() - startTime
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleApiError(error, 'McpQueryDocs');
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    },
    { status: 405 }
  );
}
