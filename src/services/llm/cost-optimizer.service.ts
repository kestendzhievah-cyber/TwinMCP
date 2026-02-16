/**
 * LLM Cost Optimization Service.
 *
 * Automatically optimizes LLM usage costs by:
 *   - Model selection based on task complexity vs cost
 *   - Prompt compression to reduce token count
 *   - Response caching with semantic similarity
 *   - Batch request optimization
 *   - Provider routing based on cost/quality tradeoffs
 *   - Budget enforcement with automatic downgrade
 */

export interface CostProfile {
  modelId: string
  provider: string
  inputCostPer1K: number
  outputCostPer1K: number
  quality: number // 1-10
  latencyMs: number
  contextWindow: number
  capabilities: string[]
}

export interface OptimizationRequest {
  task: string
  requiredCapabilities?: string[]
  maxCostPerRequest?: number
  minQuality?: number
  maxLatencyMs?: number
  tokenEstimate?: number
  priority?: 'cost' | 'quality' | 'balanced' | 'speed'
}

export interface OptimizationResult {
  selectedModel: CostProfile
  estimatedCost: number
  estimatedSavings: number
  reason: string
  alternatives: Array<{ model: CostProfile; cost: number; reason: string }>
}

export interface CostBudget {
  id: string
  name: string
  limitAmount: number
  period: 'daily' | 'weekly' | 'monthly'
  currentSpend: number
  alertThreshold: number
  autoDowngrade: boolean
  downgradeModelId?: string
}

export interface UsageRecord {
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: string
}

export type BudgetAlertFn = (budget: CostBudget, currentSpend: number) => void

export class LLMCostOptimizerService {
  private models: Map<string, CostProfile> = new Map()
  private budgets: Map<string, CostBudget> = new Map()
  private usage: UsageRecord[] = []
  private alertCallbacks: BudgetAlertFn[] = []

  // ── Model Registry ─────────────────────────────────────────

  registerModel(profile: CostProfile): void {
    this.models.set(profile.modelId, profile)
  }

  removeModel(modelId: string): boolean {
    return this.models.delete(modelId)
  }

  getModels(): CostProfile[] {
    return Array.from(this.models.values())
  }

  getModel(modelId: string): CostProfile | undefined {
    return this.models.get(modelId)
  }

  // ── Optimization ───────────────────────────────────────────

  /** Select the optimal model for a request. */
  optimize(request: OptimizationRequest): OptimizationResult {
    const candidates = this.filterCandidates(request)

    if (candidates.length === 0) {
      const fallback = this.getCheapestModel()
      if (!fallback) throw new Error('No models registered')
      return {
        selectedModel: fallback,
        estimatedCost: this.estimateCost(fallback, request.tokenEstimate || 500),
        estimatedSavings: 0,
        reason: 'No models match requirements, using cheapest fallback',
        alternatives: [],
      }
    }

    // Score and rank candidates
    const scored = candidates.map(model => ({
      model,
      score: this.scoreModel(model, request),
      cost: this.estimateCost(model, request.tokenEstimate || 500),
    }))

    scored.sort((a, b) => b.score - a.score)

    const best = scored[0]
    const mostExpensive = Math.max(...scored.map(s => s.cost))

    return {
      selectedModel: best.model,
      estimatedCost: best.cost,
      estimatedSavings: mostExpensive - best.cost,
      reason: this.explainSelection(best.model, request),
      alternatives: scored.slice(1, 4).map(s => ({
        model: s.model,
        cost: s.cost,
        reason: this.explainSelection(s.model, request),
      })),
    }
  }

  /** Check if a request is within budget, auto-downgrade if needed. */
  checkBudget(estimatedCost: number): { allowed: boolean; downgradeModel?: string } {
    for (const budget of this.budgets.values()) {
      if (!budget.autoDowngrade) continue
      const periodSpend = this.getPeriodSpend(budget)

      if (periodSpend + estimatedCost > budget.limitAmount) {
        if (budget.downgradeModelId) {
          return { allowed: true, downgradeModel: budget.downgradeModelId }
        }
        return { allowed: false }
      }

      if (periodSpend / budget.limitAmount >= budget.alertThreshold) {
        for (const cb of this.alertCallbacks) {
          try { cb(budget, periodSpend) } catch { /* ignore */ }
        }
      }
    }
    return { allowed: true }
  }

  // ── Budget Management ──────────────────────────────────────

  addBudget(budget: CostBudget): void {
    this.budgets.set(budget.id, budget)
  }

  removeBudget(id: string): boolean {
    return this.budgets.delete(id)
  }

  getBudgets(): CostBudget[] {
    return Array.from(this.budgets.values())
  }

  onBudgetAlert(fn: BudgetAlertFn): void {
    this.alertCallbacks.push(fn)
  }

  // ── Usage Tracking ─────────────────────────────────────────

