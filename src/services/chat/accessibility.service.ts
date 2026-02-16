/**
 * Accessibility Service (WCAG 2.1 Compliance).
 *
 * Provides accessibility features for the chat interface:
 *   - ARIA attribute generation
 *   - Color contrast validation (AA/AAA)
 *   - Focus management
 *   - Screen reader announcements
 *   - Reduced motion detection
 *   - Keyboard navigation helpers
 *   - Text sizing and spacing
 *   - Landmark role management
 */

export interface AccessibilityConfig {
  level: 'A' | 'AA' | 'AAA'
  highContrast: boolean
  reducedMotion: boolean
  screenReaderMode: boolean
  largeText: boolean
  focusVisible: boolean
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  dyslexiaFont: boolean
  lineSpacing: number
  wordSpacing: number
}

export interface AriaAttributes {
  role?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-live'?: 'off' | 'polite' | 'assertive'
  'aria-expanded'?: boolean
  'aria-hidden'?: boolean
  'aria-disabled'?: boolean
  'aria-selected'?: boolean
  'aria-current'?: string
  tabIndex?: number
}

export interface ContrastResult {
  ratio: number
  passesAA: boolean
  passesAAA: boolean
  passesAALargeText: boolean
  passesAAALargeText: boolean
  foreground: string
  background: string
}

export interface AccessibilityAuditResult {
  score: number
  issues: AccessibilityIssue[]
  passedChecks: number
  totalChecks: number
  level: string
}

export interface AccessibilityIssue {
  id: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  wcagCriteria: string
  message: string
  element?: string
  suggestion: string
}

export interface Announcement {
  message: string
  priority: 'polite' | 'assertive'
  timestamp: string
}

const DEFAULT_CONFIG: AccessibilityConfig = {
  level: 'AA',
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  largeText: false,
  focusVisible: true,
  colorBlindMode: 'none',
  dyslexiaFont: false,
  lineSpacing: 1.5,
  wordSpacing: 0,
}

export class AccessibilityService {
  private config: AccessibilityConfig
  private announcements: Announcement[] = []
  private focusHistory: string[] = []

  constructor(config: Partial<AccessibilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getConfig(): AccessibilityConfig { return { ...this.config } }
  setConfig(config: Partial<AccessibilityConfig>): void { Object.assign(this.config, config) }

  // ── ARIA Helpers ───────────────────────────────────────────

  /** Generate ARIA attributes for a chat message. */
  getMessageAria(role: string, index: number, total: number): AriaAttributes {
    return {
      role: 'article',
      'aria-label': `${role} message, ${index + 1} of ${total}`,
      'aria-live': role === 'assistant' ? 'polite' : 'off',
      tabIndex: 0,
    }
  }

  /** Generate ARIA attributes for the message input. */
  getInputAria(placeholder?: string): AriaAttributes {
    return {
      role: 'textbox',
      'aria-label': placeholder || 'Type your message',
      'aria-describedby': 'input-help-text',
      'aria-live': 'off',
      tabIndex: 0,
    }
  }

  /** Generate ARIA attributes for the conversation list. */
  getConversationListAria(): AriaAttributes {
    return {
      role: 'navigation',
      'aria-label': 'Conversation list',
      tabIndex: 0,
    }
  }

  /** Generate ARIA attributes for a conversation item. */
  getConversationItemAria(title: string, isSelected: boolean): AriaAttributes {
    return {
      role: 'listitem',
      'aria-label': title,
      'aria-selected': isSelected,
      'aria-current': isSelected ? 'true' : undefined,
      tabIndex: isSelected ? 0 : -1,
    }
  }

  /** Generate ARIA attributes for a toolbar. */
  getToolbarAria(label: string): AriaAttributes {
    return {
      role: 'toolbar',
      'aria-label': label,
      tabIndex: 0,
    }
  }

  /** Generate landmark attributes. */
  getLandmarkAria(type: 'main' | 'navigation' | 'complementary' | 'banner' | 'contentinfo', label: string): AriaAttributes {
    return { role: type, 'aria-label': label }
  }

  // ── Color Contrast ─────────────────────────────────────────

  /** Check color contrast ratio between foreground and background. */
  checkContrast(foreground: string, background: string): ContrastResult {
    const fgLum = this.getRelativeLuminance(foreground)
    const bgLum = this.getRelativeLuminance(background)
    const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05)

    return {
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7,
      passesAALargeText: ratio >= 3,
      passesAAALargeText: ratio >= 4.5,
      foreground,
      background,
    }
  }

  /** Suggest a color with sufficient contrast against a background. */
  suggestContrastColor(background: string, targetRatio: number = 4.5): string {
    const bgLum = this.getRelativeLuminance(background)
    // If background is dark, suggest light text; otherwise dark text
    if (bgLum < 0.5) {
      return '#ffffff'
    }
    return '#000000'
  }

