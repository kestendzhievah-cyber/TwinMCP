import { ChatMacrosService } from '../../src/services/chat/chat-macros.service'

describe('ChatMacrosService', () => {
  let service: ChatMacrosService

  beforeEach(() => {
    service = new ChatMacrosService()
  })

  describe('Default macros', () => {
    it('registers default macros', () => {
      expect(service.size).toBeGreaterThanOrEqual(5)
    })

    it('includes /explain', () => {
      expect(service.getByShortcode('/explain')).toBeDefined()
    })

    it('includes /review', () => {
      expect(service.getByShortcode('/review')).toBeDefined()
    })
  })

  describe('CRUD', () => {
    it('creates a macro', () => {
      const m = service.create('Debug', '/debug', 'Debug this: {{code}}', 'development', 'Debug code')
      expect(m.shortcode).toBe('/debug')
      expect(m.variables).toContain('code')
    })

    it('auto-prefixes shortcode with /', () => {
      const m = service.create('Test', 'test', 'Test {{input}}', 'general')
      expect(m.shortcode).toBe('/test')
    })

    it('gets by ID', () => {
      const m = service.create('Test', '/test', 'Hello', 'general')
      expect(service.get(m.id)?.name).toBe('Test')
    })

    it('gets by shortcode', () => {
      service.create('Test', '/test', 'Hello', 'general')
      expect(service.getByShortcode('/test')).toBeDefined()
    })

    it('lists all', () => {
      expect(service.getAll().length).toBeGreaterThanOrEqual(5)
    })

    it('lists by category', () => {
      const dev = service.getByCategory('development')
      expect(dev.length).toBeGreaterThan(0)
    })

    it('lists categories', () => {
      const cats = service.getCategories()
      expect(cats).toContain('general')
      expect(cats).toContain('development')
    })

    it('updates a macro', () => {
      const m = service.create('Test', '/test', 'Old', 'general')
      expect(service.update(m.id, { template: 'New {{var}}' })).toBe(true)
      expect(service.get(m.id)!.template).toBe('New {{var}}')
      expect(service.get(m.id)!.variables).toContain('var')
    })

    it('removes a macro', () => {
      const m = service.create('Test', '/test', 'Hello', 'general')
      expect(service.remove(m.id)).toBe(true)
      expect(service.get(m.id)).toBeUndefined()
    })
  })

  describe('Expansion', () => {
    it('expands a shortcode with positional args', () => {
      const result = service.expand('/explain React hooks')
      expect(result).not.toBeNull()
      expect(result!.expanded).toContain('React hooks')
      expect(result!.macroId).toBeDefined()
    })

    it('expands with explicit variables', () => {
      const result = service.expand('/translate', { language: 'French', text: 'Hello world' })
      expect(result).not.toBeNull()
      expect(result!.expanded).toContain('French')
      expect(result!.expanded).toContain('Hello world')
    })

    it('returns null for unknown shortcode', () => {
      expect(service.expand('/unknown test')).toBeNull()
    })

    it('returns null for non-shortcode input', () => {
      expect(service.expand('hello world')).toBeNull()
    })

    it('increments usage count', () => {
      const m = service.getByShortcode('/explain')!
      const before = m.usageCount
      service.expand('/explain test')
      expect(m.usageCount).toBe(before + 1)
    })

    it('removes unfilled variables', () => {
      service.create('Multi', '/multi', 'A: {{a}} B: {{b}}', 'general')
      const result = service.expand('/multi only-a')
      expect(result!.expanded).not.toContain('{{b}}')
    })
  })

  describe('Shortcode detection', () => {
    it('detects known shortcodes', () => {
      expect(service.isShortcode('/explain')).toBe(true)
    })

    it('rejects unknown shortcodes', () => {
      expect(service.isShortcode('/unknown')).toBe(false)
    })

    it('rejects non-shortcode input', () => {
      expect(service.isShortcode('hello')).toBe(false)
    })
  })

  describe('Autocomplete', () => {
    it('suggests matching shortcodes', () => {
      const suggestions = service.autocomplete('/ex')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].shortcode).toBe('/explain')
    })

    it('returns empty for non-slash prefix', () => {
      expect(service.autocomplete('ex').length).toBe(0)
    })
  })

  describe('Import/Export', () => {
    it('exports custom macros', () => {
      service.create('Custom', '/custom', 'Hello {{name}}', 'custom')
      const json = service.exportMacros()
      const parsed = JSON.parse(json)
      expect(parsed.length).toBeGreaterThan(0)
    })

    it('imports macros', () => {
      const before = service.size
      const json = JSON.stringify([{ name: 'Imported', shortcode: '/imported', template: 'Hi', category: 'imported' }])
      const count = service.importMacros(json)
      expect(count).toBe(1)
      expect(service.size).toBe(before + 1)
    })

    it('skips duplicate shortcodes on import', () => {
      const json = JSON.stringify([{ name: 'Explain2', shortcode: '/explain', template: 'Dup', category: 'general' }])
      const count = service.importMacros(json)
      expect(count).toBe(0)
    })
  })
})
