/**
 * Chat Macros/Templates Service.
 *
 * Manages reusable message templates and macros:
 *   - Template CRUD with variables
 *   - Macro expansion (shortcodes)
 *   - Category organization
 *   - Usage tracking
 *   - Import/Export
 */

export interface ChatMacro {
  id: string
  name: string
  shortcode: string // e.g. "/explain", "/review"
  template: string
  variables: string[] // extracted from {{var}} placeholders
  category: string
  description?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface MacroExpansion {
  original: string
  expanded: string
  macroId: string
  variables: Record<string, string>
}

export class ChatMacrosService {
  private macros: Map<string, ChatMacro> = new Map()
  private idCounter = 0

  constructor() {
    this.registerDefaults()
  }

  // ── CRUD ───────────────────────────────────────────────────

  create(name: string, shortcode: string, template: string, category: string = 'general', description?: string): ChatMacro {
    const variables = this.extractVariables(template)
    const macro: ChatMacro = {
      id: `macro-${++this.idCounter}`,
      name, shortcode: shortcode.startsWith('/') ? shortcode : `/${shortcode}`,
      template, variables, category, description,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.macros.set(macro.id, macro)
    return macro
  }

  get(id: string): ChatMacro | undefined {
    return this.macros.get(id)
  }

  getByShortcode(shortcode: string): ChatMacro | undefined {
    const normalized = shortcode.startsWith('/') ? shortcode : `/${shortcode}`
    return this.getAll().find(m => m.shortcode === normalized)
  }

  getAll(): ChatMacro[] {
    return Array.from(this.macros.values())
  }

  getByCategory(category: string): ChatMacro[] {
    return this.getAll().filter(m => m.category === category)
  }

  getCategories(): string[] {
    return [...new Set(this.getAll().map(m => m.category))]
  }

  update(id: string, updates: Partial<Pick<ChatMacro, 'name' | 'shortcode' | 'template' | 'category' | 'description'>>): boolean {
    const macro = this.macros.get(id)
    if (!macro) return false
    if (updates.name) macro.name = updates.name
    if (updates.shortcode) macro.shortcode = updates.shortcode.startsWith('/') ? updates.shortcode : `/${updates.shortcode}`
    if (updates.template) {
      macro.template = updates.template
      macro.variables = this.extractVariables(updates.template)
    }
    if (updates.category) macro.category = updates.category
    if (updates.description !== undefined) macro.description = updates.description
    macro.updatedAt = new Date().toISOString()
    return true
  }

  remove(id: string): boolean {
    return this.macros.delete(id)
  }

  get size(): number { return this.macros.size }

  // ── Expansion ──────────────────────────────────────────────

  /** Expand a shortcode with optional variables. */
  expand(input: string, variables: Record<string, string> = {}): MacroExpansion | null {
    // Parse shortcode from input: "/shortcode arg1 arg2" or "/shortcode"
    const match = input.match(/^(\/\S+)(.*)$/)
    if (!match) return null

    const shortcode = match[1]
    const macro = this.getByShortcode(shortcode)
    if (!macro) return null

    // Parse positional args from remaining text
    const args = match[2].trim()
    const positionalVars = this.parsePositionalArgs(args, macro.variables)
    const mergedVars = { ...positionalVars, ...variables }

    let expanded = macro.template
    for (const [key, value] of Object.entries(mergedVars)) {
      expanded = expanded.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }

    // Remove unfilled variables
    expanded = expanded.replace(/\{\{[^}]+\}\}/g, '')

    macro.usageCount++

    return {
      original: input,
      expanded: expanded.trim(),
      macroId: macro.id,
      variables: mergedVars,
    }
  }

  /** Check if input starts with a known shortcode. */
  isShortcode(input: string): boolean {
    const match = input.match(/^(\/\S+)/)
    if (!match) return false
    return !!this.getByShortcode(match[1])
  }

  /** Get autocomplete suggestions for a partial shortcode. */
  autocomplete(prefix: string): ChatMacro[] {
    if (!prefix.startsWith('/')) return []
    const lower = prefix.toLowerCase()
    return this.getAll().filter(m => m.shortcode.toLowerCase().startsWith(lower))
  }

  // ── Import/Export ──────────────────────────────────────────

  exportMacros(): string {
    const macros = this.getAll().filter(m => !this.isDefault(m.shortcode))
    return JSON.stringify(macros, null, 2)
  }

  importMacros(json: string): number {
    const macros = JSON.parse(json) as ChatMacro[]
    let count = 0
    for (const m of macros) {
      if (!this.getByShortcode(m.shortcode)) {
        this.create(m.name, m.shortcode, m.template, m.category, m.description)
        count++
      }
    }
    return count
  }

  // ── Internal ───────────────────────────────────────────────

  private extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))]
  }

  private parsePositionalArgs(args: string, variables: string[]): Record<string, string> {
    if (!args) return {}
    const result: Record<string, string> = {}

    // If only one variable, use entire args string
    if (variables.length === 1) {
      result[variables[0]] = args
      return result
    }

    // Split by | or , for multiple variables
    const parts = args.split(/[|,]/).map(s => s.trim())
    for (let i = 0; i < Math.min(parts.length, variables.length); i++) {
      if (parts[i]) result[variables[i]] = parts[i]
    }

    return result
  }

  private isDefault(shortcode: string): boolean {
    return ['/explain', '/review', '/summarize', '/translate', '/fix'].includes(shortcode)
  }

  private registerDefaults(): void {
    this.create('Explain', '/explain', 'Explain the following in simple terms:\n\n{{topic}}', 'general', 'Explain a topic simply')
    this.create('Code Review', '/review', 'Review the following code for bugs, performance, and best practices:\n\n```\n{{code}}\n```', 'development', 'Review code')
    this.create('Summarize', '/summarize', 'Summarize the following text concisely:\n\n{{text}}', 'general', 'Summarize text')
    this.create('Translate', '/translate', 'Translate the following to {{language}}:\n\n{{text}}', 'general', 'Translate text')
    this.create('Fix Code', '/fix', 'Fix the following code and explain what was wrong:\n\n```\n{{code}}\n```', 'development', 'Fix buggy code')
  }
}

export const chatMacrosService = new ChatMacrosService()
