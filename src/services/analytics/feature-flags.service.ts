/**
 * Feature Flags & Experiment Framework Service.
 *
 * Manages feature flags and A/B testing experiments:
 *   - Feature flag CRUD with targeting rules
 *   - Percentage-based rollouts
 *   - User/segment targeting
 *   - Experiment lifecycle (draft → running → completed)
 *   - Variant assignment with deterministic hashing
 *   - Statistical significance calculation
 */

export interface FeatureFlag {
  id: string
  key: string
  name: string
  description?: string
  enabled: boolean
  rolloutPercentage: number
  targetSegments: string[]
  targetUserIds: string[]
  variants?: FlagVariant[]
  createdAt: string
  updatedAt: string
}

export interface FlagVariant {
  key: string
  name: string
  weight: number // 0-100
  payload?: Record<string, any>
}

export interface Experiment {
  id: string
  name: string
  description?: string
  flagKey: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: ExperimentVariant[]
  startedAt?: string
  completedAt?: string
  winnerVariant?: string
  createdAt: string
}

export interface ExperimentVariant {
  key: string
  name: string
  weight: number
  conversions: number
  impressions: number
  revenue: number
}

export interface ExperimentResult {
  experimentId: string
  variants: Array<{
    key: string
    name: string
    impressions: number
    conversions: number
    conversionRate: number
    revenue: number
    revenuePerUser: number
  }>
  winner: string | null
  isSignificant: boolean
  confidenceLevel: number
  sampleSize: number
}

export interface FlagEvaluation {
  flagKey: string
  enabled: boolean
  variant?: string
  reason: string
}

