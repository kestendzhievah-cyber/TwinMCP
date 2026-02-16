import { AutocompleteService } from '../../src/services/library/autocomplete.service'

describe('AutocompleteService', () => {
  let service: AutocompleteService

  beforeEach(() => {
    service = new AutocompleteService()
    service.index({ id: 'react', name: 'react', description: 'A JavaScript library for building UIs', popularity: 100000, tags: ['ui', 'frontend'] })
    service.index({ id: 'react-dom', name: 'react-dom', description: 'React DOM rendering', popularity: 90000, tags: ['ui', 'dom'] })
    service.index({ id: 'react-router', name: 'react-router', description: 'Routing for React', popularity: 50000, tags: ['routing'] })
    service.index({ id: 'redux', name: 'redux', description: 'State management', popularity: 60000, tags: ['state'] })
    service.index({ id: 'express', name: 'express', description: 'Web framework for Node.js', popularity: 80000, tags: ['server', 'http'] })
    service.index({ id: 'lodash', name: 'lodash', description: 'Utility library', popularity: 70000, tags: ['utility'] })
  })

  describe('Indexing', () => {
    it('tracks indexed entries', () => {
      expect(service.size).toBe(6)
    })

    it('removes entries', () => {
      expect(service.remove('lodash')).toBe(true)
      expect(service.size).toBe(5)
    })

    it('returns false for unknown removal', () => {
      expect(service.remove('unknown')).toBe(false)
    })
  })

  describe('Prefix matching', () => {
    it('returns exact match first', () => {
      const results = service.suggest('react')
      expect(results[0].name).toBe('react')
      expect(results[0].matchType).toBe('exact')
    })

    it('returns prefix matches for partial query', () => {
      const results = service.suggest('rea')
      expect(results.length).toBeGreaterThanOrEqual(3) // react, react-dom, react-router
      expect(results.every(r => r.name.startsWith('rea'))).toBe(true)
    })

    it('returns empty for empty query', () => {
      expect(service.suggest('')).toEqual([])
    })
  })

  describe('Fuzzy matching', () => {
    it('finds fuzzy matches for typos', () => {
      const results = service.suggest('recat', 10)
      // Should find 'react' via fuzzy matching
      const reactResult = results.find(r => r.name === 'react')
      expect(reactResult).toBeDefined()
      expect(reactResult?.matchType).toBe('fuzzy')
    })
  })

  describe('Tag matching', () => {
    it('matches by tag prefix', () => {
      const results = service.suggest('serv', 10)
      // 'express' has tag 'server' which starts with 'serv'
      const expressResult = results.find(r => r.name === 'express')
      expect(expressResult).toBeDefined()
    })
  })

  describe('Ranking', () => {
    it('ranks more popular libraries higher for same match type', () => {
      const results = service.suggest('react')
      // react (100k) should rank above react-dom (90k) and react-router (50k)
      const reactIdx = results.findIndex(r => r.name === 'react')
      const routerIdx = results.findIndex(r => r.name === 'react-router')
      if (reactIdx !== -1 && routerIdx !== -1) {
        expect(reactIdx).toBeLessThan(routerIdx)
      }
    })

    it('respects limit', () => {
      const results = service.suggest('r', 2)
      expect(results.length).toBeLessThanOrEqual(2)
    })
  })
})
