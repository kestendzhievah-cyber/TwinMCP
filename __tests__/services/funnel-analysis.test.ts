import { FunnelAnalysisService } from '../../src/services/analytics/funnel-analysis.service'

describe('FunnelAnalysisService', () => {
  let service: FunnelAnalysisService

  beforeEach(() => {
    service = new FunnelAnalysisService()
  })

  describe('Funnel definition', () => {
    it('creates a funnel', () => {
      const f = service.createFunnel('Signup Flow', [
        { name: 'Visit', eventName: 'page_view' },
        { name: 'Register', eventName: 'signup' },
        { name: 'Activate', eventName: 'first_action' },
      ])
      expect(f.steps.length).toBe(3)
      expect(f.steps[0].order).toBe(0)
    })

    it('gets and lists funnels', () => {
      const f = service.createFunnel('Test', [{ name: 'A', eventName: 'a' }])
      expect(service.getFunnel(f.id)).toBeDefined()
      expect(service.getFunnels().length).toBe(1)
    })

    it('removes a funnel', () => {
      const f = service.createFunnel('Test', [{ name: 'A', eventName: 'a' }])
      expect(service.removeFunnel(f.id)).toBe(true)
      expect(service.getFunnels().length).toBe(0)
    })
  })

  describe('Event tracking', () => {
    it('tracks events', () => {
      const f = service.createFunnel('Test', [{ name: 'A', eventName: 'a' }])
      service.trackEvent('user-1', f.id, f.steps[0].id)
      expect(service.totalEvents).toBe(1)
    })

    it('tracks by event name across funnels', () => {
      const f = service.createFunnel('Test', [{ name: 'Visit', eventName: 'page_view' }])
      const count = service.trackByEventName('user-1', 'page_view')
      expect(count).toBe(1)
      expect(service.getEvents(f.id).length).toBe(1)
    })
  })

  describe('Analysis', () => {
    let funnelId: string
    let steps: Array<{ id: string }>

    beforeEach(() => {
      const f = service.createFunnel('Onboarding', [
        { name: 'Visit', eventName: 'visit' },
        { name: 'Signup', eventName: 'signup' },
        { name: 'Activate', eventName: 'activate' },
      ])
      funnelId = f.id
      steps = f.steps

      // 10 users visit
      for (let i = 0; i < 10; i++) service.trackEvent(`u${i}`, funnelId, steps[0].id)
      // 7 sign up
      for (let i = 0; i < 7; i++) service.trackEvent(`u${i}`, funnelId, steps[1].id)
      // 4 activate
      for (let i = 0; i < 4; i++) service.trackEvent(`u${i}`, funnelId, steps[2].id)
    })

    it('calculates overall conversion', () => {
      const report = service.analyze(funnelId)
      expect(report.totalUsers).toBe(10)
      expect(report.completedUsers).toBe(4)
      expect(report.overallConversionRate).toBeCloseTo(0.4)
    })

    it('calculates per-step metrics', () => {
      const report = service.analyze(funnelId)
      expect(report.steps.length).toBe(3)
      expect(report.steps[0].completed).toBe(10)
      expect(report.steps[1].completed).toBe(7)
      expect(report.steps[2].completed).toBe(4)
    })

    it('identifies biggest drop-off', () => {
      const report = service.analyze(funnelId)
      expect(report.biggestDropOff).toBeDefined()
    })

    it('returns empty report for unknown funnel', () => {
      const report = service.analyze('unknown')
      expect(report.totalUsers).toBe(0)
    })
  })

  describe('Comparison', () => {
    it('compares two funnels', () => {
      const f1 = service.createFunnel('A', [{ name: 'S1', eventName: 's1' }, { name: 'S2', eventName: 's2' }])
      const f2 = service.createFunnel('B', [{ name: 'S1', eventName: 's1' }, { name: 'S2', eventName: 's2' }])

      for (let i = 0; i < 10; i++) service.trackEvent(`u${i}`, f1.id, f1.steps[0].id)
      for (let i = 0; i < 8; i++) service.trackEvent(`u${i}`, f1.id, f1.steps[1].id)
      for (let i = 0; i < 10; i++) service.trackEvent(`u${i}`, f2.id, f2.steps[0].id)
      for (let i = 0; i < 5; i++) service.trackEvent(`u${i}`, f2.id, f2.steps[1].id)

      const comparison = service.compare(f1.id, f2.id)
      expect(comparison.betterFunnel).toBe('A')
      expect(comparison.conversionDiff).toBeGreaterThan(0)
    })
  })
})
