import { NextRequest, NextResponse } from 'next/server'
import { registry } from '@/lib/mcp/tools'
import { authService } from '@/lib/mcp/middleware/auth'
import { validator } from '@/lib/mcp/core/validator'
import { rateLimiter } from '@/lib/mcp/middleware/rate-limit'
import { getQueue } from '@/lib/mcp/utils/queue'
import { getMetrics } from '@/lib/mcp/utils/metrics'

// POST /api/v1/mcp/execute - Exécuter un outil
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentification
    const authContext = await authService.authenticate(request)
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse du body
    const body = await request.json()
    const { toolId, args, async: isAsync = false } = body

    // Validation des paramètres de base
    if (!toolId) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      )
    }

    // Obtenir l'outil
    const tool = registry.get(toolId)
    if (!tool) {
      return NextResponse.json(
        { error: `Tool '${toolId}' not found` },
        { status: 404 }
      )
    }

    // Autorisation
    const authorized = await authService.authorize(authContext, toolId, 'execute')
    if (!authorized) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Validation des arguments
    const validation = await validator.validate(toolId, args)
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 })
    }

    // Validation de sécurité
    const securityValidation = await validator.securityValidate(args)
    if (!securityValidation.success) {
      return NextResponse.json({
        error: 'Security validation failed',
        details: securityValidation.errors
      }, { status: 400 })
    }

    // Rate limiting
    const rateLimitCheck = await rateLimiter.checkUserLimit(authContext.userId, toolId)
    if (!rateLimitCheck) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Exécution synchrone vs asynchrone
    if (isAsync && tool.capabilities.async) {
      // Mode asynchrone - ajouter à la queue
      const queue = getQueue()
      const jobId = await queue.enqueue({
        toolId,
        args: validation.data,
        userId: authContext.userId,
        priority: 'normal',
        maxRetries: 3
      })

      getMetrics().track({
        toolId,
        userId: authContext.userId,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: 0
      })

      return NextResponse.json({
        jobId,
        status: 'queued',
        message: 'Tool execution queued for async processing',
        apiVersion: 'v1',
        metadata: {
          executionTime: Date.now() - startTime,
          queueTime: 0
        }
      })

    } else {
      // Mode synchrone
      const result = await tool.execute(validation.data, {
        userId: authContext.userId,
        permissions: authContext.permissions,
        rateLimit: authContext.rateLimit
      })

      // Tracker les métriques
      getMetrics().track({
        toolId,
        userId: authContext.userId,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: result.metadata?.cacheHit || false,
        success: result.success,
        errorType: result.success ? undefined : 'ExecutionError',
        apiCallsCount: result.metadata?.apiCallsCount || 1,
        estimatedCost: result.metadata?.cost || 0
      })

      if (result.success) {
        return NextResponse.json({
          result: result.data,
          success: true,
          apiVersion: 'v1',
          metadata: {
            executionTime: result.metadata?.executionTime || (Date.now() - startTime),
            cacheHit: result.metadata?.cacheHit || false,
            apiCallsCount: result.metadata?.apiCallsCount || 1,
            cost: result.metadata?.cost || 0,
            authenticated: authContext.isAuthenticated,
            authMethod: authContext.authMethod
          }
        })
      } else {
        return NextResponse.json({
          error: result.error,
          success: false,
          apiVersion: 'v1',
          metadata: {
            executionTime: result.metadata?.executionTime || (Date.now() - startTime),
            authenticated: authContext.isAuthenticated,
            authMethod: authContext.authMethod
          }
        }, { status: 500 })
      }
    }

  } catch (error: any) {
    const executionTime = Date.now() - startTime

    getMetrics().track({
      toolId: 'unknown',
      userId: 'anonymous',
      timestamp: new Date(),
      executionTime,
      cacheHit: false,
      success: false,
      errorType: error.name || 'APIError',
      apiCallsCount: 1,
      estimatedCost: 0
    })

    console.error('Tool execution error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Tool execution failed',
        apiVersion: 'v1'
      },
      { status: error.statusCode || 500 }
    )
  }
}
