/**
 * Advanced Overlap Management Service for Chunking.
 *
 * Controls how chunks overlap to preserve context across boundaries.
 * Supports multiple overlap strategies:
 *   - fixed: constant character/token overlap
 *   - sentence: overlap at sentence boundaries
 *   - semantic: overlap based on semantic coherence
 *   - adaptive: dynamic overlap based on content density
 */

export type OverlapStrategy = 'fixed' | 'sentence' | 'semantic' | 'adaptive'

export interface OverlapConfig {
  strategy: OverlapStrategy
  /** For fixed strategy: number of characters to overlap. */
  fixedSize: number
  /** For sentence strategy: number of sentences to overlap. */
  sentenceCount: number
  /** For adaptive strategy: min and max overlap as fraction of chunk size. */
  adaptiveMin: number
  adaptiveMax: number
  /** Minimum chunk size after overlap trimming. */
  minChunkSize: number
}

export interface ChunkWithOverlap {
  id: string
  content: string
  overlapBefore: string
  overlapAfter: string
  originalStart: number
  originalEnd: number
  metadata?: Record<string, any>
}

const DEFAULT_CONFIG: OverlapConfig = {
  strategy: 'sentence',
  fixedSize: 200,
  sentenceCount: 2,
  adaptiveMin: 0.05,
  adaptiveMax: 0.25,
  minChunkSize: 50,
}

export class OverlapManagerService {
  private config: OverlapConfig

  constructor(config?: Partial<OverlapConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Update configuration. */
  setConfig(config: Partial<OverlapConfig>): void {
    Object.assign(this.config, config)
  }

  /** Get current configuration. */
  getConfig(): OverlapConfig {
    return { ...this.config }
  }

  /**
   * Split text into chunks with overlap applied.
   */
  chunkWithOverlap(text: string, chunkSize: number): ChunkWithOverlap[] {
    const rawChunks = this.splitIntoRawChunks(text, chunkSize)
    return this.applyOverlap(rawChunks, text)
  }

  /**
   * Apply overlap to pre-existing chunks.
   */
  applyOverlapToChunks(chunks: Array<{ id: string; content: string; metadata?: Record<string, any> }>): ChunkWithOverlap[] {
    const fullText = chunks.map(c => c.content).join('\n')
    let offset = 0

    return chunks.map((chunk, i) => {
      const start = offset
      const end = offset + chunk.content.length
      offset = end + 1 // +1 for the \n join

      const overlapBefore = i > 0
        ? this.getOverlapContent(chunks[i - 1].content, 'end')
        : ''
      const overlapAfter = i < chunks.length - 1
        ? this.getOverlapContent(chunks[i + 1].content, 'start')
        : ''

      return {
        id: chunk.id,
        content: chunk.content,
        overlapBefore,
        overlapAfter,
        originalStart: start,
        originalEnd: end,
        metadata: chunk.metadata,
      }
    })
  }

  /**
   * Merge overlapping content from adjacent chunks (deduplication).
   */
  mergeOverlaps(chunks: ChunkWithOverlap[]): string {
    if (chunks.length === 0) return ''

    let result = chunks[0].content
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]
      const curr = chunks[i]

      // Find the overlap between end of prev and start of curr
      const overlapLen = this.findOverlapLength(prev.content, curr.content)
      result += curr.content.slice(overlapLen)
    }

    return result
  }

  /**
   * Get the effective content of a chunk (with overlap context prepended/appended).
   */
  getEffectiveContent(chunk: ChunkWithOverlap): string {
    const parts: string[] = []
    if (chunk.overlapBefore) parts.push(`[...] ${chunk.overlapBefore}`)
    parts.push(chunk.content)
    if (chunk.overlapAfter) parts.push(`${chunk.overlapAfter} [...]`)
    return parts.join('\n')
  }

  // ── Internal ───────────────────────────────────────────────

  private splitIntoRawChunks(text: string, chunkSize: number): Array<{ content: string; start: number; end: number }> {
    const chunks: Array<{ content: string; start: number; end: number }> = []
    let pos = 0

    while (pos < text.length) {
      const end = Math.min(pos + chunkSize, text.length)
      chunks.push({ content: text.slice(pos, end), start: pos, end })
      pos = end
    }

    return chunks
  }

  private applyOverlap(
    rawChunks: Array<{ content: string; start: number; end: number }>,
    fullText: string
  ): ChunkWithOverlap[] {
    return rawChunks.map((chunk, i) => {
      const overlapBefore = i > 0
        ? this.getOverlapContent(rawChunks[i - 1].content, 'end')
        : ''
      const overlapAfter = i < rawChunks.length - 1
        ? this.getOverlapContent(rawChunks[i + 1].content, 'start')
        : ''

      return {
        id: `chunk-${i}`,
        content: chunk.content,
        overlapBefore,
        overlapAfter,
        originalStart: chunk.start,
        originalEnd: chunk.end,
      }
    })
  }

  private getOverlapContent(adjacentContent: string, position: 'start' | 'end'): string {
    switch (this.config.strategy) {
      case 'fixed':
        return this.fixedOverlap(adjacentContent, position)
      case 'sentence':
        return this.sentenceOverlap(adjacentContent, position)
      case 'adaptive':
        return this.adaptiveOverlap(adjacentContent, position)
      case 'semantic':
        return this.sentenceOverlap(adjacentContent, position) // fallback to sentence
      default:
        return this.fixedOverlap(adjacentContent, position)
    }
  }

  private fixedOverlap(content: string, position: 'start' | 'end'): string {
    const size = Math.min(this.config.fixedSize, content.length)
    return position === 'start'
      ? content.slice(0, size)
      : content.slice(-size)
  }

  private sentenceOverlap(content: string, position: 'start' | 'end'): string {
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
    const count = Math.min(this.config.sentenceCount, sentences.length)

    if (position === 'start') {
      return sentences.slice(0, count).join(' ')
    } else {
      return sentences.slice(-count).join(' ')
    }
  }

  private adaptiveOverlap(content: string, position: 'start' | 'end'): string {
    // Compute density: more punctuation/structure = higher density = more overlap
    const density = (content.match(/[.!?;:,]/g) || []).length / Math.max(content.length, 1)
    const fraction = this.config.adaptiveMin + density * (this.config.adaptiveMax - this.config.adaptiveMin)
    const size = Math.max(Math.round(content.length * fraction), this.config.minChunkSize)

    return position === 'start'
      ? content.slice(0, size)
      : content.slice(-size)
  }

  private findOverlapLength(prev: string, curr: string): number {
    const maxCheck = Math.min(prev.length, curr.length, this.config.fixedSize * 2)
    for (let len = maxCheck; len > 0; len--) {
      if (prev.endsWith(curr.slice(0, len))) return len
    }
    return 0
  }
}

export const overlapManagerService = new OverlapManagerService()
