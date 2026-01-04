import { ToolMetrics } from '../core/types'

interface MetricsConfig {
  retentionDays: number
  enablePersistence: boolean
  enableAnalytics: boolean
}

interface ToolStats {
  totalExecutions: number
  successRate: number
  avgExecutionTime: number
  errorCount: number
  lastUsed?: Date
}

interface SystemStats {
  totalExecutions: number
  activeUsers: number
  toolsUsed: number
  avgResponseTime: number
  errorRate: number
  cacheHitRate: number
}

export class MetricsCollector {
  private metrics: ToolMetrics[] = []
  private config: MetricsConfig
  private toolStats: Map<string, ToolStats> = new Map()
  private systemStats: SystemStats = {
    totalExecutions: 0,
    activeUsers: 0,
    toolsUsed: 0,
    avgResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0
  }

  constructor(config: MetricsConfig = {
    retentionDays: 30,
    enablePersistence: false,
    enableAnalytics: true
  }) {
    this.config = config

    // Nettoyage périodique
    setInterval(() => this.cleanup(), 3600000) // Chaque heure
  }

  async track(metric: ToolMetrics): Promise<void> {
    this.metrics.push(metric)
    this.updateToolStats(metric)
    this.updateSystemStats(metric)

    // Envoyer vers service d'analytics si activé
    if (this.config.enableAnalytics) {
      await this.sendToAnalytics(metric)
    }

    // Persister si activé
    if (this.config.enablePersistence) {
      await this.persistMetric(metric)
    }

    // Alerter en cas d'erreur
    if (!metric.success) {
      await this.alertOnError(metric)
    }
  }

  private updateToolStats(metric: ToolMetrics): void {
    const existing = this.toolStats.get(metric.toolId) || {
      totalExecutions: 0,
      successRate: 0,
      avgExecutionTime: 0,
      errorCount: 0
    }

    existing.totalExecutions++
    existing.lastUsed = metric.timestamp

    // Calcul du taux de succès
    const totalCalls = existing.totalExecutions
    const errors = existing.errorCount + (metric.success ? 0 : 1)
    existing.successRate = ((totalCalls - errors) / totalCalls) * 100
    existing.errorCount = errors

    // Calcul du temps d'exécution moyen
    existing.avgExecutionTime =
      (existing.avgExecutionTime * (totalCalls - 1) + metric.executionTime) / totalCalls

    this.toolStats.set(metric.toolId, existing)
  }

  private updateSystemStats(metric: ToolMetrics): void {
    this.systemStats.totalExecutions++

    // Utilisateurs actifs (approximation basée sur les dernières 24h)
    const last24h = this.metrics.filter(m =>
      m.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
    this.systemStats.activeUsers = new Set(last24h.map(m => m.userId)).size

    // Outils utilisés
    this.systemStats.toolsUsed = this.toolStats.size

    // Temps de réponse moyen
    const totalTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0)
    this.systemStats.avgResponseTime = totalTime / this.systemStats.totalExecutions

    // Taux d'erreur
    const errors = this.metrics.filter(m => !m.success).length
    this.systemStats.errorRate = (errors / this.systemStats.totalExecutions) * 100

    // Taux de cache hit
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    this.systemStats.cacheHitRate = cacheHits / this.systemStats.totalExecutions * 100
  }

  async getToolStats(toolId: string): Promise<ToolStats | null> {
    return this.toolStats.get(toolId) || null
  }

  async getSystemStats(): Promise<SystemStats> {
    return { ...this.systemStats }
  }

  async getTopTools(limit: number = 10): Promise<Array<{ toolId: string; stats: ToolStats }>> {
    return Array.from(this.toolStats.entries())
      .map(([toolId, stats]) => ({ toolId, stats }))
      .sort((a, b) => b.stats.totalExecutions - a.stats.totalExecutions)
      .slice(0, limit)
  }

