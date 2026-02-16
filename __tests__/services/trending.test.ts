import { TrendingService } from '../../src/services/library/trending.service'

describe('TrendingService', () => {
  let service: TrendingService

  beforeEach(() => {
    service = new TrendingService()
  })

  describe('Library management', () => {
    it('upserts and retrieves libraries', () => {
      service.upsertLibrary({
        id: 'react', name: 'React', weeklyDownloads: 10000,
        previousWeekDownloads: 8000, monthlyDownloads: 40000,
        stars: 200000, searchCount: 500, lastUpdated: new Date().toISOString(), tags: ['ui'],
      })
      expect(service.getLibrary('react')).toBeDefined()
      expect(service.getAllLibraries().length).toBe(1)
    })
  })

  describe('Trending', () => {
    beforeEach(() => {
      service.upsertLibrary({
        id: 'fast-lib', name: 'fast-lib', weeklyDownloads: 5000,
        previousWeekDownloads: 1000, monthlyDownloads: 10000,
        stars: 500, searchCount: 100, lastUpdated: new Date().toISOString(), tags: ['fast'],
      })
      service.upsertLibrary({
        id: 'stable-lib', name: 'stable-lib', weeklyDownloads: 10000,
        previousWeekDownloads: 10000, monthlyDownloads: 40000,
        stars: 50000, searchCount: 200, lastUpdated: new Date().toISOString(), tags: ['stable'],
      })
      service.upsertLibrary({
        id: 'old-lib', name: 'old-lib', weeklyDownloads: 100,
        previousWeekDownloads: 200, monthlyDownloads: 500,
        stars: 1000, searchCount: 5, lastUpdated: '2020-01-01T00:00:00Z', tags: ['legacy'],
      })
    })

    it('returns trending libraries sorted by score', () => {
      const trending = service.getTrending(10)
      expect(trending.length).toBe(3)
      // fast-lib has 5x velocity, should rank high
      expect(trending[0].library.id).toBe('fast-lib')
      expect(trending[0].velocity).toBe(5)
    })

    it('respects limit', () => {
      const trending = service.getTrending(1)
      expect(trending.length).toBe(1)
    })

    it('getRising returns only growing libraries', () => {
      const rising = service.getRising(10)
      // fast-lib (5x) and stable-lib (1x) qualify; old-lib (0.5x) doesn't
      expect(rising.every(r => r.velocity > 1.0)).toBe(true)
    })
  })

  describe('Comparison', () => {
    beforeEach(() => {
      service.upsertLibrary({
        id: 'a', name: 'LibA', weeklyDownloads: 10000,
        previousWeekDownloads: 5000, monthlyDownloads: 30000,
        stars: 20000, searchCount: 300, lastUpdated: new Date().toISOString(), tags: [],
      })
      service.upsertLibrary({
        id: 'b', name: 'LibB', weeklyDownloads: 5000,
        previousWeekDownloads: 5000, monthlyDownloads: 20000,
        stars: 10000, searchCount: 100, lastUpdated: '2024-06-01T00:00:00Z', tags: [],
      })
    })

    it('compares two libraries across dimensions', () => {
      const result = service.compare(['a', 'b'])
      expect(result.libraries.length).toBe(2)
      expect(result.dimensions.popularity.a).toBeGreaterThan(result.dimensions.popularity.b)
      expect(result.dimensions.growth.a).toBeGreaterThan(result.dimensions.growth.b)
      expect(result.recommendation).toContain('LibA')
    })

    it('handles unknown library IDs gracefully', () => {
      const result = service.compare(['unknown'])
      expect(result.libraries.length).toBe(0)
    })

    it('works with a single library', () => {
      const result = service.compare(['a'])
      expect(result.libraries.length).toBe(1)
      expect(result.recommendation).toBeUndefined()
    })
  })
})
