/**
 * Keyboard Shortcuts Service.
 *
 * Manages keyboard shortcuts for the chat interface:
 *   - Default shortcut registry
 *   - Custom shortcut binding
 *   - Shortcut conflict detection
 *   - Context-aware shortcuts (global, chat, sidebar)
 *   - Shortcut help/cheatsheet generation
 */

export interface KeyboardShortcut {
  id: string
  keys: string // e.g. 'ctrl+enter', 'ctrl+k', 'escape'
  action: string
  description: string
  context: 'global' | 'chat' | 'sidebar' | 'modal' | 'editor'
  enabled: boolean
  category: string
  isCustom: boolean
}

export interface ShortcutMatch {
  shortcut: KeyboardShortcut
  matched: boolean
}

export interface ShortcutConflict {
  keys: string
  shortcuts: KeyboardShortcut[]
}

export interface ShortcutCheatsheet {
  categories: Array<{
    name: string
    shortcuts: Array<{ keys: string; description: string }>
  }>
  totalShortcuts: number
}

export class KeyboardShortcutsService {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private handlers: Map<string, () => void> = new Map()

  constructor() {
    this.registerDefaults()
  }

  // ── Registration ───────────────────────────────────────────

  /** Register a shortcut. */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut)
  }

  /** Register a handler for a shortcut action. */
  onAction(action: string, handler: () => void): void {
    this.handlers.set(action, handler)
  }

  /** Unregister a shortcut. */
  unregister(id: string): boolean {
    return this.shortcuts.delete(id)
  }

  /** Get a shortcut by ID. */
  get(id: string): KeyboardShortcut | undefined {
    return this.shortcuts.get(id)
  }

  /** List all shortcuts. */
  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /** List shortcuts by context. */
  getByContext(context: string): KeyboardShortcut[] {
    return this.getAll().filter(s => s.context === context && s.enabled)
  }

  /** List shortcuts by category. */
  getByCategory(category: string): KeyboardShortcut[] {
    return this.getAll().filter(s => s.category === category)
  }

  // ── Key Matching ───────────────────────────────────────────

  /** Match a key event to a registered shortcut. */
  match(keys: string, context: string): ShortcutMatch | null {
    const normalized = this.normalizeKeys(keys)
    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue
      if (shortcut.context !== context && shortcut.context !== 'global') continue
      if (this.normalizeKeys(shortcut.keys) === normalized) {
        return { shortcut, matched: true }
      }
    }
    return null
  }

  /** Execute the handler for a matched shortcut. */
  execute(keys: string, context: string): boolean {
    const m = this.match(keys, context)
    if (!m) return false
    const handler = this.handlers.get(m.shortcut.action)
    if (handler) { handler(); return true }
    return false
  }

  /** Parse a keyboard event into a key string. */
  parseEvent(event: { key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }): string {
    const parts: string[] = []
    if (event.ctrlKey) parts.push('ctrl')
    if (event.shiftKey) parts.push('shift')
    if (event.altKey) parts.push('alt')
    if (event.metaKey) parts.push('meta')
    parts.push(event.key.toLowerCase())
    return parts.join('+')
  }

  // ── Custom Shortcuts ───────────────────────────────────────

  /** Bind a custom shortcut. */
  bindCustom(id: string, keys: string, action: string, description: string, context: 'global' | 'chat' | 'sidebar' | 'modal' | 'editor' = 'global'): KeyboardShortcut {
    const shortcut: KeyboardShortcut = {
      id, keys, action, description, context,
      enabled: true,
      category: 'custom',
      isCustom: true,
    }
    this.shortcuts.set(id, shortcut)
    return shortcut
  }

  /** Rebind an existing shortcut to new keys. */
  rebind(id: string, newKeys: string): boolean {
    const shortcut = this.shortcuts.get(id)
    if (!shortcut) return false
    shortcut.keys = newKeys
    return true
  }

  /** Enable/disable a shortcut. */
  setEnabled(id: string, enabled: boolean): boolean {
    const shortcut = this.shortcuts.get(id)
    if (!shortcut) return false
    shortcut.enabled = enabled
    return true
  }

  /** Reset all shortcuts to defaults. */
  resetToDefaults(): void {
    this.shortcuts.clear()
    this.registerDefaults()
  }

  // ── Conflict Detection ─────────────────────────────────────

  /** Detect conflicting shortcuts (same keys in same context). */
  detectConflicts(): ShortcutConflict[] {
    const byKey = new Map<string, KeyboardShortcut[]>()

    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue
      const key = `${this.normalizeKeys(shortcut.keys)}:${shortcut.context}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(shortcut)
    }

    const conflicts: ShortcutConflict[] = []
    for (const [key, shortcuts] of byKey) {
      if (shortcuts.length > 1) {
        conflicts.push({ keys: key.split(':')[0], shortcuts })
      }
    }

    // Also check global shortcuts against context-specific ones
    const globals = this.getAll().filter(s => s.context === 'global' && s.enabled)
    for (const g of globals) {
      const gKey = this.normalizeKeys(g.keys)
      for (const s of this.getAll()) {
        if (s.id === g.id || !s.enabled || s.context === 'global') continue
        if (this.normalizeKeys(s.keys) === gKey) {
          const existing = conflicts.find(c => c.keys === gKey)
          if (!existing) {
            conflicts.push({ keys: gKey, shortcuts: [g, s] })
          }
        }
      }
    }

    return conflicts
  }

  /** Check if a key combination is available. */
  isAvailable(keys: string, context: string): boolean {
    const normalized = this.normalizeKeys(keys)
    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue
      if (shortcut.context !== context && shortcut.context !== 'global') continue
      if (this.normalizeKeys(shortcut.keys) === normalized) return false
    }
    return true
  }

  // ── Cheatsheet ─────────────────────────────────────────────

  /** Generate a cheatsheet of all shortcuts. */
  getCheatsheet(): ShortcutCheatsheet {
    const categories = new Map<string, Array<{ keys: string; description: string }>>()

    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue
      if (!categories.has(shortcut.category)) categories.set(shortcut.category, [])
      categories.get(shortcut.category)!.push({
        keys: shortcut.keys,
        description: shortcut.description,
      })
    }

    let total = 0
    const result: ShortcutCheatsheet = {
      categories: Array.from(categories.entries()).map(([name, shortcuts]) => {
        total += shortcuts.length
        return { name, shortcuts }
      }),
      totalShortcuts: 0,
    }
    result.totalShortcuts = total
    return result
  }

  /** Get shortcut count. */
  get size(): number { return this.shortcuts.size }

  // ── Internal ───────────────────────────────────────────────

  private normalizeKeys(keys: string): string {
    return keys.toLowerCase().split('+').sort().join('+')
  }

  private registerDefaults(): void {
    const defaults: Omit<KeyboardShortcut, 'isCustom'>[] = [
      { id: 'send', keys: 'ctrl+enter', action: 'send-message', description: 'Send message', context: 'chat', enabled: true, category: 'messaging' },
      { id: 'new-line', keys: 'shift+enter', action: 'new-line', description: 'New line in message', context: 'chat', enabled: true, category: 'messaging' },
      { id: 'search', keys: 'ctrl+k', action: 'open-search', description: 'Open search', context: 'global', enabled: true, category: 'navigation' },
      { id: 'new-chat', keys: 'ctrl+n', action: 'new-conversation', description: 'New conversation', context: 'global', enabled: true, category: 'navigation' },
      { id: 'close', keys: 'escape', action: 'close-modal', description: 'Close modal/panel', context: 'global', enabled: true, category: 'navigation' },
      { id: 'toggle-sidebar', keys: 'ctrl+b', action: 'toggle-sidebar', description: 'Toggle sidebar', context: 'global', enabled: true, category: 'navigation' },
      { id: 'settings', keys: 'ctrl+,', action: 'open-settings', description: 'Open settings', context: 'global', enabled: true, category: 'navigation' },
      { id: 'help', keys: 'ctrl+/', action: 'show-shortcuts', description: 'Show keyboard shortcuts', context: 'global', enabled: true, category: 'help' },
      { id: 'focus-input', keys: 'ctrl+l', action: 'focus-input', description: 'Focus message input', context: 'chat', enabled: true, category: 'navigation' },
      { id: 'prev-conversation', keys: 'alt+arrowup', action: 'prev-conversation', description: 'Previous conversation', context: 'sidebar', enabled: true, category: 'navigation' },
      { id: 'next-conversation', keys: 'alt+arrowdown', action: 'next-conversation', description: 'Next conversation', context: 'sidebar', enabled: true, category: 'navigation' },
      { id: 'copy-last', keys: 'ctrl+shift+c', action: 'copy-last-response', description: 'Copy last response', context: 'chat', enabled: true, category: 'messaging' },
      { id: 'clear-input', keys: 'ctrl+shift+backspace', action: 'clear-input', description: 'Clear input', context: 'chat', enabled: true, category: 'messaging' },
    ]

    for (const d of defaults) {
      this.register({ ...d, isCustom: false })
    }
  }
}

export const keyboardShortcutsService = new KeyboardShortcutsService()
