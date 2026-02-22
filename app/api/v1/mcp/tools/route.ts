import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { registry } from '@/lib/mcp/tools'
import { authenticateMcpRequest } from '@/lib/mcp/middleware/api-key-auth'
import { validator } from '@/lib/mcp/core/validator'
import { rateLimiter } from '@/lib/mcp/middleware/rate-limit'
import { getMetrics } from '@/lib/mcp/utils/metrics'
import { ensureMCPInitialized } from '@/lib/mcp/ensure-init'

// GET /api/v1/mcp/tools - Liste des outils disponibles
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Ensure MCP system is initialized (lazy init)
    await ensureMCPInitialized()

    // Authentification
    const authContext = await authenticateMcpRequest(request)

    // Rate limiting
    const rateLimitCheck = await rateLimiter.checkUserLimit(authContext.userId, 'tools_list', authContext.rateLimit)
    if (!rateLimitCheck) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for tools list' },
        { status: 429 }
      )
    }

    // Obtenir les outils (filtrÃ©s selon les permissions)
    const tools = registry.getAll().filter(tool => {
      return authContext.permissions.some(permission => {
        if (permission.resource === 'global') {
          return permission.actions.includes('read')
        }
        if (permission.resource === tool.id) {
          return permission.actions.includes('read')
        }
        return false
      })
    })

    // Tracker les mÃ©triques
    getMetrics().track({
      toolId: 'tools_list',
      userId: authContext.userId,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      cacheHit: false,
      success: true,
      apiCallsCount: 1,
      estimatedCost: 0.0001
    })

    return NextResponse.json({
      tools: tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        version: tool.version,
        category: tool.category,
        description: tool.description,
        author: tool.author,
        tags: tool.tags,
        capabilities: tool.capabilities,
        rateLimit: tool.rateLimit,
        cache: tool.cache,
        inputSchema: tool.inputSchema instanceof Object ? {
          type: 'object',
          properties: {},
          required: []
        } : tool.inputSchema // SimplifiÃ© pour l'API
      })),
      totalCount: tools.length,
      apiVersion: 'v1',
      metadata: {
        executionTime: Date.now() - startTime,
        authenticated: authContext.isAuthenticated,
        authMethod: authContext.authMethod,
        plan: authContext.tier
      }
    })

  } catch (error: any) {
    getMetrics().track({
      toolId: 'tools_list',
      userId: 'anonymous',
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      cacheHit: false,
      success: false,
      errorType: error.name || 'ToolsListError',
      apiCallsCount: 1,
      estimatedCost: 0
    })

    logger.error('Tools list error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list tools', code: error.code },
      { status: error.statusCode || 500 }
    )
  }
}