  // ── Focus Management ───────────────────────────────────────

  /** Record a focus event. */
  pushFocus(elementId: string): void {
    this.focusHistory.push(elementId)
  }

  /** Get the previous focus target for restoring focus. */
  popFocus(): string | undefined {
    return this.focusHistory.pop()
  }

  /** Get focus history. */
  getFocusHistory(): string[] {
    return [...this.focusHistory]
  }

  /** Generate a focus trap configuration. */
  getFocusTrapConfig(containerId: string): { containerId: string; initialFocus?: string; returnFocus: boolean } {
    return {
      containerId,
      initialFocus: undefined,
      returnFocus: true,
    }
  }

  // ── Screen Reader ──────────────────────────────────────────

  /** Create a screen reader announcement. */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): Announcement {
    const announcement: Announcement = {
      message,
      priority,
      timestamp: new Date().toISOString(),
    }
    this.announcements.push(announcement)
    return announcement
  }

  /** Get all announcements. */
  getAnnouncements(): Announcement[] {
    return [...this.announcements]
  }

  /** Clear announcements. */
  clearAnnouncements(): void {
    this.announcements = []
  }

  /** Get the live region attributes for announcements. */
  getLiveRegionAria(priority: 'polite' | 'assertive' = 'polite'): AriaAttributes {
    return {
      role: 'status',
      'aria-live': priority,
      'aria-hidden': false,
    }
  }

  // ── Text & Spacing ─────────────────────────────────────────

  /** Get text style adjustments based on config. */
  getTextStyles(): Record<string, string> {
    const styles: Record<string, string> = {}

    if (this.config.largeText) {
      styles.fontSize = '1.25rem'
    }
    if (this.config.dyslexiaFont) {
      styles.fontFamily = 'OpenDyslexic, Arial, sans-serif'
    }
    if (this.config.lineSpacing !== 1.5) {
      styles.lineHeight = String(this.config.lineSpacing)
    }
    if (this.config.wordSpacing > 0) {
      styles.wordSpacing = `${this.config.wordSpacing}px`
    }
    if (this.config.highContrast) {
      styles.fontWeight = '600'
    }

    return styles
  }

  /** Get animation styles based on reduced motion preference. */
  getMotionStyles(): Record<string, string> {
    if (this.config.reducedMotion) {
      return {
        transition: 'none',
        animation: 'none',
        scrollBehavior: 'auto',
      }
    }
    return {}
  }

  // ── Accessibility Audit ────────────────────────────────────

  /** Audit a set of elements for accessibility issues. */
  audit(elements: Array<{ type: string; label?: string; contrast?: { fg: string; bg: string }; hasAlt?: boolean; tabIndex?: number }>): AccessibilityAuditResult {
    const issues: AccessibilityIssue[] = []
    let checks = 0

    for (const el of elements) {
      checks++

      // Check for labels
      if (!el.label && el.type !== 'decorative') {
        issues.push({
          id: `label-${checks}`,
          severity: 'serious',
          wcagCriteria: '1.1.1',
          message: `${el.type} element missing accessible label`,
          element: el.type,
          suggestion: 'Add an aria-label or aria-labelledby attribute',
        })
      }

      // Check contrast
      if (el.contrast) {
        checks++
        const result = this.checkContrast(el.contrast.fg, el.contrast.bg)
        const minRatio = this.config.level === 'AAA' ? 7 : 4.5
        if (result.ratio < minRatio) {
          issues.push({
            id: `contrast-${checks}`,
            severity: 'serious',
            wcagCriteria: '1.4.3',
            message: `Insufficient contrast ratio: ${result.ratio} (minimum ${minRatio})`,
            element: el.type,
            suggestion: `Increase contrast to at least ${minRatio}:1`,
          })
        }
      }

      // Check images for alt text
      if (el.type === 'image' && el.hasAlt === false) {
        issues.push({
          id: `alt-${checks}`,
          severity: 'critical',
          wcagCriteria: '1.1.1',
          message: 'Image missing alternative text',
          element: 'image',
          suggestion: 'Add an alt attribute describing the image',
        })
      }
    }

    const passedChecks = checks - issues.length
    const score = checks > 0 ? Math.round((passedChecks / checks) * 100) : 100

    return {
      score,
      issues,
      passedChecks,
      totalChecks: checks,
      level: this.config.level,
    }
  }

  // ── Color Helpers ──────────────────────────────────────────

  private getRelativeLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return 0

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace('#', '')
    if (clean.length !== 6 && clean.length !== 3) return null

    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean

    const num = parseInt(full, 16)
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
  }
}

export const accessibilityService = new AccessibilityService()
