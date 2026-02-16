/**
 * Multi-Source Crawler Service.
 *
 * Crawls documentation from multiple sources with a unified output format:
 *   - External documentation websites (HTML → unified)
 *   - Stack Overflow Q&A (API → unified)
 *   - GitHub README/Wiki (API → unified)
 *   - NPM package docs
 *
 * All sources produce UnifiedDocument objects for downstream indexing.
 */

export interface CrawlSource {
  id: string
  type: 'website' | 'stackoverflow' | 'github' | 'npm'
  url: string
  config?: Record<string, any>
}

export interface UnifiedDocument {
  id: string
  sourceId: string
  sourceType: string
  url: string
  title: string
  content: string
  contentType: 'documentation' | 'tutorial' | 'api-reference' | 'qa' | 'readme' | 'wiki'
  language: string
  metadata: Record<string, any>
  crawledAt: string
  contentHash: string
}

export interface CrawlResult {
  sourceId: string
  documents: UnifiedDocument[]
  errors: string[]
  duration: number
  stats: { fetched: number; parsed: number; failed: number }
}

export type FetchFn = (url: string) => Promise<{ status: number; text: string; headers?: Record<string, string> }>

export class MultiSourceCrawlerService {
  private sources: Map<string, CrawlSource> = new Map()
  private fetchFn: FetchFn | null = null
  private crawledDocuments: Map<string, UnifiedDocument> = new Map()
  private idCounter = 0

  /** Set the fetch function (for DI / testing). */
  setFetchFn(fn: FetchFn): void {
    this.fetchFn = fn
  }

  // ── Source Management ──────────────────────────────────────

  addSource(source: CrawlSource): void {
    this.sources.set(source.id, source)
  }

  removeSource(id: string): boolean {
    return this.sources.delete(id)
  }

  getSource(id: string): CrawlSource | undefined {
    return this.sources.get(id)
  }

  getSources(): CrawlSource[] {
    return Array.from(this.sources.values())
  }

  // ── Crawling ───────────────────────────────────────────────

  /** Crawl a single source. */
  async crawl(sourceId: string): Promise<CrawlResult> {
    const source = this.sources.get(sourceId)
    if (!source) throw new Error(`Source not found: ${sourceId}`)

    const start = Date.now()
    const result: CrawlResult = {
      sourceId,
      documents: [],
      errors: [],
      duration: 0,
      stats: { fetched: 0, parsed: 0, failed: 0 },
    }

    try {
      switch (source.type) {
        case 'website':
          await this.crawlWebsite(source, result)
          break
        case 'stackoverflow':
          await this.crawlStackOverflow(source, result)
          break
        case 'github':
          await this.crawlGitHub(source, result)
          break
        case 'npm':
          await this.crawlNpm(source, result)
          break
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err))
    }

    result.duration = Date.now() - start

    // Store crawled documents
    for (const doc of result.documents) {
      this.crawledDocuments.set(doc.id, doc)
    }

