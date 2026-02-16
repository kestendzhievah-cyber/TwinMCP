import { ConversationSearchService } from '../../src/services/chat/conversation-search.service'

describe('ConversationSearchService', () => {
  let service: ConversationSearchService

  beforeEach(() => {
    service = new ConversationSearchService()
    service.indexConversation({
      id: 'c1', title: 'React hooks tutorial',
      messages: [
        { role: 'user', content: 'How do I use useState in React?', timestamp: '2025-01-01T10:00:00Z' },
        { role: 'assistant', content: 'useState is a React hook that lets you add state to functional components.', timestamp: '2025-01-01T10:01:00Z' },
      ],
      tags: ['react', 'frontend'], provider: 'openai', model: 'gpt-4',
      createdAt: '2025-01-01T10:00:00Z', updatedAt: '2025-01-01T10:01:00Z',
    })
    service.indexConversation({
      id: 'c2', title: 'Database optimization',
      messages: [
        { role: 'user', content: 'How to optimize SQL queries?', timestamp: '2025-01-02T10:00:00Z' },
        { role: 'assistant', content: 'Use indexes, avoid SELECT *, and analyze query plans.', timestamp: '2025-01-02T10:01:00Z' },
      ],
      tags: ['database', 'sql'], provider: 'anthropic', model: 'claude-3',
      createdAt: '2025-01-02T10:00:00Z', updatedAt: '2025-01-02T10:01:00Z',
    })
    service.indexConversation({
      id: 'c3', title: 'Docker deployment',
      messages: [
        { role: 'user', content: 'How to deploy with Docker?', timestamp: '2025-01-03T10:00:00Z' },
      ],
      tags: ['devops', 'docker'], provider: 'openai', model: 'gpt-4',
      createdAt: '2025-01-03T10:00:00Z', updatedAt: '2025-01-03T10:00:00Z',
    })
  })

  describe('Indexing', () => {
    it('indexes conversations', () => {
      expect(service.indexSize).toBe(3)
    })

    it('removes from index', () => {
      service.removeFromIndex('c1')
      expect(service.indexSize).toBe(2)
    })

    it('clears index', () => {
      service.clearIndex()
      expect(service.indexSize).toBe(0)
    })
  })

  describe('Search', () => {
    it('finds by title', () => {
      const result = service.search({ text: 'React' })
      expect(result.hits.length).toBe(1)
      expect(result.hits[0].conversationId).toBe('c1')
    })

    it('finds by message content', () => {
      const result = service.search({ text: 'useState' })
      expect(result.hits.length).toBe(1)
      expect(result.hits[0].matchedIn).toBe('message')
    })

    it('returns empty for no match', () => {
      const result = service.search({ text: 'kubernetes' })
      expect(result.hits.length).toBe(0)
    })

    it('returns empty for empty query', () => {
      const result = service.search({ text: '' })
      expect(result.hits.length).toBe(0)
    })

    it('deduplicates by conversation', () => {
      const result = service.search({ text: 'React' })
      const ids = result.hits.map(h => h.conversationId)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('highlights matches', () => {
      const result = service.search({ text: 'React' })
      expect(result.hits[0].highlightedSnippet).toContain('**React**')
    })

    it('reports duration', () => {
      const result = service.search({ text: 'React' })
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('respects limit and offset', () => {
      const result = service.search({ text: 'How', limit: 1, offset: 0 })
      expect(result.hits.length).toBe(1)
      expect(result.total).toBeGreaterThan(1)
    })
  })

  describe('Filters', () => {
    it('filters by tag', () => {
      const result = service.search({ text: 'How', filters: { tags: ['database'] } })
      expect(result.hits.length).toBe(1)
      expect(result.hits[0].conversationId).toBe('c2')
    })

    it('filters by provider', () => {
      const result = service.search({ text: 'How', filters: { provider: 'anthropic' } })
      expect(result.hits.length).toBe(1)
    })

    it('filters by role', () => {
      const result = service.search({ text: 'indexes', filters: { role: 'assistant' } })
      expect(result.hits.every(h => h.matchedIn === 'message' || h.matchedIn === 'title')).toBe(true)
    })
  })

  describe('Recent searches', () => {
    it('tracks recent searches', () => {
      service.search({ text: 'React' })
      service.search({ text: 'Docker' })
      expect(service.getRecentSearches()).toEqual(['Docker', 'React'])
    })

    it('deduplicates recent searches', () => {
      service.search({ text: 'React' })
      service.search({ text: 'React' })
      expect(service.getRecentSearches().length).toBe(1)
    })

    it('clears recent searches', () => {
      service.search({ text: 'React' })
      service.clearRecentSearches()
      expect(service.getRecentSearches().length).toBe(0)
    })
  })

  describe('Suggestions', () => {
    it('suggests from titles', () => {
      const suggestions = service.getSuggestions('React')
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('suggests from tags', () => {
      const suggestions = service.getSuggestions('front')
      expect(suggestions).toContain('frontend')
    })

    it('returns empty for short prefix', () => {
      expect(service.getSuggestions('R').length).toBe(0)
    })
  })
})
