/**
 * GET /api/monitoring/costs — Embedding cost dashboard API.
 * Returns cost summaries, model usage, budgets, and projections.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { costMonitorService } = await import('@/src/services/embeddings/cost-monitor.service')

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    return NextResponse.json({
      status: 'ok',
      timestamp: now.toISOString(),
      daily: costMonitorService.getSummary(dayAgo, now),
      weekly: costMonitorService.getSummary(weekAgo, now),
      monthly: costMonitorService.getSummary(monthAgo, now),
      budgets: costMonitorService.getBudgets().map(b => ({
        ...b,
        currentSpend: costMonitorService.getBudgetSpend(b.id),
        utilizationPercent: b.limitAmount > 0 ? (costMonitorService.getBudgetSpend(b.id) / b.limitAmount) * 100 : 0,
      })),
      alerts: costMonitorService.getAlerts().slice(-20),
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
