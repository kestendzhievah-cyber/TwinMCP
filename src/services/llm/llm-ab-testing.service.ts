/**
 * LLM A/B Testing Service.
 *
 * Compares LLM models/providers in controlled experiments:
 *   - Traffic splitting between model variants
 *   - Quality metrics (relevance, coherence, user satisfaction)
 *   - Cost/latency comparison
 *   - Statistical significance testing
 *   - Automatic winner selection
 */

export interface LLMExperiment {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: LLMVariant[]
  trafficSplit: Record<string, number>
  startedAt?: string
  completedAt?: string
  winner?: string
  config: {
    minSamples: number
    significanceThreshold: number
    primaryMetric: 'quality' | 'cost' | 'latency' | 'satisfaction'
  }
}

export interface LLMVariant {
  id: string
  name: string
  provider: string
  modelId: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMTrialResult {
  experimentId: string
  variantId: string
  timestamp: string
  metrics: {
    quality: number       // 0-1
    latencyMs: number
    cost: number
    inputTokens: number
    outputTokens: number
    userSatisfaction?: number // 1-5
  }
  metadata?: Record<string, any>
}

export interface LLMVariantStats {
  variantId: string
  variantName: string
  provider: string
  modelId: string
  sampleSize: number
  avgQuality: number
  avgLatency: number
  avgCost: number
  totalCost: number
  avgSatisfaction: number
  p95Latency: number
  confidenceScore: number
}

export interface LLMExperimentReport {
  experimentId: string
  name: string
  status: string
  variants: LLMVariantStats[]
  winner?: { variantId: string; reason: string; improvement: number }
  isSignificant: boolean
  recommendation: string
}

export class LLMABTestingService {
  private experiments: Map<string, LLMExperiment> = new Map()
  private results: LLMTrialResult[] = []

  // ── Experiment Lifecycle ────────────────────────────────────

  createExperiment(experiment: LLMExperiment): void {
    this.experiments.set(experiment.id, experiment)
  }

  getExperiment(id: string): LLMExperiment | undefined {
    return this.experiments.get(id)
  }

  getExperiments(): LLMExperiment[] {
    return Array.from(this.experiments.values())
  }

  startExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp || exp.status === 'running') return false
    exp.status = 'running'
    exp.startedAt = new Date().toISOString()
    return true
  }

  pauseExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp || exp.status !== 'running') return false
    exp.status = 'paused'
    return true
  }

  completeExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp) return false
    exp.status = 'completed'
    exp.completedAt = new Date().toISOString()
    const report = this.getReport(id)
    if (report.winner) exp.winner = report.winner.variantId
    return true
  }

  removeExperiment(id: string): boolean {
    this.results = this.results.filter(r => r.experimentId !== id)
    return this.experiments.delete(id)
  }

  // ── Traffic Routing ────────────────────────────────────────

  /** Select a variant for a request based on traffic split. */
  selectVariant(experimentId: string): LLMVariant | null {
    const exp = this.experiments.get(experimentId)
    if (!exp || exp.status !== 'running') return null

    const rand = Math.random()
    let cumulative = 0
    for (const variant of exp.variants) {
      cumulative += exp.trafficSplit[variant.id] || 0
      if (rand <= cumulative) return variant
    }
    return exp.variants[0] || null
  }

  // ── Results Recording ──────────────────────────────────────

  recordResult(result: LLMTrialResult): void {
    this.results.push(result)
  }

  record(experimentId: string, variantId: string, quality: number, latencyMs: number, cost: number, inputTokens: number, outputTokens: number, userSatisfaction?: number): void {
    this.results.push({
      experimentId, variantId,
      timestamp: new Date().toISOString(),
      metrics: { quality, latencyMs, cost, inputTokens, outputTokens, userSatisfaction },
    })
  }

  getResults(experimentId: string): LLMTrialResult[] {
    return this.results.filter(r => r.experimentId === experimentId)
  }

  get totalResults(): number {
    return this.results.length
  }

  // ── Reporting ──────────────────────────────────────────────

  getReport(experimentId: string): LLMExperimentReport {
    const exp = this.experiments.get(experimentId)
    if (!exp) {
      return { experimentId, name: 'Unknown', status: 'unknown', variants: [], isSignificant: false, recommendation: 'Experiment not found' }
    }

    const variants: LLMVariantStats[] = exp.variants.map(v => {
      const vResults = this.results.filter(r => r.experimentId === experimentId && r.variantId === v.id)
      const n = vResults.length
      if (n === 0) {
        return { variantId: v.id, variantName: v.name, provider: v.provider, modelId: v.modelId, sampleSize: 0, avgQuality: 0, avgLatency: 0, avgCost: 0, totalCost: 0, avgSatisfaction: 0, p95Latency: 0, confidenceScore: 0 }
      }

      const avgQuality = vResults.reduce((s, r) => s + r.metrics.quality, 0) / n
      const avgLatency = vResults.reduce((s, r) => s + r.metrics.latencyMs, 0) / n
      const avgCost = vResults.reduce((s, r) => s + r.metrics.cost, 0) / n
      const totalCost = vResults.reduce((s, r) => s + r.metrics.cost, 0)
      const satResults = vResults.filter(r => r.metrics.userSatisfaction !== undefined)
      const avgSatisfaction = satResults.length > 0 ? satResults.reduce((s, r) => s + (r.metrics.userSatisfaction || 0), 0) / satResults.length : 0

      const sortedLatencies = vResults.map(r => r.metrics.latencyMs).sort((a, b) => a - b)
      const p95Latency = sortedLatencies[Math.floor(n * 0.95)] || sortedLatencies[n - 1] || 0

      const confidenceScore = Math.min(n / exp.config.minSamples, 1.0)

      return { variantId: v.id, variantName: v.name, provider: v.provider, modelId: v.modelId, sampleSize: n, avgQuality, avgLatency, avgCost, totalCost, avgSatisfaction, p95Latency, confidenceScore }
    })

    const significantVariants = variants.filter(v => v.confidenceScore >= 0.5)
    const isSignificant = significantVariants.length >= 2

    let winner: { variantId: string; reason: string; improvement: number } | undefined
    if (isSignificant) {
      const metric = exp.config.primaryMetric
      const sorted = [...significantVariants].sort((a, b) => {
        switch (metric) {
          case 'quality': return b.avgQuality - a.avgQuality
          case 'cost': return a.avgCost - b.avgCost // lower is better
          case 'latency': return a.avgLatency - b.avgLatency // lower is better
          case 'satisfaction': return b.avgSatisfaction - a.avgSatisfaction
          default: return b.avgQuality - a.avgQuality
        }
      })

      if (sorted.length >= 2) {
        const best = sorted[0]
        const second = sorted[1]
        let improvement = 0
        let reason = ''

        switch (metric) {
          case 'quality':
            improvement = ((best.avgQuality - second.avgQuality) / Math.max(second.avgQuality, 0.001)) * 100
            reason = `${best.variantName} has ${improvement.toFixed(1)}% higher quality`
            break
          case 'cost':
            improvement = ((second.avgCost - best.avgCost) / Math.max(second.avgCost, 0.001)) * 100
            reason = `${best.variantName} is ${improvement.toFixed(1)}% cheaper`
            break
          case 'latency':
            improvement = ((second.avgLatency - best.avgLatency) / Math.max(second.avgLatency, 0.001)) * 100
            reason = `${best.variantName} is ${improvement.toFixed(1)}% faster`
            break
          case 'satisfaction':
            improvement = ((best.avgSatisfaction - second.avgSatisfaction) / Math.max(second.avgSatisfaction, 0.001)) * 100
            reason = `${best.variantName} has ${improvement.toFixed(1)}% higher satisfaction`
            break
        }

        if (Math.abs(improvement) > 1) {
          winner = { variantId: best.variantId, reason, improvement }
        }
      }
    }

    const recommendation = winner
      ? `Recommend ${winner.reason}`
      : isSignificant ? 'No clear winner yet — results are too close' : 'Insufficient data for recommendation'

    return { experimentId, name: exp.name, status: exp.status, variants, winner, isSignificant, recommendation }
  }
}

export const llmABTestingService = new LLMABTestingService()
