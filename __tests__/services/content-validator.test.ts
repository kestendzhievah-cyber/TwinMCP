import { ContentValidatorService } from '../../src/services/crawling/content-validator.service'

describe('ContentValidatorService', () => {
  let service: ContentValidatorService

  beforeEach(() => {
    service = new ContentValidatorService()
  })

  describe('Basic validation', () => {
    it('validates good content', () => {
      const content = '# Getting Started\n\nThis is a comprehensive guide to using the library. It covers installation, configuration, and basic usage patterns.\n\n## Installation\n\nRun the following command to install.'
      const result = service.validate(content)
      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThan(50)
    })

    it('rejects too-short content', () => {
      const result = service.validate('Hi')
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.rule === 'min-length')).toBe(true)
    })

    it('warns on very large content', () => {
      const content = 'word '.repeat(200000)
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'max-length')).toBe(true)
    })
  })

  describe('Encoding validation', () => {
    it('detects encoding errors', () => {
      const content = 'This has a replacement character: \uFFFD in the middle of valid text content here.'
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'encoding')).toBe(true)
    })

    it('passes clean UTF-8 content', () => {
      const content = 'This is clean UTF-8 content with accents: café, naïve, résumé. And some unicode: 你好世界'
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'encoding')).toBe(false)
    })
  })

  describe('Duplicate detection', () => {
    it('detects duplicate content', () => {
      const content = 'This is a unique piece of content that we will register and then check for duplicates.'
      service.registerContent(content)
      expect(service.isDuplicate(content)).toBe(true)

      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'duplicate')).toBe(true)
    })

    it('does not flag non-duplicate content', () => {
      service.registerContent('First piece of content that is unique and registered.')
      const result = service.validate('Second piece of content that is completely different from the first.')
      expect(result.issues.some(i => i.rule === 'duplicate')).toBe(false)
    })

    it('clears hash tracking', () => {
      service.registerContent('Some content to register in the hash tracker.')
      expect(service.hashCount).toBe(1)
      service.clearHashes()
      expect(service.hashCount).toBe(0)
    })
  })

  describe('Spam detection', () => {
    it('detects repetitive content', () => {
      const content = ('spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam').trim()
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'spam')).toBe(true)
    })

    it('passes normal content', () => {
      const content = 'This is a normal documentation page with varied vocabulary and proper structure for testing purposes.'
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'spam')).toBe(false)
    })
  })

  describe('Structure validation', () => {
    it('suggests structure for long content without headings', () => {
      const content = 'word '.repeat(600) // 600 words, no headings
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'has-structure')).toBe(true)
    })

    it('passes structured content', () => {
      const content = '# Title\n\nIntro paragraph here.\n\n## Section 1\n\nContent for section one.\n\n## Section 2\n\nContent for section two.'
      const result = service.validate(content)
      expect(result.issues.some(i => i.rule === 'has-structure')).toBe(false)
    })
  })

  describe('Freshness check', () => {
    it('warns about outdated content', () => {
      const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
      const content = 'This is some documentation content that is long enough to pass minimum length validation checks.'
      const result = service.validate(content, { lastModified: oldDate })
      expect(result.issues.some(i => i.rule === 'freshness')).toBe(true)
    })

    it('passes fresh content', () => {
      const content = 'This is some documentation content that is long enough to pass minimum length validation checks.'
      const result = service.validate(content, { lastModified: new Date().toISOString() })
      expect(result.issues.some(i => i.rule === 'freshness')).toBe(false)
    })
  })

  describe('Content stats', () => {
    it('computes content statistics', () => {
      const content = '# Title\n\nSome words here.\n\n## Section\n\n```js\nconst x = 1;\n```\n\n[Link](https://example.com)\n\n![Image](https://img.com/pic.png)'
      const result = service.validate(content)
      expect(result.stats.wordCount).toBeGreaterThan(0)
      expect(result.stats.headingCount).toBe(2)
      expect(result.stats.codeBlockCount).toBe(1)
      expect(result.stats.linkCount).toBeGreaterThanOrEqual(1)
      expect(result.stats.imageCount).toBe(1)
    })
  })

  describe('Score computation', () => {
    it('gives high score to well-structured content', () => {
      const content = '# Guide\n\nIntroduction text here with enough words.\n\n## Setup\n\nSetup instructions.\n\n```bash\nnpm install\n```\n\nMore detailed explanation follows with additional context and information.'
      const result = service.validate(content)
      expect(result.score).toBeGreaterThan(80)
    })

    it('gives low score to problematic content', () => {
      const result = service.validate('x') // too short
      expect(result.score).toBeLessThan(80)
    })
  })

  describe('Custom rules', () => {
    it('registers and uses custom rules', () => {
      service.registerRule({
        id: 'no-todo',
        name: 'No TODO markers',
        enabled: true,
        severity: 'warning',
        check: (content) => {
          if (/TODO/i.test(content)) {
            return { rule: 'no-todo', severity: 'warning', message: 'Content contains TODO markers' }
          }
          return null
        },
      })

      const result = service.validate('This is a TODO item that needs to be completed before publishing.')
      expect(result.issues.some(i => i.rule === 'no-todo')).toBe(true)
    })

    it('removes custom rules', () => {
      service.registerRule({
        id: 'custom1',
        name: 'Custom',
        enabled: true,
        severity: 'info',
        check: () => ({ rule: 'custom1', severity: 'info', message: 'Always triggers' }),
      })
      expect(service.removeRule('custom1')).toBe(true)
    })

    it('enables and disables rules', () => {
      service.setRuleEnabled('min-length', false)
      const result = service.validate('x') // would normally fail min-length
      expect(result.issues.some(i => i.rule === 'min-length')).toBe(false)

      service.setRuleEnabled('min-length', true)
    })

    it('lists all rules', () => {
      const rules = service.getRules()
      expect(rules.length).toBeGreaterThan(5)
      expect(rules.some(r => r.id === 'min-length')).toBe(true)
    })
  })

  describe('Quick validation', () => {
    it('isValid returns true for good content', () => {
      expect(service.isValid('This is a valid piece of documentation content that passes all the basic validation rules.')).toBe(true)
    })

    it('isValid returns false for bad content', () => {
      expect(service.isValid('x')).toBe(false)
    })
  })
})
