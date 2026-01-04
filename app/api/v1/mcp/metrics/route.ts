import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/mcp/middleware/auth'
import { getMetrics } from '@/lib/mcp/utils/metrics'
import { getQueue } from '@/lib/mcp/utils/queue'

// GET /api/v1/mcp/metrics - Métriques système et outils
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentification (seulement pour les utilisateurs authentifiés)
    const authContext = await authService.authenticate(request)
    if (!authContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required for metrics access' },
        { status: 401 }
      )
    }

    // Autorisation (seulement pour les admins)
    const isAdmin = authContext.permissions.some(p =>
      p.resource === 'global' && p.actions.includes('admin')
    )

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin permissions required' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') as 'day' | 'week' | 'month' || 'day'
    const toolId = url.searchParams.get('toolId')

    let metrics

    if (toolId) {
      // Métriques pour un outil spécifique
      const toolStats = await getMetrics().getToolStats(toolId)
      const systemStats = await getMetrics().getSystemStats()

      metrics = {
        toolId,
        toolStats,
        systemStats,
        period,
        apiVersion: 'v1',
        metadata: {
          executionTime: Date.now() - startTime,
          generatedAt: new Date().toISOString()
        }
      }
    } else {
      // Métriques système globales
      const systemStats = await getMetrics().getSystemStats()
      const topTools = await getMetrics().getTopTools(10)
      const errorAnalysis = await getMetrics().getErrorAnalysis()
      const report = await getMetrics().generateReport(period)

      metrics = {
        systemStats,
        topTools,
        errorAnalysis,
        report,
        apiVersion: 'v1',
        metadata: {
          executionTime: Date.now() - startTime,
          generatedAt: new Date().toISOString(),
          period
        }
      }
    }

    return NextResponse.json(metrics)

  } catch (error: any) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to retrieve metrics',
        apiVersion: 'v1'
      },
      { status: error.statusCode || 500 }
    )
  }
}
