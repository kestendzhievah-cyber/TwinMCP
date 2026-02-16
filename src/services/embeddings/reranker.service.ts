/**
 * Result Re-ranking Service.
 *
 * Applies secondary scoring to search results using multiple signals:
 *   - Cross-encoder similarity (pluggable)
 *   - Recency boost
 *   - Diversity penalty (MMR — Maximal Marginal Relevance)
 *   - Authority/popularity boost
 *   - Custom scoring functions
 */

export interface RerankableResult {
  id: string
  content: string
  score: number
  metadata: Record<string, any>
  vector?: number[]
}

export interface RerankConfig {
  /** Weight for the original score (0-1). */
  originalScoreWeight: number
  /** Weight for cross-encoder score (0-1). */
  crossEncoderWeight: number
  /** Weight for recency (0-1). */
  recencyWeight: number
  /** Weight for diversity / MMR (0-1). */
  diversityWeight: number
  /** Lambda for MMR (0 = max diversity, 1 = max relevance). */
  mmrLambda: number
}

export interface RerankedResult extends RerankableResult {
  originalRank: number
  rerankScore: number
  finalScore: number
  signals: {
    originalScore: number
    crossEncoderScore: number
    recencyScore: number
    diversityScore: number
  }
}

export type CrossEncoderFn = (query: string, documents: string[]) => Promise<number[]>

const DEFAULT_CONFIG: RerankConfig = {
  originalScoreWeight: 0.4,
  crossEncoderWeight: 0.3,
  recencyWeight: 0.15,
  diversityWeight: 0.15,
  mmrLambda: 0.7,
}

export class RerankerService {
  private config: RerankConfig
  private crossEncoder: CrossEncoderFn | null = null

  constructor(config?: Partial<RerankConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Set the cross-encoder scoring function. */
  setCrossEncoder(fn: CrossEncoderFn): void {
    this.crossEncoder = fn
  }

  /** Update config. */
  setConfig(config: Partial<RerankConfig>): void {
    Object.assign(this.config, config)
  }

  /** Get current config. */
  getConfig(): RerankConfig {
    return { ...this.config }
  }

  /**
   * Re-rank a list of search results.
   */
  async rerank(query: string, results: RerankableResult[], limit?: number): Promise<RerankedResult[]> {
    if (results.length === 0) return []

    // 1. Cross-encoder scores
    let crossEncoderScores: number[]
    if (this.crossEncoder) {
      crossEncoderScores = await this.crossEncoder(query, results.map(r => r.content))
    } else {
      // Fallback: use query-content overlap as proxy
      crossEncoderScores = results.map(r => this.simpleRelevance(query, r.content))
    }

    // 2. Recency scores
    const recencyScores = results.map(r => this.computeRecency(r.metadata))

    // 3. Build initial scored results
    const scored: RerankedResult[] = results.map((r, i) => ({
      ...r,
      originalRank: i + 1,
      rerankScore: 0,
      finalScore: 0,
      signals: {
        originalScore: r.score,
        crossEncoderScore: crossEncoderScores[i],
        recencyScore: recencyScores[i],
        diversityScore: 1.0, // computed in MMR pass
      },
    }))

    // 4. Apply MMR for diversity
    const reranked = this.applyMMR(scored, limit || results.length)

    return reranked
  }

  /**
   * Simple re-rank without cross-encoder (fast path).
   */
  rerankSimple(query: string, results: RerankableResult[], limit?: number): RerankedResult[] {
    const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 1)

    const scored: RerankedResult[] = results.map((r, i) => {
      const ceScore = this.simpleRelevance(query, r.content)
      const recency = this.computeRecency(r.metadata)

      const rerankScore =
        this.config.originalScoreWeight * r.score +
        this.config.crossEncoderWeight * ceScore +
        this.config.recencyWeight * recency

      return {
        ...r,
        originalRank: i + 1,
        rerankScore,
        finalScore: rerankScore,
        signals: {
          originalScore: r.score,
          crossEncoderScore: ceScore,
          recencyScore: recency,
          diversityScore: 1.0,
        },
      }
    })

    scored.sort((a, b) => b.finalScore - a.finalScore)
    return (limit ? scored.slice(0, limit) : scored)
  }

  // ── MMR (Maximal Marginal Relevance) ───────────────────────

  private applyMMR(results: RerankedResult[], limit: number): RerankedResult[] {
    const selected: RerankedResult[] = []
    const remaining = [...results]
    const lambda = this.config.mmrLambda

    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = 0
      let bestScore = -Infinity

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]

        // Relevance component
        const relevance =
          this.config.originalScoreWeight * candidate.signals.originalScore +
          this.config.crossEncoderWeight * candidate.signals.crossEncoderScore +
          this.config.recencyWeight * candidate.signals.recencyScore

        // Diversity component: max similarity to already selected
        let maxSim = 0
        for (const sel of selected) {
          const sim = this.contentSimilarity(candidate.content, sel.content)
          maxSim = Math.max(maxSim, sim)
        }

        const mmrScore = lambda * relevance - (1 - lambda) * maxSim
        candidate.signals.diversityScore = 1 - maxSim

        if (mmrScore > bestScore) {
          bestScore = mmrScore
          bestIdx = i
        }
      }

      const chosen = remaining.splice(bestIdx, 1)[0]
      chosen.finalScore = bestScore
      chosen.rerankScore = bestScore
      selected.push(chosen)
    }

    return selected
  }

  // ── Helpers ────────────────────────────────────────────────

  private simpleRelevance(query: string, content: string): number {
    const qTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 1)
    const cLower = content.toLowerCase()
    if (qTerms.length === 0) return 0

    let matches = 0
    for (const term of qTerms) {
      if (cLower.includes(term)) matches++
    }
    return matches / qTerms.length
  }

  private computeRecency(metadata: Record<string, any>): number {
    const date = metadata.lastModified || metadata.updatedAt || metadata.timestamp
    if (!date) return 0.5

    const daysSince = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince <= 7) return 1.0
    if (daysSince <= 30) return 0.8
    if (daysSince <= 90) return 0.5
    return 0.2
  }

  private contentSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(t => t.length > 1))
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(t => t.length > 1))
    if (setA.size === 0 || setB.size === 0) return 0

    let intersection = 0
    for (const t of setA) { if (setB.has(t)) intersection++ }
    return intersection / Math.max(setA.size, setB.size)
  }
}

export const rerankerService = new RerankerService()
