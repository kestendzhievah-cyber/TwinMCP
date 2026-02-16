/**
 * Autocomplete Search Service.
 *
 * Provides fast prefix-based and fuzzy autocomplete for library search.
 * Uses a trie data structure for O(k) prefix lookups where k = query length,
 * with fallback to fuzzy matching for typo tolerance.
 *
 * Features:
 *   - Trie-based prefix matching
 *   - Fuzzy matching with Levenshtein distance
 *   - Weighted results by popularity
 *   - Debounce-friendly (designed for keystroke-by-keystroke queries)
 */

export interface AutocompleteEntry {
  id: string
  name: string
  displayName?: string
  description?: string
  popularity: number // higher = more popular
  tags: string[]
}

export interface AutocompleteResult {
  id: string
  name: string
  displayName?: string
  description?: string
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'tag'
  score: number
}

interface TrieNode {
  children: Map<string, TrieNode>
  entries: AutocompleteEntry[]
  isEnd: boolean
}

export class AutocompleteService {
  private root: TrieNode = { children: new Map(), entries: [], isEnd: false }
  private allEntries: Map<string, AutocompleteEntry> = new Map()

  /** Index a library for autocomplete. */
  index(entry: AutocompleteEntry): void {
    this.allEntries.set(entry.id, entry)
    this.insertTrie(entry.name.toLowerCase(), entry)

    // Also index tags
    for (const tag of entry.tags) {
      this.insertTrie(tag.toLowerCase(), entry)
    }
  }

  /** Remove a library from the index. */
  remove(id: string): boolean {
    const entry = this.allEntries.get(id)
    if (!entry) return false
    this.allEntries.delete(id)
    // Rebuild trie (simple approach; production would use a more efficient removal)
    this.rebuildTrie()
    return true
  }

  /** Get the number of indexed entries. */
  get size(): number {
    return this.allEntries.size
  }

  /**
   * Search for autocomplete suggestions.
   * Returns results ranked by match quality and popularity.
   */
  suggest(query: string, limit: number = 10): AutocompleteResult[] {
    if (!query || query.length === 0) return []

    const q = query.toLowerCase().trim()
    const results: Map<string, AutocompleteResult> = new Map()

    // 1. Exact matches
    for (const entry of this.allEntries.values()) {
      if (entry.name.toLowerCase() === q) {
        results.set(entry.id, {
          id: entry.id,
          name: entry.name,
          displayName: entry.displayName,
          description: entry.description,
          matchType: 'exact',
          score: 1.0 + this.popularityBoost(entry),
        })
      }
    }

    // 2. Prefix matches from trie
    const prefixEntries = this.searchTrie(q)
    for (const entry of prefixEntries) {
      if (!results.has(entry.id)) {
        results.set(entry.id, {
          id: entry.id,
          name: entry.name,
          displayName: entry.displayName,
          description: entry.description,
          matchType: 'prefix',
          score: 0.8 + this.popularityBoost(entry),
        })
      }
    }

    // 3. Fuzzy matches (if we don't have enough results)
    if (results.size < limit && q.length >= 2) {
      for (const entry of this.allEntries.values()) {
        if (results.has(entry.id)) continue
        const distance = this.levenshtein(q, entry.name.toLowerCase())
        const maxLen = Math.max(q.length, entry.name.length)
        const similarity = 1 - distance / maxLen

        if (similarity >= 0.5) {
          results.set(entry.id, {
            id: entry.id,
            name: entry.name,
            displayName: entry.displayName,
            description: entry.description,
            matchType: 'fuzzy',
            score: similarity * 0.6 + this.popularityBoost(entry),
          })
        }
      }
    }

    // 4. Tag matches
    if (results.size < limit) {
      for (const entry of this.allEntries.values()) {
        if (results.has(entry.id)) continue
        const tagMatch = entry.tags.some(t => t.toLowerCase().startsWith(q))
        if (tagMatch) {
          results.set(entry.id, {
            id: entry.id,
            name: entry.name,
            displayName: entry.displayName,
            description: entry.description,
            matchType: 'tag',
            score: 0.5 + this.popularityBoost(entry),
          })
        }
      }
    }

    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  // ── Trie Operations ────────────────────────────────────────

  private insertTrie(key: string, entry: AutocompleteEntry): void {
    let node = this.root
    for (const char of key) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), entries: [], isEnd: false })
      }
      node = node.children.get(char)!
    }
    node.isEnd = true
    if (!node.entries.some(e => e.id === entry.id)) {
      node.entries.push(entry)
    }
  }

  private searchTrie(prefix: string): AutocompleteEntry[] {
    let node = this.root
    for (const char of prefix) {
      if (!node.children.has(char)) return []
      node = node.children.get(char)!
    }
    // Collect all entries under this prefix
    return this.collectEntries(node)
  }

  private collectEntries(node: TrieNode, maxResults: number = 50): AutocompleteEntry[] {
    const results: AutocompleteEntry[] = [...node.entries]
    if (results.length >= maxResults) return results.slice(0, maxResults)

    for (const child of node.children.values()) {
      results.push(...this.collectEntries(child, maxResults - results.length))
      if (results.length >= maxResults) break
    }

    return results.slice(0, maxResults)
  }

  private rebuildTrie(): void {
    this.root = { children: new Map(), entries: [], isEnd: false }
    for (const entry of this.allEntries.values()) {
      this.insertTrie(entry.name.toLowerCase(), entry)
      for (const tag of entry.tags) {
        this.insertTrie(tag.toLowerCase(), entry)
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private popularityBoost(entry: AutocompleteEntry): number {
    return Math.min(Math.log10(Math.max(entry.popularity, 1) + 1) / 10, 0.2)
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        )
      }
    }

    return dp[m][n]
  }
}

export const autocompleteService = new AutocompleteService()
