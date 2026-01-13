import { NextRequest, NextResponse } from 'next/server'
import { libraryResolutionService } from '@/lib/mcp-tools'
import { AuthService } from '@/lib/services/auth.service'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
const authService = new AuthService(prisma, redis)

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
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

    // Parser le corps de la requête
    const body = await request.json()
    const { query, context, limit, include_aliases } = body

    // Validation basique
    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        error: 'Query parameter is required and must be a string',
        code: 'INVALID_QUERY'
      }, { status: 400 })
    }

    // Exécuter la résolution
    const result = await libraryResolutionService.resolveLibrary({
      query,
      context,
      limit: limit || 5,
      include_aliases: include_aliases !== false
    })

    // Logger l'usage
    await authService.logUsage(
      authResult.apiKeyData!.id,
      'resolve-library-id',
      undefined,
      query,
      undefined,
      Date.now() - startTime
    )

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in resolve-library-id:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  }, { status: 405 })
}
