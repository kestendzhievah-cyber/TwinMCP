/**
 * Documentation Suggestions Service.
 *
 * Automatically suggests relevant documentation based on conversation context:
 *   - Keyword extraction from messages
 *   - Documentation matching by relevance
 *   - Contextual suggestions based on conversation topic
 *   - Suggestion ranking and deduplication
 *   - Learning from user interactions (click-through)
 */

export interface DocEntry {
  id: string
  title: string
  url: string
  content: string
  tags: string[]
  library?: string
  section?: string
  lastUpdated?: string
}

export interface DocSuggestion {
  docId: string
  title: string
  url: string
  snippet: string
  relevance: number
  reason: string
  library?: string
}

export interface SuggestionResult {
  suggestions: DocSuggestion[]
  query: string
  keywords: string[]
  duration: number
}

export class DocSuggestionsService {
  private docs: Map<string, DocEntry> = new Map()
  private clickHistory: Map<string, number> = new Map() // docId → click count
  private idCounter = 0

  // ── Doc Registry ───────────────────────────────────────────

  addDoc(doc: DocEntry): void {
    this.docs.set(doc.id, doc)
  }

  removeDoc(id: string): boolean {
    return this.docs.delete(id)
  }

  getDocs(): DocEntry[] {
    return Array.from(this.docs.values())
  }

  getDoc(id: string): DocEntry | undefined {
    return this.docs.get(id)
  }

  get docCount(): number {
    return this.docs.size
  }

  // ── Suggestions ────────────────────────────────────────────

  /** Suggest docs based on a message or conversation context. */
  suggest(text: string, maxResults: number = 5): SuggestionResult {
    const start = Date.now()
    const keywords = this.extractKeywords(text)

    if (keywords.length === 0) {
      return { suggestions: [], query: text, keywords: [], duration: 0 }
    }

    const scored: Array<{ doc: DocEntry; score: number; matchedKeywords: string[] }> = []

    for (const doc of this.docs.values()) {
      const { score, matched } = this.scoreDoc(doc, keywords)
      if (score > 0) {
        // Boost by click history
        const clicks = this.clickHistory.get(doc.id) || 0
        const boostedScore = score + clicks * 0.1
        scored.push({ doc, score: boostedScore, matchedKeywords: matched })
      }
    }

    scored.sort((a, b) => b.score - a.score)

    const suggestions: DocSuggestion[] = scored.slice(0, maxResults).map(s => ({
      docId: s.doc.id,
      title: s.doc.title,
      url: s.doc.url,
      snippet: this.extractSnippet(s.doc.content, s.matchedKeywords[0] || keywords[0]),
      relevance: Math.min(s.score / 10, 1),
      reason: `Matches: ${s.matchedKeywords.join(', ')}`,
      library: s.doc.library,
    }))

    return {
      suggestions,
      query: text,
      keywords,
      duration: Date.now() - start,
    }
  }

  /** Suggest docs based on multiple messages (conversation context). */
  suggestFromConversation(messages: Array<{ role: string; content: string }>, maxResults: number = 5): SuggestionResult {
    // Combine recent messages for context
    const recent = messages.slice(-5)
    const combined = recent.map(m => m.content).join(' ')
    return this.suggest(combined, maxResults)
  }

  // ── Feedback ───────────────────────────────────────────────

  /** Record a click on a suggestion (for learning). */
  recordClick(docId: string): void {
    this.clickHistory.set(docId, (this.clickHistory.get(docId) || 0) + 1)
  }

  /** Get click count for a doc. */
  getClickCount(docId: string): number {
    return this.clickHistory.get(docId) || 0
  }

  /** Clear click history. */
  clearClickHistory(): void {
    this.clickHistory.clear()
  }

  // ── Keyword Extraction ─────────────────────────────────────

  /** Extract meaningful keywords from text. */
  extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
      'or', 'if', 'while', 'about', 'up', 'it', 'its', 'i', 'me', 'my',
      'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'this', 'that',
      'what', 'which', 'who', 'whom', 'these', 'those',
      'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est',
      'en', 'que', 'qui', 'dans', 'ce', 'il', 'pas', 'ne', 'sur', 'se',
      'je', 'tu', 'nous', 'vous', 'ils', 'pour', 'avec', 'son', 'sa', 'ses',
      'comment', 'faire', 'peut', 'plus', 'aussi', 'comme', 'mais', 'ou',
    ])

    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w))

    // Count frequency
    const freq = new Map<string, number>()
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1)
    }

    // Return top keywords by frequency
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  // ── Internal ───────────────────────────────────────────────

  private scoreDoc(doc: DocEntry, keywords: string[]): { score: number; matched: string[] } {
    let score = 0
    const matched: string[] = []
    const docText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase()

    for (const kw of keywords) {
      if (docText.includes(kw)) {
        score += 1
        // Title match bonus
        if (doc.title.toLowerCase().includes(kw)) score += 2
        // Tag match bonus
        if (doc.tags.some(t => t.toLowerCase().includes(kw))) score += 1.5
        matched.push(kw)
      }
    }

    return { score, matched }
  }

  private extractSnippet(content: string, keyword: string, maxLen: number = 120): string {
    const lower = content.toLowerCase()
    const idx = lower.indexOf(keyword.toLowerCase())
    if (idx === -1) return content.slice(0, maxLen)

    const start = Math.max(0, idx - 30)
    const end = Math.min(content.length, idx + keyword.length + 60)
    let snippet = content.slice(start, end).trim()
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet += '...'
    return snippet
  }
}

export const docSuggestionsService = new DocSuggestionsService()
