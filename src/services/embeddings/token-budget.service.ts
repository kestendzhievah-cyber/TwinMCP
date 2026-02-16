/**
 * Dynamic Token Budget Management Service.
 *
 * Manages token allocation across context sections (system prompt,
 * retrieved docs, conversation history, user query) to maximize
 * information density within model token limits.
 *
 * Features:
 *   - Per-section budgets with priorities
 *   - Dynamic reallocation when sections underuse their budget
 *   - Compression triggers when over budget
 *   - Model-aware limits (GPT-4, Claude, etc.)
 */

export interface TokenSection {
  id: string
  name: string
  priority: number // lower = higher priority (1 = highest)
  minTokens: number
  maxTokens: number
  currentTokens: number
  content: string
  compressible: boolean
}

export interface TokenBudgetConfig {
  totalBudget: number
  reserveTokens: number // tokens reserved for model response
  sections: TokenSection[]
}

export interface AllocationResult {
  sections: Array<{
    id: string
    name: string
    allocatedTokens: number
    usedTokens: number
    trimmed: boolean
    content: string
  }>
  totalAllocated: number
  totalUsed: number
  remaining: number
  overBudget: boolean
}

export type CompressionFn = (content: string, targetTokens: number) => string

export class TokenBudgetService {
  private config: TokenBudgetConfig
  private compressionFn: CompressionFn | null = null

  constructor(totalBudget: number = 8192, reserveTokens: number = 1024) {
    this.config = {
      totalBudget,
      reserveTokens,
      sections: [],
    }
  }

  /** Set total token budget. */
  setTotalBudget(budget: number): void {
    this.config.totalBudget = budget
  }

  /** Set reserve tokens for response. */
  setReserveTokens(reserve: number): void {
    this.config.reserveTokens = reserve
  }

  /** Get available budget (total - reserve). */
  getAvailableBudget(): number {
    return this.config.totalBudget - this.config.reserveTokens
  }

  /** Set a compression function for over-budget sections. */
  setCompressionFn(fn: CompressionFn): void {
    this.compressionFn = fn
  }

  // ── Section Management ─────────────────────────────────────

  /** Add a section. */
  addSection(section: TokenSection): void {
    this.config.sections.push(section)
    this.config.sections.sort((a, b) => a.priority - b.priority)
  }

  /** Remove a section. */
  removeSection(id: string): boolean {
    const idx = this.config.sections.findIndex(s => s.id === id)
    if (idx === -1) return false
    this.config.sections.splice(idx, 1)
    return true
  }

  /** Get all sections. */
  getSections(): TokenSection[] {
    return [...this.config.sections]
  }

  /** Update a section's content and token count. */
  updateSection(id: string, content: string): boolean {
    const section = this.config.sections.find(s => s.id === id)
    if (!section) return false
    section.content = content
    section.currentTokens = this.estimateTokens(content)
    return true
  }

  // ── Allocation ─────────────────────────────────────────────

  /**
   * Allocate tokens across all sections based on priority and content.
   * Returns the allocation result with potentially trimmed content.
   */
  allocate(): AllocationResult {
    const available = this.getAvailableBudget()
    const sections = [...this.config.sections].sort((a, b) => a.priority - b.priority)

    // Phase 1: Allocate minimum tokens to each section
    const allocations = new Map<string, number>()
    let allocated = 0

    for (const section of sections) {
      const min = Math.min(section.minTokens, section.currentTokens)
      allocations.set(section.id, min)
      allocated += min
    }

    // Phase 2: Distribute remaining budget by priority
    let remaining = available - allocated
    for (const section of sections) {
      if (remaining <= 0) break

      const currentAlloc = allocations.get(section.id)!
      const wanted = Math.min(section.currentTokens, section.maxTokens) - currentAlloc
      const give = Math.min(wanted, remaining)

      if (give > 0) {
        allocations.set(section.id, currentAlloc + give)
        allocated += give
        remaining -= give
      }
    }

    // Phase 3: Redistribute unused budget from low-priority to high-priority
    for (const section of sections) {
      const alloc = allocations.get(section.id)!
      if (section.currentTokens < alloc) {
        const surplus = alloc - section.currentTokens
        allocations.set(section.id, section.currentTokens)
        remaining += surplus
        allocated -= surplus
      }
    }

    // Give surplus to highest-priority sections that need more
    for (const section of sections) {
      if (remaining <= 0) break
      const alloc = allocations.get(section.id)!
      const max = Math.min(section.currentTokens, section.maxTokens)
      if (alloc < max) {
        const give = Math.min(max - alloc, remaining)
        allocations.set(section.id, alloc + give)
        allocated += give
        remaining -= give
      }
    }

    // Phase 4: Build result with trimming
    const resultSections = sections.map(section => {
      const allocatedTokens = allocations.get(section.id)!
      let content = section.content
      let trimmed = false

      if (section.currentTokens > allocatedTokens) {
        trimmed = true
        if (this.compressionFn && section.compressible) {
          content = this.compressionFn(content, allocatedTokens)
        } else {
          content = this.truncateToTokens(content, allocatedTokens)
        }
      }

      return {
        id: section.id,
        name: section.name,
        allocatedTokens,
        usedTokens: Math.min(section.currentTokens, allocatedTokens),
        trimmed,
        content,
      }
    })

    const totalUsed = resultSections.reduce((sum, s) => sum + s.usedTokens, 0)

    return {
      sections: resultSections,
      totalAllocated: allocated,
      totalUsed,
      remaining: available - totalUsed,
      overBudget: totalUsed > available,
    }
  }

  /**
   * Quick check: is the current content within budget?
   */
  isWithinBudget(): boolean {
    const total = this.config.sections.reduce((sum, s) => sum + s.currentTokens, 0)
    return total <= this.getAvailableBudget()
  }

  /**
   * Get a summary of current token usage.
   */
  getUsageSummary(): {
    totalBudget: number
    reserveTokens: number
    availableBudget: number
    currentUsage: number
    utilizationPercent: number
    sectionBreakdown: Array<{ id: string; name: string; tokens: number; percent: number }>
  } {
    const available = this.getAvailableBudget()
    const currentUsage = this.config.sections.reduce((sum, s) => sum + s.currentTokens, 0)

    return {
      totalBudget: this.config.totalBudget,
      reserveTokens: this.config.reserveTokens,
      availableBudget: available,
      currentUsage,
      utilizationPercent: available > 0 ? (currentUsage / available) * 100 : 0,
      sectionBreakdown: this.config.sections.map(s => ({
        id: s.id,
        name: s.name,
        tokens: s.currentTokens,
        percent: currentUsage > 0 ? (s.currentTokens / currentUsage) * 100 : 0,
      })),
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars - 3) + '...'
  }
}

// ── Model Presets ────────────────────────────────────────────

export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
}

export function createBudgetForModel(model: string, reserveRatio: number = 0.25): TokenBudgetService {
  const limit = MODEL_TOKEN_LIMITS[model] || 8192
  const reserve = Math.round(limit * reserveRatio)
  return new TokenBudgetService(limit, reserve)
}
