import { KeyboardShortcutsService } from '../../src/services/chat/keyboard-shortcuts.service'

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService

  beforeEach(() => {
    service = new KeyboardShortcutsService()
  })

  describe('Default shortcuts', () => {
    it('registers default shortcuts', () => {
      expect(service.size).toBeGreaterThan(10)
    })

    it('includes send message shortcut', () => {
      expect(service.get('send')).toBeDefined()
      expect(service.get('send')!.keys).toBe('ctrl+enter')
    })

    it('includes search shortcut', () => {
      expect(service.get('search')).toBeDefined()
      expect(service.get('search')!.keys).toBe('ctrl+k')
    })
  })

  describe('Registration', () => {
    it('registers a custom shortcut', () => {
      service.register({ id: 'custom1', keys: 'ctrl+shift+x', action: 'custom-action', description: 'Custom', context: 'global', enabled: true, category: 'custom', isCustom: true })
      expect(service.get('custom1')).toBeDefined()
    })

    it('unregisters a shortcut', () => {
      expect(service.unregister('send')).toBe(true)
      expect(service.get('send')).toBeUndefined()
    })

    it('registers action handler', () => {
      let called = false
      service.onAction('send-message', () => { called = true })
      service.execute('ctrl+enter', 'chat')
      expect(called).toBe(true)
    })
  })

  describe('Filtering', () => {
    it('gets by context', () => {
      const chat = service.getByContext('chat')
      expect(chat.length).toBeGreaterThan(0)
      expect(chat.every(s => s.context === 'chat')).toBe(true)
    })

    it('gets by category', () => {
      const nav = service.getByCategory('navigation')
      expect(nav.length).toBeGreaterThan(0)
    })
  })

  describe('Key matching', () => {
    it('matches a shortcut by keys and context', () => {
      const m = service.match('ctrl+enter', 'chat')
      expect(m).not.toBeNull()
      expect(m!.shortcut.action).toBe('send-message')
    })

    it('matches global shortcuts in any context', () => {
      const m = service.match('ctrl+k', 'chat')
      expect(m).not.toBeNull()
      expect(m!.shortcut.action).toBe('open-search')
    })

    it('returns null for unknown keys', () => {
      expect(service.match('ctrl+shift+z', 'chat')).toBeNull()
    })

    it('does not match disabled shortcuts', () => {
      service.setEnabled('send', false)
      expect(service.match('ctrl+enter', 'chat')).toBeNull()
    })

    it('parses keyboard events', () => {
      const keys = service.parseEvent({ key: 'Enter', ctrlKey: true })
      expect(keys).toBe('ctrl+enter')
    })

    it('parses complex events', () => {
      const keys = service.parseEvent({ key: 'K', ctrlKey: true, shiftKey: true })
      expect(keys).toBe('ctrl+shift+k')
    })
  })

  describe('Custom shortcuts', () => {
    it('binds a custom shortcut', () => {
      const s = service.bindCustom('my-cmd', 'ctrl+shift+m', 'my-action', 'My command')
      expect(s.isCustom).toBe(true)
      expect(s.keys).toBe('ctrl+shift+m')
    })

    it('rebinds a shortcut', () => {
      expect(service.rebind('send', 'ctrl+shift+enter')).toBe(true)
      expect(service.get('send')!.keys).toBe('ctrl+shift+enter')
    })

    it('enables and disables', () => {
      service.setEnabled('send', false)
      expect(service.get('send')!.enabled).toBe(false)
      service.setEnabled('send', true)
      expect(service.get('send')!.enabled).toBe(true)
    })

    it('resets to defaults', () => {
      service.bindCustom('extra', 'ctrl+shift+x', 'extra', 'Extra')
      service.rebind('send', 'alt+enter')
      service.resetToDefaults()
      expect(service.get('extra')).toBeUndefined()
      expect(service.get('send')!.keys).toBe('ctrl+enter')
    })
  })

  describe('Conflict detection', () => {
    it('detects no conflicts in defaults', () => {
      const conflicts = service.detectConflicts()
      expect(conflicts.length).toBe(0)
    })

    it('detects conflicts when same keys in same context', () => {
      service.bindCustom('dup', 'ctrl+enter', 'dup-action', 'Duplicate', 'chat')
      const conflicts = service.detectConflicts()
      expect(conflicts.length).toBeGreaterThan(0)
    })

    it('checks key availability', () => {
      expect(service.isAvailable('ctrl+enter', 'chat')).toBe(false)
      expect(service.isAvailable('ctrl+shift+z', 'chat')).toBe(true)
    })
  })

  describe('Cheatsheet', () => {
    it('generates cheatsheet', () => {
      const sheet = service.getCheatsheet()
      expect(sheet.categories.length).toBeGreaterThan(0)
      expect(sheet.totalShortcuts).toBeGreaterThan(10)
    })

    it('groups by category', () => {
      const sheet = service.getCheatsheet()
      const nav = sheet.categories.find(c => c.name === 'navigation')
      expect(nav).toBeDefined()
      expect(nav!.shortcuts.length).toBeGreaterThan(0)
    })
  })
})
