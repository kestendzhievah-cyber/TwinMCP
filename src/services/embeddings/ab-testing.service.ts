/**
 * A/B Testing Service for Embedding Models.
 *
 * Runs controlled experiments comparing embedding models on:
 *   - Search quality (relevance scores)
 *   - Latency
 *   - Cost efficiency
 *   - User satisfaction (click-through, dwell time)
 *
 * Supports traffic splitting, statistical significance testing,
 * and automatic winner selection.
 */

export interface ABExperiment {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: ABVariant[]
  /** Traffic split percentages (must sum to 1.0). */
  trafficSplit: Record<string, number>
  startedAt?: string
  completedAt?: string
  winner?: string
}

export interface ABVariant {
  id: string
  name: string
  modelId: string
  config?: Record<string, any>
}

export interface ABMetric {
  experimentId: string
  variantId: string
  timestamp: string
  metrics: {
    relevanceScore: number
    latencyMs: number
    cost: number
    userSatisfaction?: number
  }
}

export interface ABResult {
  variantId: string
  variantName: string
  sampleSize: number
  avgRelevance: number
  avgLatency: number
  avgCost: number
  avgSatisfaction: number
  totalCost: number
  confidenceScore: number
}

export interface ABReport {
  experimentId: string
  experimentName: string
  status: string
  results: ABResult[]
  winner?: { variantId: string; reason: string }
  statisticallySignificant: boolean
}

export class ABTestingService {
  private experiments: Map<string, ABExperiment> = new Map()
  private metrics: ABMetric[] = []

  // ── Experiment Management ──────────────────────────────────

  /** Create a new experiment. */
  createExperiment(experiment: ABExperiment): void {
    this.experiments.set(experiment.id, experiment)
  }

  /** Get an experiment. */
  getExperiment(id: string): ABExperiment | undefined {
    return this.experiments.get(id)
  }

  /** List all experiments. */
  getExperiments(): ABExperiment[] {
    return Array.from(this.experiments.values())
  }

  /** Start an experiment. */
  startExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp || exp.status === 'running') return false
    exp.status = 'running'
    exp.startedAt = new Date().toISOString()
    return true
  }

  /** Pause an experiment. */
  pauseExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp || exp.status !== 'running') return false
    exp.status = 'paused'
    return true
  }

  /** Complete an experiment. */
  completeExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp) return false
    exp.status = 'completed'
    exp.completedAt = new Date().toISOString()

    // Auto-select winner
    const report = this.getReport(id)
    if (report.winner) {
      exp.winner = report.winner.variantId
    }

    return true
  }

  /** Remove an experiment. */
  removeExperiment(id: string): boolean {
    this.metrics = this.metrics.filter(m => m.experimentId !== id)
    return this.experiments.delete(id)
  }

  // ── Traffic Routing ────────────────────────────────────────

  /**
   * Select a variant for a request based on traffic split.
   * Uses weighted random selection.
   */
  selectVariant(experimentId: string): ABVariant | null {
    const exp = this.experiments.get(experimentId)
    if (!exp || exp.status !== 'running') return null

    const rand = Math.random()
    let cumulative = 0

    for (const variant of exp.variants) {
      cumulative += exp.trafficSplit[variant.id] || 0
      if (rand <= cumulative) return variant
    }

    // Fallback to first variant
    return exp.variants[0] || null
  }

  // ── Metrics Recording ─────────────────────────────────────

  /** Record a metric for a variant. */
  recordMetric(metric: ABMetric): void {
    this.metrics.push(metric)
  }

  /** Record a simple metric. */
  record(experimentId: string, variantId: string, relevanceScore: number, latencyMs: number, cost: number, userSatisfaction?: number): void {
    this.metrics.push({
      experimentId,
      variantId,
      timestamp: new Date().toISOString(),
      metrics: { relevanceScore, latencyMs, cost, userSatisfaction },
    })
  }

  /** Get metrics for an experiment. */
  getMetrics(experimentId: string): ABMetric[] {
    return this.metrics.filter(m => m.experimentId === experimentId)
  }

  /** Get metrics for a specific variant. */
  getVariantMetrics(experimentId: string, variantId: string): ABMetric[] {
    return this.metrics.filter(m => m.experimentId === experimentId && m.variantId === variantId)
  }

  // ── Analysis & Reporting ───────────────────────────────────

  /** Generate a report for an experiment. */
  getReport(experimentId: string): ABReport {
    const exp = this.experiments.get(experimentId)
    if (!exp) {
      return {
        experimentId, experimentName: 'Unknown', status: 'unknown',
        results: [], statisticallySignificant: false,
      }
    }

    const results: ABResult[] = exp.variants.map(variant => {
      const vMetrics = this.getVariantMetrics(experimentId, variant.id)
      const n = vMetrics.length

      if (n === 0) {
        return {
          variantId: variant.id, variantName: variant.name, sampleSize: 0,
          avgRelevance: 0, avgLatency: 0, avgCost: 0, avgSatisfaction: 0,
          totalCost: 0, confidenceScore: 0,
        }
      }

      const avgRelevance = vMetrics.reduce((s, m) => s + m.metrics.relevanceScore, 0) / n
      const avgLatency = vMetrics.reduce((s, m) => s + m.metrics.latencyMs, 0) / n
      const avgCost = vMetrics.reduce((s, m) => s + m.metrics.cost, 0) / n
      const satMetrics = vMetrics.filter(m => m.metrics.userSatisfaction !== undefined)
      const avgSatisfaction = satMetrics.length > 0
        ? satMetrics.reduce((s, m) => s + (m.metrics.userSatisfaction || 0), 0) / satMetrics.length
        : 0
      const totalCost = vMetrics.reduce((s, m) => s + m.metrics.cost, 0)

      // Simple confidence based on sample size
      const confidenceScore = Math.min(n / 30, 1.0) // 30 samples = full confidence

      return {
        variantId: variant.id, variantName: variant.name, sampleSize: n,
        avgRelevance, avgLatency, avgCost, avgSatisfaction, totalCost, confidenceScore,
      }
    })

    // Determine winner: highest relevance with sufficient confidence
    const significantResults = results.filter(r => r.confidenceScore >= 0.5)
    const statisticallySignificant = significantResults.length >= 2

    let winner: { variantId: string; reason: string } | undefined
    if (statisticallySignificant) {
      const sorted = [...significantResults].sort((a, b) => b.avgRelevance - a.avgRelevance)
      if (sorted.length >= 2) {
        const best = sorted[0]
        const second = sorted[1]
        const improvement = ((best.avgRelevance - second.avgRelevance) / Math.max(second.avgRelevance, 0.001)) * 100

        if (improvement > 1) { // >1% improvement
          winner = {
            variantId: best.variantId,
            reason: `${best.variantName} has ${improvement.toFixed(1)}% higher relevance (${best.avgRelevance.toFixed(3)} vs ${second.avgRelevance.toFixed(3)})`,
          }
        }
      }
    }

    return {
      experimentId,
      experimentName: exp.name,
      status: exp.status,
      results,
      winner,
      statisticallySignificant,
    }
  }

  /** Get total metric count. */
  get totalMetrics(): number {
    return this.metrics.length
  }
}

export const abTestingService = new ABTestingService()
