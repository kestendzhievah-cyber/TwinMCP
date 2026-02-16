/**
 * Semantic Search Service with Embeddings.
 *
 * Provides meaning-based search over libraries using vector embeddings.
 * Supports hybrid search (combining keyword + semantic scores) and
 * works with any embedding provider (OpenAI, local models, etc.).
 *
 * In-memory vector store for testability; production would use pgvector
 * or a dedicated vector DB (Pinecone, Qdrant, etc.).
 */

export interface EmbeddingVector {
  id: string
  vector: number[]
  metadata: {
    name: string
    description?: string
    tags?: string[]
    [key: string]: any
  }
}

export interface SemanticSearchResult {
  id: string
  score: number
  metadata: EmbeddingVector['metadata']
}

export interface HybridSearchResult extends SemanticSearchResult {
  keywordScore: number
  semanticScore: number
}

export type EmbeddingProvider = (texts: string[]) => Promise<number[][]>

export class SemanticSearchService {
  private vectors: Map<string, EmbeddingVector> = new Map()
  private embeddingProvider: EmbeddingProvider | null = null
  private dimensions: number = 0

  /** Set the embedding provider function. */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider
  }

  /** Index a document with a pre-computed embedding. */
  indexVector(id: string, vector: number[], metadata: EmbeddingVector['metadata']): void {
    if (this.dimensions === 0) {
      this.dimensions = vector.length
    }
    this.vectors.set(id, { id, vector, metadata })
  }

  /** Index a document by generating its embedding from text. */
  async indexDocument(id: string, text: string, metadata: EmbeddingVector['metadata']): Promise<void> {
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not configured')
    }
    const [vector] = await this.embeddingProvider([text])
    this.indexVector(id, vector, metadata)
  }

  /** Remove a document from the index. */
  remove(id: string): boolean {
    return this.vectors.delete(id)
  }

  /** Get the number of indexed vectors. */
  get size(): number {
    return this.vectors.size
  }

  /**
   * Search by vector similarity (cosine similarity).
   */
  searchByVector(queryVector: number[], limit: number = 10, minScore: number = 0): SemanticSearchResult[] {
    const results: SemanticSearchResult[] = []

    for (const entry of this.vectors.values()) {
      const score = this.cosineSimilarity(queryVector, entry.vector)
      if (score >= minScore) {
        results.push({ id: entry.id, score, metadata: entry.metadata })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Search by text query (generates embedding, then searches by vector).
   */
  async search(query: string, limit: number = 10, minScore: number = 0): Promise<SemanticSearchResult[]> {
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not configured')
    }
    const [queryVector] = await this.embeddingProvider([query])
    return this.searchByVector(queryVector, limit, minScore)
  }

  /**
   * Hybrid search combining keyword matching and semantic similarity.
   * keywordWeight + semanticWeight should sum to 1.0.
   */
  hybridSearch(
    queryVector: number[],
    queryText: string,
    options: {
      limit?: number
      keywordWeight?: number
      semanticWeight?: number
      minScore?: number
    } = {}
  ): HybridSearchResult[] {
    const {
      limit = 10,
      keywordWeight = 0.3,
      semanticWeight = 0.7,
      minScore = 0,
    } = options

    const results: HybridSearchResult[] = []
    const queryLower = queryText.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0)

    for (const entry of this.vectors.values()) {
      const semanticScore = this.cosineSimilarity(queryVector, entry.vector)
      const keywordScore = this.computeKeywordScore(queryTerms, entry.metadata)
      const combinedScore = keywordWeight * keywordScore + semanticWeight * semanticScore

      if (combinedScore >= minScore) {
        results.push({
          id: entry.id,
          score: combinedScore,
          metadata: entry.metadata,
          keywordScore,
          semanticScore,
        })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Find similar documents to a given document ID.
   */
  findSimilar(id: string, limit: number = 5): SemanticSearchResult[] {
    const entry = this.vectors.get(id)
    if (!entry) return []

    return this.searchByVector(entry.vector, limit + 1)
      .filter(r => r.id !== id)
      .slice(0, limit)
  }

  // ── Internal ───────────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0

    let dot = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }

  private computeKeywordScore(queryTerms: string[], metadata: EmbeddingVector['metadata']): number {
    if (queryTerms.length === 0) return 0

    const searchable = [
      metadata.name || '',
      metadata.description || '',
      ...(metadata.tags || []),
    ].join(' ').toLowerCase()

    let matches = 0
    for (const term of queryTerms) {
      if (searchable.includes(term)) matches++
    }

    return matches / queryTerms.length
  }
}

export const semanticSearchService = new SemanticSearchService()