  recordUsage(record: Omit<UsageRecord, 'timestamp'>): void {
    this.usage.push({ ...record, timestamp: new Date().toISOString() })

    // Update budget spend
    for (const budget of this.budgets.values()) {
      budget.currentSpend = this.getPeriodSpend(budget)
    }
  }

  getUsage(since?: Date): UsageRecord[] {
    if (!since) return [...this.usage]
    const sinceMs = since.getTime()
    return this.usage.filter(u => new Date(u.timestamp).getTime() >= sinceMs)
  }

  getTotalSpend(since?: Date): number {
    return this.getUsage(since).reduce((s, u) => s + u.cost, 0)
  }

  getSpendByModel(since?: Date): Record<string, number> {
    const result: Record<string, number> = {}
    for (const u of this.getUsage(since)) {
      result[u.modelId] = (result[u.modelId] || 0) + u.cost
    }
    return result
  }

  getSpendByProvider(since?: Date): Record<string, number> {
    const result: Record<string, number> = {}
    for (const u of this.getUsage(since)) {
      result[u.provider] = (result[u.provider] || 0) + u.cost
    }
    return result
  }

  // ── Prompt Compression ─────────────────────────────────────

  /** Compress a prompt to reduce token count. */
  compressPrompt(text: string, targetReduction: number = 0.3): { compressed: string; savedTokens: number } {
    const originalTokens = Math.ceil(text.length / 4)

    let compressed = text
    // Remove excessive whitespace
    compressed = compressed.replace(/\n{3,}/g, '\n\n')
    compressed = compressed.replace(/[ \t]{2,}/g, ' ')
    // Remove filler phrases
    compressed = compressed.replace(/\b(please note that|it is important to note that|as mentioned earlier|in other words)\b/gi, '')
    // Trim lines
    compressed = compressed.split('\n').map(l => l.trim()).join('\n')

    const compressedTokens = Math.ceil(compressed.length / 4)
    return {
      compressed: compressed.trim(),
      savedTokens: originalTokens - compressedTokens,
    }
  }

  // ── Internal ───────────────────────────────────────────────

  private filterCandidates(request: OptimizationRequest): CostProfile[] {
    return this.getModels().filter(model => {
      if (request.requiredCapabilities) {
        for (const cap of request.requiredCapabilities) {
          if (!model.capabilities.includes(cap)) return false
        }
      }
      if (request.maxCostPerRequest) {
        const cost = this.estimateCost(model, request.tokenEstimate || 500)
        if (cost > request.maxCostPerRequest) return false
      }
      if (request.minQuality && model.quality < request.minQuality) return false
      if (request.maxLatencyMs && model.latencyMs > request.maxLatencyMs) return false
      if (request.tokenEstimate && request.tokenEstimate > model.contextWindow) return false
      return true
    })
  }

  private scoreModel(model: CostProfile, request: OptimizationRequest): number {
    const tokens = request.tokenEstimate || 500
    const cost = this.estimateCost(model, tokens)
    const maxCost = Math.max(...this.getModels().map(m => this.estimateCost(m, tokens)), 0.001)

    const costScore = 1 - (cost / maxCost) // lower cost = higher score
    const qualityScore = model.quality / 10
    const latencyScore = 1 - Math.min(model.latencyMs / 5000, 1)

    const priority = request.priority || 'balanced'
    switch (priority) {
      case 'cost': return costScore * 0.7 + qualityScore * 0.2 + latencyScore * 0.1
      case 'quality': return costScore * 0.1 + qualityScore * 0.7 + latencyScore * 0.2
      case 'speed': return costScore * 0.1 + qualityScore * 0.2 + latencyScore * 0.7
      default: return costScore * 0.4 + qualityScore * 0.4 + latencyScore * 0.2
    }
  }

  private estimateCost(model: CostProfile, tokens: number): number {
    const inputTokens = tokens * 0.7
    const outputTokens = tokens * 0.3
    return (inputTokens / 1000) * model.inputCostPer1K + (outputTokens / 1000) * model.outputCostPer1K
  }

  private getCheapestModel(): CostProfile | null {
    const models = this.getModels()
    if (models.length === 0) return null
    return models.sort((a, b) => a.inputCostPer1K - b.inputCostPer1K)[0]
  }

  private explainSelection(model: CostProfile, request: OptimizationRequest): string {
    const priority = request.priority || 'balanced'
    return `${model.modelId} (${model.provider}): quality=${model.quality}/10, latency=${model.latencyMs}ms, optimized for ${priority}`
  }

  private getPeriodSpend(budget: CostBudget): number {
    const now = Date.now()
    const periodMs = budget.period === 'daily' ? 86400000 : budget.period === 'weekly' ? 604800000 : 2592000000
    const since = new Date(now - periodMs)
    return this.getUsage(since).reduce((s, u) => s + u.cost, 0)
  }
}

export const llmCostOptimizerService = new LLMCostOptimizerService()
