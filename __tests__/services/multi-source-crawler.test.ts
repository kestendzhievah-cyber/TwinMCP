import { MultiSourceCrawlerService } from '../../src/services/crawling/multi-source-crawler.service'

describe('MultiSourceCrawlerService', () => {
  let service: MultiSourceCrawlerService

  beforeEach(() => {
    service = new MultiSourceCrawlerService()
  })

  describe('Source management', () => {
    it('adds and lists sources', () => {
      service.addSource({ id: 's1', type: 'website', url: 'https://docs.example.com' })
      service.addSource({ id: 's2', type: 'stackoverflow', url: 'https://stackoverflow.com/questions/tagged/react' })
      expect(service.getSources().length).toBe(2)
    })

    it('gets a source by ID', () => {
      service.addSource({ id: 's1', type: 'website', url: 'https://example.com' })
      expect(service.getSource('s1')?.type).toBe('website')
    })

    it('removes a source', () => {
      service.addSource({ id: 's1', type: 'website', url: 'https://example.com' })
      expect(service.removeSource('s1')).toBe(true)
      expect(service.getSources().length).toBe(0)
    })
  })

  describe('Website crawling', () => {
    it('crawls a website and produces unified documents', async () => {
      service.addSource({ id: 'web1', type: 'website', url: 'https://docs.example.com', config: { maxPages: 2 } })
      service.setFetchFn(async (url) => ({
        status: 200,
        text: `<html><head><title>Docs Page</title></head><body><h1>Hello</h1><p>Documentation content here.</p><a href="/page2">Next</a></body></html>`,
      }))

      const result = await service.crawl('web1')
      expect(result.documents.length).toBeGreaterThan(0)
      expect(result.stats.fetched).toBeGreaterThan(0)
      expect(result.stats.parsed).toBeGreaterThan(0)
      expect(result.documents[0].sourceType).toBe('website')
      expect(result.documents[0].contentType).toBe('documentation')
      expect(result.documents[0].title).toBe('Docs Page')
    })

    it('handles fetch errors gracefully', async () => {
      service.addSource({ id: 'web1', type: 'website', url: 'https://example.com', config: { maxPages: 1 } })
      service.setFetchFn(async () => ({ status: 500, text: '' }))

      const result = await service.crawl('web1')
      expect(result.stats.failed).toBeGreaterThan(0)
    })
  })

  describe('Stack Overflow crawling', () => {
    it('crawls Stack Overflow questions', async () => {
      service.addSource({ id: 'so1', type: 'stackoverflow', url: 'https://stackoverflow.com/questions/tagged/react', config: { tag: 'react', pageSize: 2 } })
      service.setFetchFn(async () => ({
        status: 200,
        text: JSON.stringify({
          items: [
            { question_id: 1, title: 'How to use React hooks?', body: '<p>I want to use hooks</p>', score: 42, answer_count: 5, tags: ['react', 'hooks'], is_answered: true, link: 'https://stackoverflow.com/q/1' },
            { question_id: 2, title: 'React state management', body: '<p>Best practices for state</p>', score: 30, answer_count: 3, tags: ['react', 'state'], is_answered: true, link: 'https://stackoverflow.com/q/2' },
          ],
        }),
      }))

      const result = await service.crawl('so1')
      expect(result.documents.length).toBe(2)
      expect(result.documents[0].contentType).toBe('qa')
      expect(result.documents[0].metadata.score).toBe(42)
    })
  })

  describe('GitHub crawling', () => {
    it('crawls GitHub README', async () => {
      service.addSource({ id: 'gh1', type: 'github', url: 'https://github.com/facebook/react' })
      service.setFetchFn(async (url) => {
        if (url.includes('/readme')) {
          return {
            status: 200,
            text: JSON.stringify({
              content: Buffer.from('# React\n\nA JavaScript library for building UIs').toString('base64'),
              html_url: 'https://github.com/facebook/react/blob/main/README.md',
            }),
          }
        }
        return { status: 404, text: '' }
      })

      const result = await service.crawl('gh1')
      expect(result.documents.length).toBe(1)
      expect(result.documents[0].contentType).toBe('readme')
      expect(result.documents[0].content).toContain('React')
    })
  })

  describe('NPM crawling', () => {
    it('crawls NPM package info', async () => {
      service.addSource({ id: 'npm1', type: 'npm', url: 'https://npmjs.com/package/express', config: { packageName: 'express' } })
      service.setFetchFn(async () => ({
        status: 200,
        text: JSON.stringify({
          name: 'express',
          description: 'Fast web framework',
          readme: '# Express\n\nFast, unopinionated, minimalist web framework for Node.js',
          'dist-tags': { latest: '4.18.2' },
          keywords: ['web', 'framework'],
          license: 'MIT',
        }),
      }))

      const result = await service.crawl('npm1')
      expect(result.documents.length).toBe(1)
      expect(result.documents[0].sourceType).toBe('npm')
      expect(result.documents[0].metadata.version).toBe('4.18.2')
    })
  })

  describe('Crawl all', () => {
    it('crawls all registered sources', async () => {
      service.addSource({ id: 's1', type: 'npm', url: 'https://npmjs.com/package/lodash', config: { packageName: 'lodash' } })
      service.addSource({ id: 's2', type: 'npm', url: 'https://npmjs.com/package/react', config: { packageName: 'react' } })
      service.setFetchFn(async (url) => ({
        status: 200,
        text: JSON.stringify({ name: url.includes('lodash') ? 'lodash' : 'react', readme: 'README content', 'dist-tags': { latest: '1.0.0' } }),
      }))

      const results = await service.crawlAll()
      expect(results.length).toBe(2)
      expect(service.documentCount).toBe(2)
    })
  })

  describe('Unified document format', () => {
    it('all documents have required fields', async () => {
      service.addSource({ id: 'npm1', type: 'npm', url: 'https://npmjs.com/package/test', config: { packageName: 'test' } })
      service.setFetchFn(async () => ({
        status: 200,
        text: JSON.stringify({ name: 'test', readme: 'Test readme', 'dist-tags': { latest: '1.0.0' } }),
      }))

      await service.crawl('npm1')
      const docs = service.getDocuments()
      expect(docs.length).toBe(1)

      const doc = docs[0]
      expect(doc.id).toBeDefined()
      expect(doc.sourceId).toBe('npm1')
      expect(doc.sourceType).toBe('npm')
      expect(doc.url).toBeDefined()
      expect(doc.title).toBeDefined()
      expect(doc.content).toBeDefined()
      expect(doc.contentType).toBeDefined()
      expect(doc.language).toBeDefined()
      expect(doc.crawledAt).toBeDefined()
      expect(doc.contentHash).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('throws for unknown source', async () => {
      await expect(service.crawl('unknown')).rejects.toThrow('Source not found')
    })

    it('reports error without fetch function', async () => {
      service.addSource({ id: 's1', type: 'website', url: 'https://example.com', config: { maxPages: 1 } })
      const result = await service.crawl('s1')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('No fetch function')
    })
  })
})
