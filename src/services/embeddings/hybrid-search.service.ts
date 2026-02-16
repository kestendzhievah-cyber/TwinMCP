/**
 * Hybrid Search Service (Vector + Text).
 *
 * Combines vector similarity search with full-text keyword search,
 * then applies re-ranking to produce optimal results.
 *
 * Pipeline: keyword search → vector search → merge → re-rank → return
 */

export interface HybridDocument {
  id: string
  content: string
  vector?: number[]
  metadata: Record<string, any>
}

export interface HybridSearchQuery {
  text: string
  vector?: number[]
  limit?: number
  vectorWeight?: number
  textWeight?: number
  minScore?: number
  rerank?: boolean
}

export interface HybridSearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  vectorScore: number
  textScore: number
  combinedScore: number
  rerankScore?: number
  finalScore: number
}

export type RerankFunction = (query: string, results: HybridSearchResult[]) => Promise<HybridSearchResult[]>

export class HybridSearchService {
  private documents: Map<string, HybridDocument> = new Map()
  private rerankFn: RerankFunction | null = null

  /** Index a document. */
  index(doc: HybridDocument): void {
    this.documents.set(doc.id, doc)
  }

  /** Remove a document. */
  remove(id: string): boolean {
    return this.documents.delete(id)
  }

  /** Get document count. */
  get size(): number {
    return this.documents.size
  }

  /** Set a custom re-ranking function. */
  setRerankFunction(fn: RerankFunction): void {
    this.rerankFn = fn
  }

  /**
   * Execute hybrid search combining vector similarity and text matching.
   */
  async search(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    const {
      text,
      vector,
      limit = 10,
      vectorWeight = 0.6,
      textWeight = 0.4,
      minScore = 0,
      rerank = false,
    } = query

    const results: HybridSearchResult[] = []
    const queryTerms = this.tokenize(text)

    for (const doc of this.documents.values()) {
      const textScore = this.computeTextScore(queryTerms, doc.content, doc.metadata)
      const vectorScore = vector && doc.vector
        ? this.cosineSimilarity(vector, doc.vector)
        : 0

      const combinedScore = vectorWeight * vectorScore + textWeight * textScore

      if (combinedScore >= minScore) {
        results.push({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          vectorScore,
          textScore,
          combinedScore,
          finalScore: combinedScore,
        })
      }
    }

    // Sort by combined score
    results.sort((a, b) => b.combinedScore - a.combinedScore)

    // Apply re-ranking if requested
    if (rerank && this.rerankFn) {
      const reranked = await this.rerankFn(text, results.slice(0, limit * 2))
      return reranked.slice(0, limit)
    }

    return results.slice(0, limit)
  }

  // ── Text Scoring (BM25-inspired) ──────────────────────────

  private computeTextScore(queryTerms: string[], content: string, metadata: Record<string, any>): number {
    const docTerms = this.tokenize(content)
    const nameTerms = this.tokenize(metadata.name || '')
    const tagTerms = this.tokenize((metadata.tags || []).join(' '))

    if (queryTerms.length === 0) return 0

    let score = 0
    const k1 = 1.2
    const b = 0.75
    const avgDocLen = 200

    for (const term of queryTerms) {
      // Content match (BM25-like)
      const tf = docTerms.filter(t => t === term).length
      const idf = Math.log(1 + (this.documents.size - this.termDocFreq(term) + 0.5) / (this.termDocFreq(term) + 0.5))
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docTerms.length / avgDocLen)))
      score += idf * tfNorm

      // Name match boost
      if (nameTerms.includes(term)) score += 2.0

      // Tag match boost
      if (tagTerms.includes(term)) score += 1.0

      // Exact phrase boost
      if (content.toLowerCase().includes(queryTerms.join(' '))) score += 1.5
    }

    // Normalize to 0-1 range
    const maxPossible = queryTerms.length * 5
    return Math.min(score / maxPossible, 1.0)
  }

  private termDocFreq(term: string): number {
    let count = 0
    for (const doc of this.documents.values()) {
      if (doc.content.toLowerCase().includes(term)) count++
    }
    return count
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(t => t.length > 1)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0, nA = 0, nB = 0
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i] }
    const d = Math.sqrt(nA) * Math.sqrt(nB)
    return d === 0 ? 0 : dot / d
  }
}

export const hybridSearchService = new HybridSearchService()