    return result
  }

  /** Crawl all registered sources. */
  async crawlAll(): Promise<CrawlResult[]> {
    const results: CrawlResult[] = []
    for (const source of this.sources.values()) {
      results.push(await this.crawl(source.id))
    }
    return results
  }

  /** Get all crawled documents. */
  getDocuments(): UnifiedDocument[] {
    return Array.from(this.crawledDocuments.values())
  }

  /** Get documents by source. */
  getDocumentsBySource(sourceId: string): UnifiedDocument[] {
    return this.getDocuments().filter(d => d.sourceId === sourceId)
  }

  /** Get total document count. */
  get documentCount(): number {
    return this.crawledDocuments.size
  }

  // ── Website Crawler ────────────────────────────────────────

  private async crawlWebsite(source: CrawlSource, result: CrawlResult): Promise<void> {
    if (!this.fetchFn) throw new Error('No fetch function configured')

    const maxPages = source.config?.maxPages || 10
    const visited = new Set<string>()
    const queue = [source.url]

    while (queue.length > 0 && visited.size < maxPages) {
      const url = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      try {
        const response = await this.fetchFn(url)
        result.stats.fetched++

        if (response.status !== 200) {
          result.stats.failed++
          continue
        }

        const doc = this.parseHtmlToUnified(source, url, response.text)
        result.documents.push(doc)
        result.stats.parsed++

        // Extract links for further crawling
        const links = this.extractLinks(response.text, url)
        for (const link of links) {
          if (!visited.has(link) && this.isSameDomain(link, source.url)) {
            queue.push(link)
          }
        }
      } catch (err) {
        result.stats.failed++
        result.errors.push(`Failed to crawl ${url}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // ── Stack Overflow Crawler ─────────────────────────────────

  private async crawlStackOverflow(source: CrawlSource, result: CrawlResult): Promise<void> {
    if (!this.fetchFn) throw new Error('No fetch function configured')

    const tag = source.config?.tag || source.url.split('/').pop() || 'javascript'
    const pageSize = source.config?.pageSize || 10
    const apiUrl = `https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&tagged=${encodeURIComponent(tag)}&site=stackoverflow&pagesize=${pageSize}&filter=withbody`

    try {
      const response = await this.fetchFn(apiUrl)
      result.stats.fetched++

      if (response.status !== 200) {
        result.stats.failed++
        return
      }

      const data = JSON.parse(response.text)
      const items = data.items || []

      for (const item of items) {
        const doc: UnifiedDocument = {
          id: `doc-${++this.idCounter}`,
          sourceId: source.id,
          sourceType: 'stackoverflow',
          url: item.link || `https://stackoverflow.com/questions/${item.question_id}`,
          title: item.title || 'Untitled',
          content: this.stripHtml(item.body || ''),
          contentType: 'qa',
          language: 'en',
          metadata: {
            score: item.score,
            answerCount: item.answer_count,
            tags: item.tags,
            isAnswered: item.is_answered,
          },
          crawledAt: new Date().toISOString(),
          contentHash: this.hash(item.body || ''),
        }
        result.documents.push(doc)
        result.stats.parsed++
      }
    } catch (err) {
      result.stats.failed++
      result.errors.push(`Stack Overflow crawl failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── GitHub Crawler ─────────────────────────────────────────

  private async crawlGitHub(source: CrawlSource, result: CrawlResult): Promise<void> {
    if (!this.fetchFn) throw new Error('No fetch function configured')

    // Parse owner/repo from URL
    const match = source.url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      result.errors.push('Invalid GitHub URL')
      return
    }

    const [, owner, repo] = match
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`

    // Fetch README
    try {
      const readmeResp = await this.fetchFn(`${apiBase}/readme`)
      result.stats.fetched++

      if (readmeResp.status === 200) {
        const readmeData = JSON.parse(readmeResp.text)
        const content = Buffer.from(readmeData.content || '', 'base64').toString('utf-8')

        result.documents.push({
          id: `doc-${++this.idCounter}`,
          sourceId: source.id,
          sourceType: 'github',
          url: readmeData.html_url || source.url,
          title: `${owner}/${repo} README`,
          content,
          contentType: 'readme',
          language: 'en',
          metadata: { owner, repo, type: 'readme' },
          crawledAt: new Date().toISOString(),
          contentHash: this.hash(content),
        })
        result.stats.parsed++
      }
    } catch (err) {
      result.stats.failed++
      result.errors.push(`GitHub README fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Fetch wiki pages if configured
    if (source.config?.includeWiki) {
      try {
        const wikiResp = await this.fetchFn(`${apiBase}/wiki`)
        result.stats.fetched++

        if (wikiResp.status === 200) {
          const pages = JSON.parse(wikiResp.text)
          for (const page of (Array.isArray(pages) ? pages : [])) {
            result.documents.push({
              id: `doc-${++this.idCounter}`,
              sourceId: source.id,
              sourceType: 'github',
              url: page.html_url || source.url,
              title: page.title || 'Wiki Page',
              content: page.content || page.body || '',
              contentType: 'wiki',
              language: 'en',
              metadata: { owner, repo, type: 'wiki' },
              crawledAt: new Date().toISOString(),
              contentHash: this.hash(page.content || ''),
            })
            result.stats.parsed++
          }
        }
      } catch {
        // Wiki not available, skip
      }
    }
  }

  // ── NPM Crawler ────────────────────────────────────────────

  private async crawlNpm(source: CrawlSource, result: CrawlResult): Promise<void> {
    if (!this.fetchFn) throw new Error('No fetch function configured')

    const packageName = source.config?.packageName || source.url.split('/').pop() || ''
    const apiUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`

    try {
      const response = await this.fetchFn(apiUrl)
      result.stats.fetched++

      if (response.status !== 200) {
        result.stats.failed++
        return
      }

      const data = JSON.parse(response.text)
      const readme = data.readme || ''

      result.documents.push({
        id: `doc-${++this.idCounter}`,
        sourceId: source.id,
        sourceType: 'npm',
        url: `https://www.npmjs.com/package/${packageName}`,
        title: `${data.name || packageName} - NPM`,
        content: readme,
        contentType: 'documentation',
        language: 'en',
        metadata: {
          name: data.name,
          version: data['dist-tags']?.latest,
          description: data.description,
          keywords: data.keywords,
          license: data.license,
        },
        crawledAt: new Date().toISOString(),
        contentHash: this.hash(readme),
      })
      result.stats.parsed++
    } catch (err) {
      result.stats.failed++
      result.errors.push(`NPM crawl failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private parseHtmlToUnified(source: CrawlSource, url: string, html: string): UnifiedDocument {
    const title = this.extractTitle(html)
    const content = this.stripHtml(html)

    return {
      id: `doc-${++this.idCounter}`,
      sourceId: source.id,
      sourceType: 'website',
      url,
      title,
      content,
      contentType: 'documentation',
      language: 'en',
      metadata: {},
      crawledAt: new Date().toISOString(),
      contentHash: this.hash(content),
    }
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
    return match ? match[1].trim() : 'Untitled'
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = []
    const regex = /href=["']([^"']+)["']/gi
    let match
    while ((match = regex.exec(html)) !== null) {
      try {
        const resolved = new URL(match[1], baseUrl).href
        if (resolved.startsWith('http')) links.push(resolved)
      } catch { /* skip invalid URLs */ }
    }
    return [...new Set(links)]
  }

  private isSameDomain(url: string, baseUrl: string): boolean {
    try {
      return new URL(url).hostname === new URL(baseUrl).hostname
    } catch { return false }
  }

  private hash(content: string): string {
    let h = 0
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) - h + content.charCodeAt(i)) | 0
    }
    return Math.abs(h).toString(16)
  }
}

export const multiSourceCrawlerService = new MultiSourceCrawlerService()
