import { DocSuggestionsService } from '../../src/services/chat/doc-suggestions.service'

describe('DocSuggestionsService', () => {
  let service: DocSuggestionsService

  beforeEach(() => {
    service = new DocSuggestionsService()
    service.addDoc({ id: 'd1', title: 'React useState Hook', url: 'https://react.dev/hooks/useState', content: 'useState is a React Hook that lets you add a state variable to your component.', tags: ['react', 'hooks'], library: 'react' })
    service.addDoc({ id: 'd2', title: 'Express.js Routing', url: 'https://expressjs.com/routing', content: 'Routing refers to how an application endpoints respond to client requests.', tags: ['express', 'node', 'api'], library: 'express' })
    service.addDoc({ id: 'd3', title: 'PostgreSQL Indexes', url: 'https://postgresql.org/indexes', content: 'Indexes are a common way to enhance database performance. An index on a column speeds up queries.', tags: ['postgresql', 'database', 'sql'], library: 'postgresql' })
    service.addDoc({ id: 'd4', title: 'Docker Compose', url: 'https://docs.docker.com/compose', content: 'Docker Compose is a tool for defining and running multi-container applications.', tags: ['docker', 'devops'], library: 'docker' })
  })

  describe('Doc registry', () => {
    it('adds and retrieves docs', () => {
      expect(service.docCount).toBe(4)
      expect(service.getDoc('d1')?.title).toBe('React useState Hook')
    })

    it('removes docs', () => {
      service.removeDoc('d1')
      expect(service.docCount).toBe(3)
    })

    it('lists all docs', () => {
      expect(service.getDocs().length).toBe(4)
    })
  })

  describe('Suggestions', () => {
    it('suggests docs based on keywords', () => {
      const result = service.suggest('How do I use useState in React?')
      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.suggestions[0].docId).toBe('d1')
    })

    it('suggests database docs', () => {
      const result = service.suggest('How to optimize SQL queries and indexes?')
      expect(result.suggestions.some(s => s.docId === 'd3')).toBe(true)
    })

    it('returns empty for irrelevant query', () => {
      const result = service.suggest('the the the')
      expect(result.suggestions.length).toBe(0)
    })

    it('extracts keywords', () => {
      const result = service.suggest('React hooks useState component')
      expect(result.keywords.length).toBeGreaterThan(0)
      expect(result.keywords).toContain('react')
    })

    it('includes snippet', () => {
      const result = service.suggest('React useState')
      expect(result.suggestions[0].snippet.length).toBeGreaterThan(0)
    })

    it('includes library info', () => {
      const result = service.suggest('React useState')
      expect(result.suggestions[0].library).toBe('react')
    })

    it('respects maxResults', () => {
      const result = service.suggest('application', 2)
      expect(result.suggestions.length).toBeLessThanOrEqual(2)
    })

    it('reports duration', () => {
      const result = service.suggest('React')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Conversation context', () => {
    it('suggests from multiple messages', () => {
      const result = service.suggestFromConversation([
        { role: 'user', content: 'I need help with React hooks' },
        { role: 'assistant', content: 'Sure, which hook?' },
        { role: 'user', content: 'useState for managing component state' },
      ])
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Feedback', () => {
    it('records clicks and boosts relevance', () => {
      service.recordClick('d2')
      service.recordClick('d2')
      expect(service.getClickCount('d2')).toBe(2)
    })

    it('clears click history', () => {
      service.recordClick('d1')
      service.clearClickHistory()
      expect(service.getClickCount('d1')).toBe(0)
    })
  })

  describe('Keyword extraction', () => {
    it('extracts meaningful keywords', () => {
      const kw = service.extractKeywords('How to create a React component with useState hook')
      expect(kw).toContain('react')
      expect(kw).toContain('component')
      expect(kw).not.toContain('how')
      expect(kw).not.toContain('to')
    })

    it('filters French stop words', () => {
      const kw = service.extractKeywords('Comment faire une requête dans la base de données')
      expect(kw).not.toContain('dans')
      expect(kw).not.toContain('comment')
    })

    it('returns empty for only stop words', () => {
      const kw = service.extractKeywords('the a an is are')
      expect(kw.length).toBe(0)
    })
  })
})
