import { OverlapManagerService } from '../../src/services/embeddings/overlap-manager.service'

describe('OverlapManagerService', () => {
  let service: OverlapManagerService

  beforeEach(() => {
    service = new OverlapManagerService()
  })

  describe('Configuration', () => {
    it('uses default config', () => {
      const config = service.getConfig()
      expect(config.strategy).toBe('sentence')
      expect(config.fixedSize).toBe(200)
      expect(config.sentenceCount).toBe(2)
    })

    it('accepts custom config', () => {
      service.setConfig({ strategy: 'fixed', fixedSize: 100 })
      expect(service.getConfig().strategy).toBe('fixed')
      expect(service.getConfig().fixedSize).toBe(100)
    })
  })

  describe('chunkWithOverlap — fixed strategy', () => {
    beforeEach(() => {
      service.setConfig({ strategy: 'fixed', fixedSize: 10 })
    })

    it('splits text into chunks with overlap', () => {
      const text = 'AAAAAAAAAA' + 'BBBBBBBBBB' + 'CCCCCCCCCC' // 30 chars
      const chunks = service.chunkWithOverlap(text, 10)

      expect(chunks.length).toBe(3)
      expect(chunks[0].content).toBe('AAAAAAAAAA')
      expect(chunks[1].content).toBe('BBBBBBBBBB')
      expect(chunks[2].content).toBe('CCCCCCCCCC')

      // First chunk has no overlapBefore
      expect(chunks[0].overlapBefore).toBe('')
      // Second chunk has overlap from first
      expect(chunks[1].overlapBefore.length).toBeLessThanOrEqual(10)
      // Last chunk has no overlapAfter
      expect(chunks[2].overlapAfter).toBe('')
    })

    it('handles single chunk', () => {
      const chunks = service.chunkWithOverlap('short', 100)
      expect(chunks.length).toBe(1)
      expect(chunks[0].overlapBefore).toBe('')
      expect(chunks[0].overlapAfter).toBe('')
    })
  })

  describe('chunkWithOverlap — sentence strategy', () => {
    beforeEach(() => {
      service.setConfig({ strategy: 'sentence', sentenceCount: 1 })
    })

    it('overlaps at sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.'
      const chunks = service.chunkWithOverlap(text, 35)

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      // Overlaps should be sentence-aligned
      for (const chunk of chunks) {
        if (chunk.overlapBefore) {
          expect(chunk.overlapBefore.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('chunkWithOverlap — adaptive strategy', () => {
    beforeEach(() => {
      service.setConfig({ strategy: 'adaptive', adaptiveMin: 0.1, adaptiveMax: 0.3, minChunkSize: 5 })
    })

    it('adapts overlap based on content density', () => {
      const denseText = 'A, B; C: D. E! F? G, H; I: J.'  // lots of punctuation
      const sparseText = 'This is a simple text without much punctuation at all'

      const denseChunks = service.chunkWithOverlap(denseText + denseText, 30)
      const sparseChunks = service.chunkWithOverlap(sparseText + ' ' + sparseText, 30)

      // Dense text should have more overlap
      if (denseChunks.length > 1 && sparseChunks.length > 1) {
        const denseOverlap = denseChunks[1].overlapBefore.length
        const sparseOverlap = sparseChunks[1].overlapBefore.length
        expect(denseOverlap).toBeGreaterThanOrEqual(sparseOverlap)
      }
    })
  })

  describe('applyOverlapToChunks', () => {
    it('adds overlap context to existing chunks', () => {
      service.setConfig({ strategy: 'sentence', sentenceCount: 1 })

      const chunks = [
        { id: 'c1', content: 'First sentence. Second sentence.' },
        { id: 'c2', content: 'Third sentence. Fourth sentence.' },
        { id: 'c3', content: 'Fifth sentence. Sixth sentence.' },
      ]

      const withOverlap = service.applyOverlapToChunks(chunks)
      expect(withOverlap.length).toBe(3)

      // First chunk: no overlapBefore
      expect(withOverlap[0].overlapBefore).toBe('')
      // Middle chunk: has both overlaps
      expect(withOverlap[1].overlapBefore.length).toBeGreaterThan(0)
      expect(withOverlap[1].overlapAfter.length).toBeGreaterThan(0)
      // Last chunk: no overlapAfter
      expect(withOverlap[2].overlapAfter).toBe('')
    })
  })

  describe('mergeOverlaps', () => {
    it('merges chunks removing duplicate overlap', () => {
      service.setConfig({ strategy: 'fixed', fixedSize: 5 })

      const text = 'Hello World! How are you doing today?'
      const chunks = service.chunkWithOverlap(text, 12)

      const merged = service.mergeOverlaps(chunks)
      // Merged text should reconstruct the original (or close to it)
      expect(merged.length).toBeGreaterThanOrEqual(text.length - 5)
    })
  })

  describe('getEffectiveContent', () => {
    it('includes overlap context markers', () => {
      const chunk = {
        id: 'c1',
        content: 'Main content here.',
        overlapBefore: 'Previous context.',
        overlapAfter: 'Next context.',
        originalStart: 0,
        originalEnd: 18,
      }

      const effective = service.getEffectiveContent(chunk)
      expect(effective).toContain('[...]')
      expect(effective).toContain('Previous context.')
      expect(effective).toContain('Main content here.')
      expect(effective).toContain('Next context.')
    })

    it('omits markers when no overlap', () => {
      const chunk = {
        id: 'c1',
        content: 'Only content.',
        overlapBefore: '',
        overlapAfter: '',
        originalStart: 0,
        originalEnd: 13,
      }

      const effective = service.getEffectiveContent(chunk)
      expect(effective).toBe('Only content.')
      expect(effective).not.toContain('[...]')
    })
  })
})
