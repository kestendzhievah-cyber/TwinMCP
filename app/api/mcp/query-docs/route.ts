import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { vectorSearchService } from '@/lib/mcp-tools'

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

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const authService = await getAuthService();
    // Authentification via API Key
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'API key required',
        code: 'MISSING_API_KEY'
      }, { status: 401 })
    }

    const authResult = await authService.validateApiKey(apiKey)
    if (!authResult.success) {
      return NextResponse.json({
        error: authResult.error,
        code: 'INVALID_API_KEY'
      }, { status: 401 })
    }

    // Parser le corps de la requÃªte
    const body = await request.json()
    const { library_id, query, version, max_results, include_code, context_limit } = body

    // Validation basique
    if (!library_id || typeof library_id !== 'string') {
      return NextResponse.json({
        error: 'library_id parameter is required and must be a string',
        code: 'INVALID_LIBRARY_ID'
      }, { status: 400 })
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        error: 'query parameter is required and must be a string',
        code: 'INVALID_QUERY'
      }, { status: 400 })
    }

    // ExÃ©cuter la recherche de documentation
    const result = await vectorSearchService.searchDocuments({
      library_id,
      query,
      version,
      max_results: max_results || 5,
      include_code: include_code !== false,
      context_limit: context_limit || 4000
    })

    // Logger l'usage
    await authService.logUsage(
      authResult.apiKeyData!.id,
      'query-docs',
      library_id,
      query,
      result.totalTokens,
      Date.now() - startTime
    )

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Error in query-docs:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  }, { status: 405 })
}
