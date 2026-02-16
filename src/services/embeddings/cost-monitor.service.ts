/**
 * Real-Time Embedding Cost Monitoring Service.
 *
 * Tracks costs across models, time periods, and users.
 * Supports budgets, alerts, and cost projections.
 */

export interface CostEntry {
  id: string
  timestamp: string
  modelId: string
  tokens: number
  cost: number
  userId?: string
  operation: 'embed' | 'search' | 'reindex'
}

export interface CostBudget {
  id: string
  name: string
  limitAmount: number
  period: 'daily' | 'weekly' | 'monthly'
  currentSpend: number
  alertThreshold: number // 0-1, e.g. 0.8 = alert at 80%
  enabled: boolean
}

export interface CostAlert {
  budgetId: string
  budgetName: string
  threshold: number
  currentSpend: number
  limit: number
  percentage: number
  triggeredAt: string
}

export interface CostSummary {
  totalCost: number
  totalTokens: number
  totalOperations: number
  byModel: Record<string, { cost: number; tokens: number; operations: number }>
  byOperation: Record<string, { cost: number; tokens: number; operations: number }>
  projection: { daily: number; weekly: number; monthly: number }
}

export class CostMonitorService {
  private entries: CostEntry[] = []
  private budgets: Map<string, CostBudget> = new Map()
  private alerts: CostAlert[] = []
  private alertCallbacks: Array<(alert: CostAlert) => void> = []
  private idCounter = 0

  /** Record a cost entry. */
  record(entry: Omit<CostEntry, 'id' | 'timestamp'>): CostEntry {
    const record: CostEntry = {
      ...entry,
      id: `cost-${++this.idCounter}`,
      timestamp: new Date().toISOString(),
    }
    this.entries.push(record)

    // Check budgets
    this.checkBudgets()

    return record
  }

  /** Get all entries. */
  getEntries(): CostEntry[] {
    return [...this.entries]
  }

  /** Get entries within a time range. */
  getEntriesInRange(from: Date, to: Date): CostEntry[] {
    return this.entries.filter(e => {
      const t = new Date(e.timestamp)
      return t >= from && t <= to
    })
  }

  // ── Budgets ────────────────────────────────────────────────

  /** Add a cost budget. */
  addBudget(budget: CostBudget): void {
    this.budgets.set(budget.id, budget)
  }

  /** Get a budget. */
  getBudget(id: string): CostBudget | undefined {
    return this.budgets.get(id)
  }

  /** Get all budgets. */
  getBudgets(): CostBudget[] {
    return Array.from(this.budgets.values())
  }

  /** Remove a budget. */
  removeBudget(id: string): boolean {
    return this.budgets.delete(id)
  }

  /** Register a callback for budget alerts. */
  onAlert(callback: (alert: CostAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /** Get triggered alerts. */
  getAlerts(): CostAlert[] {
    return [...this.alerts]
  }

  // ── Summaries ──────────────────────────────────────────────

  /** Get a cost summary for a time range. */
  getSummary(from: Date, to: Date): CostSummary {
    const entries = this.getEntriesInRange(from, to)

    const byModel: Record<string, { cost: number; tokens: number; operations: number }> = {}
    const byOperation: Record<string, { cost: number; tokens: number; operations: number }> = {}
    let totalCost = 0
    let totalTokens = 0

    for (const e of entries) {
      totalCost += e.cost
      totalTokens += e.tokens

      if (!byModel[e.modelId]) byModel[e.modelId] = { cost: 0, tokens: 0, operations: 0 }
      byModel[e.modelId].cost += e.cost
      byModel[e.modelId].tokens += e.tokens
      byModel[e.modelId].operations++

      if (!byOperation[e.operation]) byOperation[e.operation] = { cost: 0, tokens: 0, operations: 0 }
      byOperation[e.operation].cost += e.cost
      byOperation[e.operation].tokens += e.tokens
      byOperation[e.operation].operations++
    }

    const rangeDays = Math.max((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24), 1)
    const dailyRate = totalCost / rangeDays

    return {
      totalCost,
      totalTokens,
      totalOperations: entries.length,
      byModel,
      byOperation,
      projection: {
        daily: dailyRate,
        weekly: dailyRate * 7,
        monthly: dailyRate * 30,
      },
    }
  }

  /** Get current period spend for a budget. */
  getBudgetSpend(budgetId: string): number {
    const budget = this.budgets.get(budgetId)
    if (!budget) return 0

    const now = new Date()
    let from: Date

    switch (budget.period) {
      case 'daily':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'weekly':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        from = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    return this.getEntriesInRange(from, now).reduce((sum, e) => sum + e.cost, 0)
  }

  // ── Internal ───────────────────────────────────────────────

  private checkBudgets(): void {
    for (const budget of this.budgets.values()) {
      if (!budget.enabled) continue

      const spend = this.getBudgetSpend(budget.id)
      budget.currentSpend = spend
      const percentage = spend / budget.limitAmount

      if (percentage >= budget.alertThreshold) {
        const alert: CostAlert = {
          budgetId: budget.id,
          budgetName: budget.name,
          threshold: budget.alertThreshold,
          currentSpend: spend,
          limit: budget.limitAmount,
          percentage,
          triggeredAt: new Date().toISOString(),
        }
        this.alerts.push(alert)
        for (const cb of this.alertCallbacks) {
          try { cb(alert) } catch { /* ignore callback errors */ }
        }
      }
    }
  }

  /** Get total entry count. */
  get size(): number {
    return this.entries.length
  }
}

export const costMonitorService = new CostMonitorService()