export class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map()
  private experiments: Map<string, Experiment> = new Map()
  private idCounter = 0

  // ── Feature Flags ──────────────────────────────────────────

  createFlag(key: string, name: string, options: { description?: string; rolloutPercentage?: number; targetSegments?: string[]; targetUserIds?: string[]; variants?: FlagVariant[] } = {}): FeatureFlag {
    const now = new Date().toISOString()
    const flag: FeatureFlag = {
      id: `flag-${++this.idCounter}`,
      key, name,
      description: options.description,
      enabled: false,
      rolloutPercentage: options.rolloutPercentage ?? 100,
      targetSegments: options.targetSegments || [],
      targetUserIds: options.targetUserIds || [],
      variants: options.variants,
      createdAt: now, updatedAt: now,
    }
    this.flags.set(key, flag)
    return flag
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key)
  }

  getFlags(): FeatureFlag[] {
    return Array.from(this.flags.values())
  }

  enableFlag(key: string): boolean {
    const flag = this.flags.get(key)
    if (!flag) return false
    flag.enabled = true
    flag.updatedAt = new Date().toISOString()
    return true
  }

  disableFlag(key: string): boolean {
    const flag = this.flags.get(key)
    if (!flag) return false
    flag.enabled = false
    flag.updatedAt = new Date().toISOString()
    return true
  }

  setRollout(key: string, percentage: number): boolean {
    const flag = this.flags.get(key)
    if (!flag) return false
    flag.rolloutPercentage = Math.max(0, Math.min(100, percentage))
    flag.updatedAt = new Date().toISOString()
    return true
  }

  removeFlag(key: string): boolean {
    return this.flags.delete(key)
  }

  get flagCount(): number { return this.flags.size }

  // ── Flag Evaluation ────────────────────────────────────────

  evaluate(flagKey: string, userId: string, userSegments: string[] = []): FlagEvaluation {
    const flag = this.flags.get(flagKey)
    if (!flag) return { flagKey, enabled: false, reason: 'Flag not found' }
    if (!flag.enabled) return { flagKey, enabled: false, reason: 'Flag disabled' }

    // Check user targeting
    if (flag.targetUserIds.length > 0 && flag.targetUserIds.includes(userId)) {
      const variant = this.assignVariant(flag, userId)
      return { flagKey, enabled: true, variant, reason: 'User targeted' }
    }

    // Check segment targeting
    if (flag.targetSegments.length > 0) {
      const match = flag.targetSegments.some(s => userSegments.includes(s))
      if (!match) return { flagKey, enabled: false, reason: 'Segment not targeted' }
    }

    // Percentage rollout
    const hash = this.hashUserId(userId, flagKey)
    if (hash > flag.rolloutPercentage) {
      return { flagKey, enabled: false, reason: 'Outside rollout percentage' }
    }

    const variant = this.assignVariant(flag, userId)
    return { flagKey, enabled: true, variant, reason: 'Rollout match' }
  }

  private assignVariant(flag: FeatureFlag, userId: string): string | undefined {
    if (!flag.variants || flag.variants.length === 0) return undefined
    const hash = this.hashUserId(userId, `${flag.key}:variant`)
    let cumulative = 0
    for (const v of flag.variants) {
      cumulative += v.weight
      if (hash <= cumulative) return v.key
    }
    return flag.variants[flag.variants.length - 1].key
  }

  private hashUserId(userId: string, salt: string): number {
    const str = `${userId}:${salt}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % 100
  }

  // ── Experiments ────────────────────────────────────────────

  createExperiment(name: string, flagKey: string, variants: Array<{ key: string; name: string; weight: number }>, description?: string): Experiment {
    const exp: Experiment = {
      id: `exp-${++this.idCounter}`,
      name, description, flagKey,
      status: 'draft',
      variants: variants.map(v => ({ ...v, conversions: 0, impressions: 0, revenue: 0 })),
      createdAt: new Date().toISOString(),
    }
    this.experiments.set(exp.id, exp)
    return exp
  }

  startExperiment(id: string): boolean {
    const exp = this.experiments.get(id)
    if (!exp || exp.status !== 'draft') return false
    exp.status = 'running'
    exp.startedAt = new Date().toISOString()
    // Enable the associated flag
    this.enableFlag(exp.flagKey)
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

    // Determine winner
    const result = this.getExperimentResult(id)
    if (result.winner) exp.winnerVariant = result.winner
    return true
  }

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id)
  }

  getExperiments(): Experiment[] {
    return Array.from(this.experiments.values())
  }

  removeExperiment(id: string): boolean {
    return this.experiments.delete(id)
  }

  // ── Experiment Tracking ────────────────────────────────────

  recordImpression(experimentId: string, variantKey: string): boolean {
    const exp = this.experiments.get(experimentId)
    if (!exp || exp.status !== 'running') return false
    const variant = exp.variants.find(v => v.key === variantKey)
    if (!variant) return false
    variant.impressions++
    return true
  }

  recordConversion(experimentId: string, variantKey: string, revenue: number = 0): boolean {
    const exp = this.experiments.get(experimentId)
    if (!exp || exp.status !== 'running') return false
    const variant = exp.variants.find(v => v.key === variantKey)
    if (!variant) return false
    variant.conversions++
    variant.revenue += revenue
    return true
  }

  // ── Results & Statistics ───────────────────────────────────

  getExperimentResult(experimentId: string): ExperimentResult {
    const exp = this.experiments.get(experimentId)
    if (!exp) return { experimentId, variants: [], winner: null, isSignificant: false, confidenceLevel: 0, sampleSize: 0 }

    const variantResults = exp.variants.map(v => ({
      key: v.key, name: v.name,
      impressions: v.impressions,
      conversions: v.conversions,
      conversionRate: v.impressions > 0 ? v.conversions / v.impressions : 0,
      revenue: v.revenue,
      revenuePerUser: v.impressions > 0 ? v.revenue / v.impressions : 0,
    }))

    const sampleSize = exp.variants.reduce((s, v) => s + v.impressions, 0)

    // Determine winner by conversion rate
    let winner: string | null = null
    let bestRate = 0
    for (const v of variantResults) {
      if (v.conversionRate > bestRate) {
        bestRate = v.conversionRate
        winner = v.key
      }
    }

    // Simple significance check (minimum sample size + meaningful difference)
    const minSample = 100
    const allAboveMin = exp.variants.every(v => v.impressions >= minSample)
    const rates = variantResults.map(v => v.conversionRate)
    const maxDiff = rates.length >= 2 ? Math.max(...rates) - Math.min(...rates) : 0
    const isSignificant = allAboveMin && maxDiff > 0.02 && sampleSize >= minSample * exp.variants.length
    const confidenceLevel = isSignificant ? Math.min(0.95, 0.5 + maxDiff * 5) : 0

    return { experimentId, variants: variantResults, winner, isSignificant, confidenceLevel, sampleSize }
  }
}

export const featureFlagsService = new FeatureFlagsService()
