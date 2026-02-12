import { AuthService as DbAuthService, ApiKeyData } from '@/lib/services/auth.service'
import { authService as legacyAuthService } from '@/lib/mcp/middleware/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export interface McpAuthContext {
  userId: string
  permissions: Array<{ resource: string; actions: string[] }>
  isAuthenticated: boolean
  authMethod: 'api_key' | 'jwt' | 'none'
  apiKeyId?: string
  tier?: string
  quotaDaily?: number
  quotaMonthly?: number
  rateLimit?: {
    requests: number
    period: string
    strategy: 'fixed' | 'sliding' | 'token-bucket'
  }
}

export const mcpDbAuthService = new DbAuthService(prisma, redis)

export async function authenticateMcpRequest(request: Request): Promise<McpAuthContext> {
  const apiKey = getApiKeyFromRequest(request)

  if (!apiKey) {
    const error = new Error('API key required') as Error & { statusCode?: number; code?: string }
    error.statusCode = 401
    error.code = 'MISSING_API_KEY'
    throw error
  }

  if (apiKey.startsWith('twinmcp_')) {
    const result = await mcpDbAuthService.validateApiKey(apiKey)
    if (!result.success || !result.apiKeyData) {
      const error = new Error(result.error || 'Authentication failed') as Error & { statusCode?: number; code?: string }
      error.statusCode = result.statusCode ?? 401
      error.code = result.errorCode ?? 'INVALID_API_KEY'
      throw error
    }

    return buildContextFromApiKey(result.apiKeyData)
  }

  const legacyContext = await legacyAuthService.authenticate(request)
  if (!legacyContext.isAuthenticated) {
    const error = new Error('Authentication required') as Error & { statusCode?: number; code?: string }
    error.statusCode = 401
    error.code = 'UNAUTHORIZED'
    throw error
  }

  return {
    userId: legacyContext.userId,
    permissions: legacyContext.permissions,
    isAuthenticated: true,
    authMethod: legacyContext.authMethod,
    rateLimit: legacyContext.rateLimit
  }
}

function buildContextFromApiKey(apiKeyData: ApiKeyData): McpAuthContext {
  const permissions = parsePermissions(apiKeyData.permissions)
  const rateLimit = {
    requests: apiKeyData.quotaRequestsPerMinute,
    period: '1m',
    strategy: 'sliding' as const
  }

  return {
    userId: apiKeyData.userId,
    permissions,
    isAuthenticated: true,
    authMethod: 'api_key',
    apiKeyId: apiKeyData.id,
    tier: apiKeyData.tier,
    quotaDaily: apiKeyData.quotaDaily,
    quotaMonthly: apiKeyData.quotaMonthly,
    rateLimit
  }
}

function parsePermissions(permissions: ApiKeyData['permissions']): Array<{ resource: string; actions: string[] }> {
  if (Array.isArray(permissions)) {
    return permissions as Array<{ resource: string; actions: string[] }>
  }

  if (typeof permissions === 'string') {
    try {
      const parsed = JSON.parse(permissions)
      if (Array.isArray(parsed)) {
        return parsed as Array<{ resource: string; actions: string[] }>
      }
    } catch {
      return []
    }
  }

  return []
}

function getApiKeyFromRequest(request: Request): string | null {
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) return apiKeyHeader

  const url = new URL(request.url)
  const apiKeyQuery = url.searchParams.get('api_key')
  if (apiKeyQuery) return apiKeyQuery

  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}
