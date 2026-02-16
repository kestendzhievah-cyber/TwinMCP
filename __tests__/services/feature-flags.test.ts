import { FeatureFlagsService } from '../../src/services/analytics/feature-flags.service'

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService

  beforeEach(() => {
    service = new FeatureFlagsService()
  })

  describe('Feature flags', () => {
    it('creates a flag', () => {
      const f = service.createFlag('new-ui', 'New UI', { description: 'Redesigned interface' })
      expect(f.key).toBe('new-ui')
      expect(f.enabled).toBe(false)
    })

    it('enables and disables flags', () => {
      service.createFlag('test', 'Test')
      expect(service.enableFlag('test')).toBe(true)
      expect(service.getFlag('test')!.enabled).toBe(true)
      expect(service.disableFlag('test')).toBe(true)
      expect(service.getFlag('test')!.enabled).toBe(false)
    })

    it('sets rollout percentage', () => {
      service.createFlag('test', 'Test')
      service.setRollout('test', 50)
      expect(service.getFlag('test')!.rolloutPercentage).toBe(50)
    })

    it('clamps rollout to 0-100', () => {
      service.createFlag('test', 'Test')
      service.setRollout('test', 150)
      expect(service.getFlag('test')!.rolloutPercentage).toBe(100)
      service.setRollout('test', -10)
      expect(service.getFlag('test')!.rolloutPercentage).toBe(0)
    })

    it('lists and removes flags', () => {
      service.createFlag('a', 'A')
      service.createFlag('b', 'B')
      expect(service.getFlags().length).toBe(2)
      service.removeFlag('a')
      expect(service.flagCount).toBe(1)
    })
  })

  describe('Flag evaluation', () => {
    it('returns disabled for unknown flag', () => {
      const result = service.evaluate('unknown', 'user-1')
      expect(result.enabled).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('returns disabled for disabled flag', () => {
      service.createFlag('test', 'Test')
      const result = service.evaluate('test', 'user-1')
      expect(result.enabled).toBe(false)
      expect(result.reason).toContain('disabled')
    })

    it('evaluates enabled flag with 100% rollout', () => {
      service.createFlag('test', 'Test')
      service.enableFlag('test')
      const result = service.evaluate('test', 'user-1')
      expect(result.enabled).toBe(true)
    })

    it('targets specific users', () => {
      service.createFlag('beta', 'Beta', { targetUserIds: ['vip-1', 'vip-2'] })
      service.enableFlag('beta')
      expect(service.evaluate('beta', 'vip-1').enabled).toBe(true)
    })

    it('targets segments', () => {
      service.createFlag('enterprise', 'Enterprise', { targetSegments: ['enterprise'] })
      service.enableFlag('enterprise')
      expect(service.evaluate('enterprise', 'u1', ['enterprise']).enabled).toBe(true)
      expect(service.evaluate('enterprise', 'u2', ['free']).enabled).toBe(false)
    })

    it('assigns variants deterministically', () => {
      service.createFlag('ab', 'AB Test', {
        variants: [
          { key: 'control', name: 'Control', weight: 50 },
          { key: 'treatment', name: 'Treatment', weight: 50 },
        ],
      })
      service.enableFlag('ab')
      const r1 = service.evaluate('ab', 'user-1')
      const r2 = service.evaluate('ab', 'user-1')
      expect(r1.variant).toBe(r2.variant) // deterministic
    })
  })

  describe('Experiments', () => {
    it('creates an experiment', () => {
      service.createFlag('exp-flag', 'Exp Flag')
      const exp = service.createExperiment('Checkout Test', 'exp-flag', [
        { key: 'control', name: 'Control', weight: 50 },
        { key: 'variant-a', name: 'Variant A', weight: 50 },
      ])
      expect(exp.status).toBe('draft')
      expect(exp.variants.length).toBe(2)
    })

    it('starts an experiment', () => {
      service.createFlag('exp-flag', 'Exp Flag')
      const exp = service.createExperiment('Test', 'exp-flag', [
        { key: 'a', name: 'A', weight: 50 },
        { key: 'b', name: 'B', weight: 50 },
      ])
      expect(service.startExperiment(exp.id)).toBe(true)
      expect(service.getExperiment(exp.id)!.status).toBe('running')
      expect(service.getFlag('exp-flag')!.enabled).toBe(true)
    })

    it('pauses and completes experiment', () => {
      service.createFlag('f', 'F')
      const exp = service.createExperiment('Test', 'f', [{ key: 'a', name: 'A', weight: 100 }])
      service.startExperiment(exp.id)
      expect(service.pauseExperiment(exp.id)).toBe(true)
      expect(service.getExperiment(exp.id)!.status).toBe('paused')
    })

    it('records impressions and conversions', () => {
      service.createFlag('f', 'F')
      const exp = service.createExperiment('Test', 'f', [
        { key: 'a', name: 'A', weight: 50 },
        { key: 'b', name: 'B', weight: 50 },
      ])
      service.startExperiment(exp.id)

      for (let i = 0; i < 200; i++) {
        service.recordImpression(exp.id, 'a')
        service.recordImpression(exp.id, 'b')
      }
      for (let i = 0; i < 40; i++) service.recordConversion(exp.id, 'a', 10)
      for (let i = 0; i < 30; i++) service.recordConversion(exp.id, 'b', 8)

      const result = service.getExperimentResult(exp.id)
      expect(result.variants.length).toBe(2)
      expect(result.sampleSize).toBe(400)
      expect(result.variants[0].conversionRate).toBeCloseTo(0.2)
      expect(result.winner).toBe('a')
    })

    it('determines statistical significance', () => {
      service.createFlag('f', 'F')
      const exp = service.createExperiment('Test', 'f', [
        { key: 'a', name: 'A', weight: 50 },
        { key: 'b', name: 'B', weight: 50 },
      ])
      service.startExperiment(exp.id)

      for (let i = 0; i < 150; i++) {
        service.recordImpression(exp.id, 'a')
        service.recordImpression(exp.id, 'b')
      }
      for (let i = 0; i < 60; i++) service.recordConversion(exp.id, 'a')
      for (let i = 0; i < 15; i++) service.recordConversion(exp.id, 'b')

      const result = service.getExperimentResult(exp.id)
      expect(result.isSignificant).toBe(true)
      expect(result.confidenceLevel).toBeGreaterThan(0)
    })

    it('completes experiment and selects winner', () => {
      service.createFlag('f', 'F')
      const exp = service.createExperiment('Test', 'f', [
        { key: 'a', name: 'A', weight: 50 },
        { key: 'b', name: 'B', weight: 50 },
      ])
      service.startExperiment(exp.id)
      for (let i = 0; i < 100; i++) {
        service.recordImpression(exp.id, 'a')
        service.recordImpression(exp.id, 'b')
      }
      for (let i = 0; i < 30; i++) service.recordConversion(exp.id, 'a')
      for (let i = 0; i < 10; i++) service.recordConversion(exp.id, 'b')

      service.completeExperiment(exp.id)
      expect(service.getExperiment(exp.id)!.status).toBe('completed')
      expect(service.getExperiment(exp.id)!.winnerVariant).toBe('a')
    })

    it('lists and removes experiments', () => {
      service.createFlag('f', 'F')
      service.createExperiment('A', 'f', [{ key: 'a', name: 'A', weight: 100 }])
      const exp = service.createExperiment('B', 'f', [{ key: 'b', name: 'B', weight: 100 }])
      expect(service.getExperiments().length).toBe(2)
      service.removeExperiment(exp.id)
      expect(service.getExperiments().length).toBe(1)
    })
  })
})
