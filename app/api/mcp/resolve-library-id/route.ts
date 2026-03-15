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

let _libraryService: any = null;
let _servicesReady = false;
async function ensureServices() {
  if (_servicesReady) return;
  _servicesReady = true;
  try {
    const { prisma } = await import('@/lib/prisma');
    let redis: any = null;
    try { redis = (await import('@/lib/redis')).redis; } catch { /* ok */ }
    try {
      const { LibraryResolutionService } = await import('@/lib/services/library-resolution.service');
      _libraryService = new LibraryResolutionService(prisma, redis);
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
    const { query, context, limit, include_aliases } = body;

    // Validation basique
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          error: 'Query parameter is required and must be a string',
          code: 'INVALID_QUERY',
        },
        { status: 400 }
      );
    }

    // Exécuter la résolution
    await ensureServices();
    if (!_libraryService) {
      return NextResponse.json({
        success: true,
        data: {
          results: [],
          totalFound: 0,
          query,
          _note: 'LibraryResolutionService not available. Configure database for full library resolution.',
        },
      });
    }
    const result = await _libraryService.resolveLibrary({
      query,
      context,
      limit: limit || 5,
      include_aliases: include_aliases !== false,
    });

    // Logger l'usage
    await authService.logUsage(
      authResult.apiKeyData!.id,
      'resolve-library-id',
      undefined,
      query,
      undefined,
      Date.now() - startTime
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleApiError(error, 'McpResolveLibraryId');
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