  async getErrorAnalysis(): Promise<{
    byTool: Array<{ toolId: string; errors: number; errorRate: number }>
    byType: Array<{ errorType: string; count: number }>
    recent: ToolMetrics[]
  }> {
    const errorMetrics = this.metrics.filter(m => !m.success)

    // Erreurs par outil
    const byTool = Array.from(this.toolStats.entries())
      .map(([toolId, stats]) => ({
        toolId,
        errors: stats.errorCount,
        errorRate: 100 - stats.successRate
      }))
      .filter(item => item.errors > 0)
      .sort((a, b) => b.errors - a.errors)

    // Erreurs par type
    const byType = errorMetrics.reduce((acc, metric) => {
      const type = metric.errorType || 'Unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byTypeArray = Object.entries(byType)
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count)

    // Erreurs récentes
    const recent = errorMetrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50)

    return { byTool, byType: byTypeArray, recent }
  }

  async generateReport(period: 'day' | 'week' | 'month'): Promise<{
    period: string
    systemStats: SystemStats
    topTools: Array<{ toolId: string; stats: ToolStats }>
    errorAnalysis: any
    recommendations: string[]
  }> {
    const now = Date.now()
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    }[period]

    const periodMetrics = this.metrics.filter(m =>
      m.timestamp.getTime() > now - periodMs
    )

    // Statistiques du système pour la période
    const periodSystemStats = {
      totalExecutions: periodMetrics.length,
      activeUsers: new Set(periodMetrics.map(m => m.userId)).size,
      toolsUsed: new Set(periodMetrics.map(m => m.toolId)).size,
      avgResponseTime: periodMetrics.reduce((sum, m) => sum + m.executionTime, 0) / periodMetrics.length,
      errorRate: (periodMetrics.filter(m => !m.success).length / periodMetrics.length) * 100,
      cacheHitRate: (periodMetrics.filter(m => m.cacheHit).length / periodMetrics.length) * 100
    }

    // Top outils pour la période
    const toolUsage = periodMetrics.reduce((acc, metric) => {
      acc[metric.toolId] = (acc[metric.toolId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topTools = Object.entries(toolUsage)
      .map(([toolId, executions]) => ({
        toolId,
        executions,
        stats: this.toolStats.get(toolId) || {
          totalExecutions: 0,
          successRate: 0,
          avgExecutionTime: 0,
          errorCount: 0
        }
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10)

    // Analyse d'erreurs pour la période
    const errorAnalysis = await this.getErrorAnalysis()

    // Recommandations
    const recommendations: string[] = []

    if (periodSystemStats.errorRate > 5) {
      recommendations.push('High error rate detected. Consider reviewing error-prone tools.')
    }

    if (periodSystemStats.avgResponseTime > 2000) {
      recommendations.push('Response times are high. Consider optimizing slow tools or adding caching.')
    }

    if (periodSystemStats.cacheHitRate < 50) {
      recommendations.push('Low cache hit rate. Consider adjusting cache strategies.')
    }

    if (periodSystemStats.activeUsers < 10 && period === 'day') {
      recommendations.push('Low user activity. Consider user engagement strategies.')
    }

    return {
      period,
      systemStats: periodSystemStats,
      topTools,
      errorAnalysis,
      recommendations
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff)

    console.log(`🧹 Metrics cleanup: removed ${this.metrics.length} old entries`)
  }

  private async sendToAnalytics(metric: ToolMetrics): Promise<void> {
    // Implémentation pour envoyer vers un service d'analytics
    // Ex: Google Analytics, Mixpanel, etc.
    try {
      // await fetch('https://analytics.example.com/track', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metric)
      // })
    } catch (error) {
      console.error('Failed to send analytics:', error)
    }
  }

  private async persistMetric(metric: ToolMetrics): Promise<void> {
    // Implémentation pour persister dans une base de données
    try {
      // await db.collection('metrics').insertOne(metric)
    } catch (error) {
      console.error('Failed to persist metric:', error)
    }
  }

  private async alertOnError(metric: ToolMetrics): Promise<void> {
    // Alerter en cas d'erreur (email, Slack, etc.)
    if (metric.errorType === 'RateLimitExceeded' || metric.errorType === 'AuthenticationFailed') {
      console.error(`🚨 Critical error: ${metric.errorType} for tool ${metric.toolId}`)
    }
  }
}

// Instance globale
let globalMetrics: MetricsCollector | null = null

export function getMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector()
  }
  return globalMetrics
}

export async function initializeMetrics(): Promise<void> {
  const metrics = getMetrics()
  console.log('📊 Metrics collector initialized')
}
