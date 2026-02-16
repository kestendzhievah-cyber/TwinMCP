import { FewShotLearningService } from '../../src/services/llm/few-shot-learning.service'

describe('FewShotLearningService', () => {
  let service: FewShotLearningService

  beforeEach(() => {
    service = new FewShotLearningService({ maxExamples: 3, totalTokenBudget: 2000, selectionStrategy: 'quality' })
  })

  describe('Example management', () => {
    it('adds and retrieves examples', () => {
      const ex = service.addExample({ category: 'code', input: 'How to sort?', output: 'Use Array.sort()', quality: 0.8, tags: ['js'] })
      expect(ex.id).toBeDefined()
      expect(ex.usageCount).toBe(0)
      expect(service.size).toBe(1)
    })

    it('gets example by ID', () => {
      const ex = service.addExample({ category: 'code', input: 'test', output: 'result', quality: 0.7, tags: [] })
      expect(service.getExample(ex.id)?.category).toBe('code')
    })

    it('removes examples', () => {
      const ex = service.addExample({ category: 'code', input: 'test', output: 'result', quality: 0.7, tags: [] })
      expect(service.removeExample(ex.id)).toBe(true)
      expect(service.size).toBe(0)
    })

    it('lists examples by category', () => {
      service.addExample({ category: 'code', input: 'a', output: 'b', quality: 0.8, tags: [] })
      service.addExample({ category: 'docs', input: 'c', output: 'd', quality: 0.7, tags: [] })
      service.addExample({ category: 'code', input: 'e', output: 'f', quality: 0.9, tags: [] })

      expect(service.getExamples('code').length).toBe(2)
      expect(service.getExamples('docs').length).toBe(1)
      expect(service.getExamples().length).toBe(3)
    })

    it('lists categories', () => {
      service.addExample({ category: 'code', input: 'a', output: 'b', quality: 0.8, tags: [] })
      service.addExample({ category: 'docs', input: 'c', output: 'd', quality: 0.7, tags: [] })
      expect(service.getCategories()).toEqual(expect.arrayContaining(['code', 'docs']))
    })
  })

  describe('Example selection', () => {
    beforeEach(() => {
      service.addExample({ category: 'code', input: 'How to sort an array in JavaScript?', output: 'Use arr.sort((a,b) => a-b)', quality: 0.9, tags: ['js', 'array'] })
      service.addExample({ category: 'code', input: 'How to filter an array?', output: 'Use arr.filter(fn)', quality: 0.85, tags: ['js', 'array'] })
      service.addExample({ category: 'code', input: 'How to make HTTP requests?', output: 'Use fetch() or axios', quality: 0.8, tags: ['js', 'http'] })
      service.addExample({ category: 'code', input: 'How to read a file in Python?', output: 'Use open() and read()', quality: 0.7, tags: ['python', 'io'] })
      service.addExample({ category: 'docs', input: 'What is React?', output: 'A UI library', quality: 0.6, tags: ['react'] })
    })

    it('selects examples by quality', () => {
      const selection = service.selectExamples('How to sort?', 'code')
      expect(selection.examples.length).toBeGreaterThan(0)
      expect(selection.examples.length).toBeLessThanOrEqual(3)
      expect(selection.strategy).toBe('quality')
    })

    it('respects max examples limit', () => {
      const selection = service.selectExamples('JavaScript array', 'code')
      expect(selection.examples.length).toBeLessThanOrEqual(3)
    })

    it('filters by category', () => {
      const selection = service.selectExamples('What is React?', 'docs')
      expect(selection.examples.every(e => e.category === 'docs')).toBe(true)
    })

    it('returns empty when no qualifying examples', () => {
      const selection = service.selectExamples('test', 'nonexistent')
      expect(selection.examples.length).toBe(0)
      expect(selection.reason).toContain('No qualifying')
    })

    it('increments usage count on selection', () => {
      const selection = service.selectExamples('sort array')
      const firstId = selection.examples[0].id
      expect(service.getExample(firstId)!.usageCount).toBe(1)
    })

    it('uses similarity strategy', () => {
      const selection = service.selectExamples('sort array JavaScript', undefined, { selectionStrategy: 'similarity' })
      expect(selection.strategy).toBe('similarity')
      expect(selection.examples.length).toBeGreaterThan(0)
    })

    it('uses diverse strategy', () => {
      const selection = service.selectExamples('JavaScript', undefined, { selectionStrategy: 'diverse' })
      expect(selection.strategy).toBe('diverse')
    })

    it('uses recent strategy', () => {
      const selection = service.selectExamples('test', undefined, { selectionStrategy: 'recent' })
      expect(selection.strategy).toBe('recent')
    })

    it('respects min quality filter', () => {
      const selection = service.selectExamples('test', undefined, { minQuality: 0.85 })
      expect(selection.examples.every(e => e.quality >= 0.85)).toBe(true)
    })

    it('reports total tokens', () => {
      const selection = service.selectExamples('sort array')
      expect(selection.totalTokens).toBeGreaterThan(0)
    })
  })

  describe('Formatting', () => {
    it('formats as text', () => {
      service.addExample({ category: 'code', input: 'Q1', output: 'A1', quality: 0.9, tags: [] })
      const selection = service.selectExamples('test')
      const formatted = service.formatExamples(selection.examples, 'text')
      expect(formatted).toContain('Input: Q1')
      expect(formatted).toContain('Output: A1')
    })

    it('formats as chat', () => {
      service.addExample({ category: 'code', input: 'Q1', output: 'A1', quality: 0.9, tags: [] })
      const selection = service.selectExamples('test')
      const formatted = service.formatExamples(selection.examples, 'chat')
      expect(formatted).toContain('User: Q1')
      expect(formatted).toContain('Assistant: A1')
    })

    it('returns empty string for no examples', () => {
      expect(service.formatExamples([])).toBe('')
    })
  })

  describe('Feedback & learning', () => {
    it('records positive feedback', () => {
      const ex = service.addExample({ category: 'code', input: 'test', output: 'result', quality: 0.5, tags: [] })
      // Simulate usage first
      service.selectExamples('test')
      service.recordFeedback(ex.id, true)
      expect(service.getExample(ex.id)!.quality).toBeGreaterThan(0.5)
    })

    it('records negative feedback', () => {
      const ex = service.addExample({ category: 'code', input: 'test', output: 'result', quality: 0.5, tags: [] })
      service.selectExamples('test')
      service.recordFeedback(ex.id, false)
      expect(service.getExample(ex.id)!.quality).toBeLessThan(0.5)
    })

    it('learns from interactions', () => {
      const ex = service.learnFromInteraction('code', 'How to X?', 'Do Y', 0.8, ['js'])
      expect(ex.category).toBe('code')
      expect(ex.quality).toBe(0.8)
      expect(service.size).toBe(1)
    })
  })

  describe('Config', () => {
    it('gets and sets config', () => {
      expect(service.getConfig().maxExamples).toBe(3)
      service.setConfig({ maxExamples: 10 })
      expect(service.getConfig().maxExamples).toBe(10)
    })
  })
})
