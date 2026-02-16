/**
 * Conversation Search Service.
 *
 * Full-text and semantic search across conversations:
 *   - Full-text search with ranking
 *   - Filters (date, tags, folders, provider, model)
 *   - Search suggestions / autocomplete
 *   - Recent searches history
 *   - Highlighted snippets
 */

export interface SearchableConversation {
  id: string
  title: string
  messages: Array<{ role: string; content: string; timestamp: string }>
  tags: string[]
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
}

export interface SearchQuery {
  text: string
  filters?: {
    tags?: string[]
    dateFrom?: string
    dateTo?: string
    provider?: string
    model?: string
    role?: 'user' | 'assistant'
  }
  limit?: number
  offset?: number
}

export interface SearchHit {
  conversationId: string
  title: string
  snippet: string
  highlightedSnippet: string
  score: number
  matchedIn: 'title' | 'message'
  messageIndex?: number
  timestamp: string
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  query: string
  duration: number
  suggestions: string[]
}

export class ConversationSearchService {
  private index: Map<string, SearchableConversation> = new Map()
  private recentSearches: string[] = []
  private maxRecent = 20

  // ── Indexing ───────────────────────────────────────────────

  /** Index a conversation for searching. */
  indexConversation(conversation: SearchableConversation): void {
    this.index.set(conversation.id, conversation)
  }

  /** Remove a conversation from the index. */
  removeFromIndex(id: string): boolean {
    return this.index.delete(id)
  }

  /** Get index size. */
  get indexSize(): number {
    return this.index.size
  }

  /** Clear the entire index. */
  clearIndex(): void {
    this.index.clear()
  }

  // ── Search ─────────────────────────────────────────────────

  /** Search conversations. */
  search(query: SearchQuery): SearchResult {
    const start = Date.now()
    const text = query.text.toLowerCase().trim()
    const limit = query.limit || 20
    const offset = query.offset || 0

    if (!text) {
      return { hits: [], total: 0, query: query.text, duration: 0, suggestions: [] }
    }

    // Record search
    this.addRecentSearch(query.text)

    const allHits: SearchHit[] = []

    for (const conv of this.index.values()) {
      // Apply filters
      if (!this.matchesFilters(conv, query.filters)) continue

      // Search in title
      const titleScore = this.scoreMatch(conv.title, text)
      if (titleScore > 0) {
        allHits.push({
          conversationId: conv.id,
          title: conv.title,
          snippet: conv.title,
          highlightedSnippet: this.highlight(conv.title, text),
          score: titleScore * 1.5, // title matches get a boost
          matchedIn: 'title',
          timestamp: conv.updatedAt,
        })
      }

      // Search in messages
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i]
        if (query.filters?.role && msg.role !== query.filters.role) continue

        const msgScore = this.scoreMatch(msg.content, text)
        if (msgScore > 0) {
          allHits.push({
            conversationId: conv.id,
            title: conv.title,
            snippet: this.extractSnippet(msg.content, text),
            highlightedSnippet: this.highlight(this.extractSnippet(msg.content, text), text),
            score: msgScore,
            matchedIn: 'message',
            messageIndex: i,
            timestamp: msg.timestamp,
          })
        }
      }
    }

    // Sort by score descending
    allHits.sort((a, b) => b.score - a.score)

    // Deduplicate by conversation (keep best hit per conversation)
    const seen = new Set<string>()
    const deduped: SearchHit[] = []
    for (const hit of allHits) {
      if (!seen.has(hit.conversationId)) {
        seen.add(hit.conversationId)
        deduped.push(hit)
      }
    }

    const total = deduped.length
    const hits = deduped.slice(offset, offset + limit)
    const suggestions = this.getSuggestions(text)

    return {
      hits,
      total,
      query: query.text,
      duration: Date.now() - start,
      suggestions,
    }
  }

  // ── Recent Searches ────────────────────────────────────────

  getRecentSearches(): string[] {
    return [...this.recentSearches]
  }

  clearRecentSearches(): void {
    this.recentSearches = []
  }

  private addRecentSearch(query: string): void {
    const trimmed = query.trim()
    if (!trimmed) return
    this.recentSearches = [trimmed, ...this.recentSearches.filter(s => s !== trimmed)].slice(0, this.maxRecent)
  }

  // ── Suggestions ────────────────────────────────────────────

  /** Get search suggestions based on indexed content. */
  getSuggestions(prefix: string): string[] {
    if (!prefix || prefix.length < 2) return []
    const lower = prefix.toLowerCase()
    const suggestions = new Set<string>()

    // Suggest from titles
    for (const conv of this.index.values()) {
      if (conv.title.toLowerCase().includes(lower)) {
        suggestions.add(conv.title)
      }
      // Suggest from tags
      for (const tag of conv.tags) {
        if (tag.toLowerCase().includes(lower)) {
          suggestions.add(tag)
        }
      }
    }

    // Suggest from recent searches
    for (const recent of this.recentSearches) {
      if (recent.toLowerCase().includes(lower) && recent !== prefix) {
        suggestions.add(recent)
      }
    }

    return Array.from(suggestions).slice(0, 5)
  }

  // ── Internal ───────────────────────────────────────────────

  private matchesFilters(conv: SearchableConversation, filters?: SearchQuery['filters']): boolean {
    if (!filters) return true

    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some(t => conv.tags.includes(t))) return false
    }
    if (filters.dateFrom && conv.createdAt < filters.dateFrom) return false
    if (filters.dateTo && conv.createdAt > filters.dateTo) return false
    if (filters.provider && conv.provider !== filters.provider) return false
    if (filters.model && conv.model !== filters.model) return false

    return true
  }

  private scoreMatch(text: string, query: string): number {
    const lower = text.toLowerCase()
    if (!lower.includes(query)) return 0

    let score = 0
    // Exact match bonus
    if (lower === query) score += 10
    // Starts with bonus
    if (lower.startsWith(query)) score += 5
    // Word boundary bonus
    if (new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'i').test(text)) score += 3
    // Frequency
    const matches = lower.split(query).length - 1
    score += matches
    // Shorter text with match = more relevant
    score += Math.max(0, 5 - text.length / 200)

    return score
  }

  private extractSnippet(content: string, query: string, maxLen: number = 150): string {
    const lower = content.toLowerCase()
    const idx = lower.indexOf(query.toLowerCase())
    if (idx === -1) return content.slice(0, maxLen)

    const start = Math.max(0, idx - 40)
    const end = Math.min(content.length, idx + query.length + 80)
    let snippet = content.slice(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'
    return snippet
  }

  private highlight(text: string, query: string): string {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi')
    return text.replace(regex, '**$1**')
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export const conversationSearchService = new ConversationSearchService()
