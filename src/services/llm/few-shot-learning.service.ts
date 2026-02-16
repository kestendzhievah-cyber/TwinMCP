/**
 * Few-Shot Learning Service.
 *
 * Automatically selects and manages few-shot examples for prompts:
 *   - Example store with categorization
 *   - Similarity-based example selection
 *   - Dynamic example count based on token budget
 *   - Example quality scoring and ranking
 *   - Automatic example generation from successful interactions
 */

export interface FewShotExample {
  id: string
  category: string
  input: string
  output: string
  quality: number // 0-1
  usageCount: number
  successRate: number
  tags: string[]
  createdAt: string
  metadata?: Record<string, any>
}

export interface FewShotSelection {
  examples: FewShotExample[]
  totalTokens: number
  strategy: string
  reason: string
}

export interface FewShotConfig {
  maxExamples: number
  maxTokensPerExample: number
  totalTokenBudget: number
  selectionStrategy: 'similarity' | 'quality' | 'diverse' | 'recent'
  minQuality: number
}

const DEFAULT_CONFIG: FewShotConfig = {
  maxExamples: 5,
  maxTokensPerExample: 500,
  totalTokenBudget: 2000,
  selectionStrategy: 'quality',
  minQuality: 0.3,
}

export class FewShotLearningService {
  private examples: Map<string, FewShotExample> = new Map()
  private config: FewShotConfig
  private idCounter = 0

  constructor(config: Partial<FewShotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getConfig(): FewShotConfig { return { ...this.config } }
  setConfig(config: Partial<FewShotConfig>): void { Object.assign(this.config, config) }

  // ── Example Management ─────────────────────────────────────

  addExample(example: Omit<FewShotExample, 'id' | 'usageCount' | 'successRate' | 'createdAt'>): FewShotExample {
    const full: FewShotExample = {
      ...example,
      id: `ex-${++this.idCounter}`,
      usageCount: 0,
      successRate: 0,
      createdAt: new Date().toISOString(),
    }
    this.examples.set(full.id, full)
    return full
  }

  getExample(id: string): FewShotExample | undefined {
    return this.examples.get(id)
  }

  removeExample(id: string): boolean {
    return this.examples.delete(id)
  }

  getExamples(category?: string): FewShotExample[] {
    const all = Array.from(this.examples.values())
    if (category) return all.filter(e => e.category === category)
    return all
  }

  getCategories(): string[] {
    return [...new Set(Array.from(this.examples.values()).map(e => e.category))]
  }

  get size(): number { return this.examples.size }

  // ── Example Selection ──────────────────────────────────────

  /** Select best examples for a given query. */
  selectExamples(query: string, category?: string, config?: Partial<FewShotConfig>): FewShotSelection {
    const cfg = { ...this.config, ...config }
    let candidates = this.getExamples(category).filter(e => e.quality >= cfg.minQuality)

    if (candidates.length === 0) {
      return { examples: [], totalTokens: 0, strategy: cfg.selectionStrategy, reason: 'No qualifying examples found' }
    }

    // Score and rank
    const scored = candidates.map(ex => ({
      example: ex,
      score: this.scoreExample(ex, query, cfg.selectionStrategy),
      tokens: this.estimateTokens(ex),
    }))

    scored.sort((a, b) => b.score - a.score)

    // Select within token budget
    const selected: FewShotExample[] = []
    let totalTokens = 0

    for (const item of scored) {
      if (selected.length >= cfg.maxExamples) break
      if (item.tokens > cfg.maxTokensPerExample) continue
      if (totalTokens + item.tokens > cfg.totalTokenBudget) continue

      selected.push(item.example)
      totalTokens += item.tokens
    }

    // Apply diversity if strategy requires it
    const final = cfg.selectionStrategy === 'diverse'
      ? this.diversify(selected, scored.map(s => s.example))
      : selected

    // Update usage counts
    for (const ex of final) {
      ex.usageCount++
    }

    return {
      examples: final,
      totalTokens,
      strategy: cfg.selectionStrategy,
      reason: `Selected ${final.length} examples using ${cfg.selectionStrategy} strategy`,
    }
  }

  /** Format selected examples into a prompt section. */
  formatExamples(examples: FewShotExample[], format: 'chat' | 'text' = 'text'): string {
    if (examples.length === 0) return ''

    if (format === 'chat') {
      return examples.map((ex, i) =>
        `Example ${i + 1}:\nUser: ${ex.input}\nAssistant: ${ex.output}`
      ).join('\n\n')
    }

    return examples.map((ex, i) =>
      `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`
    ).join('\n\n')
  }

  // ── Feedback & Learning ────────────────────────────────────

  /** Record feedback for an example usage. */
  recordFeedback(exampleId: string, success: boolean): void {
    const ex = this.examples.get(exampleId)
    if (!ex) return

    const total = ex.usageCount || 1
    const successes = ex.successRate * (total - 1) + (success ? 1 : 0)
    ex.successRate = successes / total

    // Adjust quality based on feedback
    if (success) {
      ex.quality = Math.min(1, ex.quality + 0.05)
    } else {
      ex.quality = Math.max(0, ex.quality - 0.1)
    }
  }

  /** Auto-generate an example from a successful interaction. */
  learnFromInteraction(category: string, input: string, output: string, quality: number = 0.7, tags: string[] = []): FewShotExample {
    return this.addExample({ category, input, output, quality, tags })
  }

  // ── Internal ───────────────────────────────────────────────

  private scoreExample(example: FewShotExample, query: string, strategy: string): number {
    switch (strategy) {
      case 'similarity':
        return this.computeSimilarity(example.input, query) * 0.6 + example.quality * 0.3 + example.successRate * 0.1
      case 'quality':
        return example.quality * 0.5 + example.successRate * 0.3 + this.computeSimilarity(example.input, query) * 0.2
      case 'recent':
        const age = (Date.now() - new Date(example.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        const recency = Math.max(0, 1 - age / 30) // decay over 30 days
        return recency * 0.4 + example.quality * 0.3 + this.computeSimilarity(example.input, query) * 0.3
      case 'diverse':
        return example.quality * 0.4 + this.computeSimilarity(example.input, query) * 0.4 + example.successRate * 0.2
      default:
        return example.quality
    }
  }

  private computeSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.toLowerCase().split(/\s+/))
    if (wordsA.size === 0 || wordsB.size === 0) return 0

    let intersection = 0
    for (const w of wordsA) { if (wordsB.has(w)) intersection++ }
    return intersection / Math.max(wordsA.size, wordsB.size)
  }

  private diversify(selected: FewShotExample[], pool: FewShotExample[]): FewShotExample[] {
    if (selected.length <= 1) return selected

    // Ensure tag diversity
    const usedTags = new Set<string>()
    const diverse: FewShotExample[] = []

    for (const ex of selected) {
      const newTags = ex.tags.filter(t => !usedTags.has(t))
      if (newTags.length > 0 || diverse.length < 2) {
        diverse.push(ex)
        ex.tags.forEach(t => usedTags.add(t))
      }
    }

    return diverse.length > 0 ? diverse : selected
  }

  private estimateTokens(example: FewShotExample): number {
    return Math.ceil((example.input.length + example.output.length) / 4)
  }
}

export const fewShotLearningService = new FewShotLearningService()
