import { AccessibilityService } from '../../src/services/chat/accessibility.service'

describe('AccessibilityService', () => {
  let service: AccessibilityService

  beforeEach(() => {
    service = new AccessibilityService({ level: 'AA' })
  })

  describe('Config', () => {
    it('gets and sets config', () => {
      expect(service.getConfig().level).toBe('AA')
      service.setConfig({ level: 'AAA' })
      expect(service.getConfig().level).toBe('AAA')
    })
  })

  describe('ARIA helpers', () => {
    it('generates message ARIA', () => {
      const aria = service.getMessageAria('user', 2, 10)
      expect(aria.role).toBe('article')
      expect(aria['aria-label']).toContain('user message')
      expect(aria['aria-label']).toContain('3 of 10')
      expect(aria.tabIndex).toBe(0)
    })

    it('sets aria-live polite for assistant messages', () => {
      const aria = service.getMessageAria('assistant', 0, 1)
      expect(aria['aria-live']).toBe('polite')
    })

    it('generates input ARIA', () => {
      const aria = service.getInputAria('Ask a question')
      expect(aria.role).toBe('textbox')
      expect(aria['aria-label']).toBe('Ask a question')
    })

    it('generates conversation list ARIA', () => {
      const aria = service.getConversationListAria()
      expect(aria.role).toBe('navigation')
    })

    it('generates conversation item ARIA', () => {
      const aria = service.getConversationItemAria('My Chat', true)
      expect(aria['aria-selected']).toBe(true)
      expect(aria['aria-current']).toBe('true')
      expect(aria.tabIndex).toBe(0)
    })

    it('generates toolbar ARIA', () => {
      const aria = service.getToolbarAria('Chat actions')
      expect(aria.role).toBe('toolbar')
    })

    it('generates landmark ARIA', () => {
      const aria = service.getLandmarkAria('main', 'Chat area')
      expect(aria.role).toBe('main')
      expect(aria['aria-label']).toBe('Chat area')
    })
  })

  describe('Color contrast', () => {
    it('checks black on white (high contrast)', () => {
      const result = service.checkContrast('#000000', '#ffffff')
      expect(result.ratio).toBeGreaterThan(20)
      expect(result.passesAA).toBe(true)
      expect(result.passesAAA).toBe(true)
    })

    it('checks low contrast colors', () => {
      const result = service.checkContrast('#cccccc', '#ffffff')
      expect(result.passesAA).toBe(false)
    })

    it('suggests contrast color for dark background', () => {
      const color = service.suggestContrastColor('#111111')
      expect(color).toBe('#ffffff')
    })

    it('suggests contrast color for light background', () => {
      const color = service.suggestContrastColor('#ffffff')
      expect(color).toBe('#000000')
    })
  })

  describe('Focus management', () => {
    it('pushes and pops focus', () => {
      service.pushFocus('input-1')
      service.pushFocus('modal-1')
      expect(service.popFocus()).toBe('modal-1')
      expect(service.popFocus()).toBe('input-1')
    })

    it('returns undefined when empty', () => {
      expect(service.popFocus()).toBeUndefined()
    })

    it('tracks focus history', () => {
      service.pushFocus('a')
      service.pushFocus('b')
      expect(service.getFocusHistory()).toEqual(['a', 'b'])
    })

    it('generates focus trap config', () => {
      const config = service.getFocusTrapConfig('modal')
      expect(config.containerId).toBe('modal')
      expect(config.returnFocus).toBe(true)
    })
  })

  describe('Screen reader', () => {
    it('creates announcements', () => {
      const a = service.announce('New message received')
      expect(a.message).toBe('New message received')
      expect(a.priority).toBe('polite')
    })

    it('creates assertive announcements', () => {
      const a = service.announce('Error occurred', 'assertive')
      expect(a.priority).toBe('assertive')
    })

    it('lists and clears announcements', () => {
      service.announce('msg1')
      service.announce('msg2')
      expect(service.getAnnouncements().length).toBe(2)
      service.clearAnnouncements()
      expect(service.getAnnouncements().length).toBe(0)
    })

    it('generates live region ARIA', () => {
      const aria = service.getLiveRegionAria('assertive')
      expect(aria['aria-live']).toBe('assertive')
      expect(aria.role).toBe('status')
    })
  })

  describe('Text & motion styles', () => {
    it('returns large text styles', () => {
      service.setConfig({ largeText: true })
      const styles = service.getTextStyles()
      expect(styles.fontSize).toBe('1.25rem')
    })

    it('returns dyslexia font', () => {
      service.setConfig({ dyslexiaFont: true })
      const styles = service.getTextStyles()
      expect(styles.fontFamily).toContain('OpenDyslexic')
    })

    it('returns high contrast font weight', () => {
      service.setConfig({ highContrast: true })
      const styles = service.getTextStyles()
      expect(styles.fontWeight).toBe('600')
    })

    it('disables animations for reduced motion', () => {
      service.setConfig({ reducedMotion: true })
      const styles = service.getMotionStyles()
      expect(styles.transition).toBe('none')
      expect(styles.animation).toBe('none')
    })

    it('returns empty motion styles when not reduced', () => {
      service.setConfig({ reducedMotion: false })
      expect(Object.keys(service.getMotionStyles()).length).toBe(0)
    })
  })

  describe('Audit', () => {
    it('passes audit for well-labeled elements', () => {
      const result = service.audit([
        { type: 'button', label: 'Send' },
        { type: 'input', label: 'Message' },
      ])
      expect(result.score).toBe(100)
      expect(result.issues.length).toBe(0)
    })

    it('flags missing labels', () => {
      const result = service.audit([
        { type: 'button' },
      ])
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].wcagCriteria).toBe('1.1.1')
    })

    it('flags insufficient contrast', () => {
      const result = service.audit([
        { type: 'text', label: 'Hello', contrast: { fg: '#cccccc', bg: '#ffffff' } },
      ])
      expect(result.issues.some(i => i.wcagCriteria === '1.4.3')).toBe(true)
    })

    it('flags missing alt text on images', () => {
      const result = service.audit([
        { type: 'image', label: 'photo', hasAlt: false },
      ])
      expect(result.issues.some(i => i.message.includes('alternative text'))).toBe(true)
    })

    it('uses AAA level when configured', () => {
      service.setConfig({ level: 'AAA' })
      const result = service.audit([
        { type: 'text', label: 'Hello', contrast: { fg: '#666666', bg: '#ffffff' } },
      ])
      // 5.74:1 ratio passes AA but not AAA
      expect(result.issues.some(i => i.wcagCriteria === '1.4.3')).toBe(true)
    })
  })
})
