/**
 * Content Validation Service.
 *
 * Validates crawled content quality before indexing:
 *   - Minimum content length
 *   - Encoding validation (UTF-8)
 *   - Duplicate detection (content hash)
 *   - Spam / low-quality detection
 *   - Broken link detection
 *   - Structure validation (headings, code blocks)
 *   - Freshness check (outdated content)
 */

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  rule: string
  severity: ValidationSeverity
  message: string
  details?: string
}

export interface ValidationResult {
  isValid: boolean
  score: number // 0-100
  issues: ValidationIssue[]
  stats: {
    wordCount: number
    charCount: number
    headingCount: number
    codeBlockCount: number
    linkCount: number
    imageCount: number
  }
}

export interface ValidationRule {
  id: string
  name: string
  enabled: boolean
  severity: ValidationSeverity
  check: (content: string, metadata?: Record<string, any>) => ValidationIssue | null
}

export class ContentValidatorService {
  private rules: Map<string, ValidationRule> = new Map()
  private contentHashes: Set<string> = new Set()

  constructor() {
    this.registerDefaultRules()
  }

  // ── Rule Management ────────────────────────────────────────

  /** Register a custom validation rule. */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule)
  }

  /** Remove a rule. */
  removeRule(id: string): boolean {
    return this.rules.delete(id)
  }

  /** Enable/disable a rule. */
  setRuleEnabled(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    rule.enabled = enabled
    return true
  }

  /** Get all rules. */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values())
  }

  // ── Validation ─────────────────────────────────────────────

  /** Validate content against all enabled rules. */
  validate(content: string, metadata?: Record<string, any>): ValidationResult {
    const issues: ValidationIssue[] = []

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue
      const issue = rule.check(content, metadata)
      if (issue) issues.push(issue)
    }

    const stats = this.computeStats(content)
    const score = this.computeScore(issues, stats)
    const hasErrors = issues.some(i => i.severity === 'error')

    return {
      isValid: !hasErrors,
      score,
      issues,
      stats,
    }
  }

  /** Quick check: is content valid (no errors)? */
  isValid(content: string, metadata?: Record<string, any>): boolean {
    return this.validate(content, metadata).isValid
  }

  /** Check if content is a duplicate. */
  isDuplicate(content: string): boolean {
    const hash = this.hash(content)
    return this.contentHashes.has(hash)
  }

  /** Register content hash (for dedup tracking). */
  registerContent(content: string): void {
    this.contentHashes.add(this.hash(content))
  }

  /** Clear duplicate tracking. */
  clearHashes(): void {
    this.contentHashes.clear()
  }

  /** Get registered hash count. */
  get hashCount(): number {
    return this.contentHashes.size
  }

  // ── Stats ──────────────────────────────────────────────────

  private computeStats(content: string) {
    return {
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
      charCount: content.length,
      headingCount: (content.match(/^#{1,6}\s/gm) || []).length,
      codeBlockCount: (content.match(/```/g) || []).length / 2,
      linkCount: (content.match(/\[.*?\]\(.*?\)/g) || content.match(/https?:\/\/\S+/g) || []).length,
      imageCount: (content.match(/!\[.*?\]\(.*?\)/g) || []).length,
    }
  }

  private computeScore(issues: ValidationIssue[], stats: { wordCount: number; headingCount: number; codeBlockCount: number }): number {
    let score = 100

    for (const issue of issues) {
      if (issue.severity === 'error') score -= 30
      else if (issue.severity === 'warning') score -= 10
      else score -= 3
    }

    // Bonus for well-structured content
    if (stats.headingCount >= 2) score += 5
    if (stats.codeBlockCount >= 1) score += 5
    if (stats.wordCount >= 200) score += 5

    return Math.max(0, Math.min(100, score))
  }

  // ── Default Rules ──────────────────────────────────────────

  private registerDefaultRules(): void {
    this.registerRule({
      id: 'min-length',
      name: 'Minimum Content Length',
      enabled: true,
      severity: 'error',
      check: (content) => {
        if (content.trim().length < 50) {
          return { rule: 'min-length', severity: 'error', message: 'Content too short (minimum 50 characters)', details: `Length: ${content.trim().length}` }
        }
        return null
      },
    })

    this.registerRule({
      id: 'max-length',
      name: 'Maximum Content Length',
      enabled: true,
      severity: 'warning',
      check: (content) => {
        if (content.length > 500000) {
          return { rule: 'max-length', severity: 'warning', message: 'Content very large (>500KB)', details: `Length: ${content.length}` }
        }
        return null
      },
    })

    this.registerRule({
      id: 'encoding',
      name: 'UTF-8 Encoding Check',
      enabled: true,
      severity: 'error',
      check: (content) => {
        // Check for replacement characters indicating encoding issues
        if (/\uFFFD/.test(content)) {
          return { rule: 'encoding', severity: 'error', message: 'Content contains encoding errors (replacement characters found)' }
        }
        return null
      },
    })

    this.registerRule({
      id: 'duplicate',
      name: 'Duplicate Content Detection',
      enabled: true,
      severity: 'warning',
      check: (content) => {
        if (this.isDuplicate(content)) {
          return { rule: 'duplicate', severity: 'warning', message: 'Duplicate content detected' }
        }
        return null
      },
    })

    this.registerRule({
      id: 'spam',
      name: 'Spam / Low Quality Detection',
      enabled: true,
      severity: 'warning',
      check: (content) => {
        const words = content.split(/\s+/)
        if (words.length === 0) return null

        // Check for excessive repetition
        const wordFreq = new Map<string, number>()
        for (const w of words) {
          const lower = w.toLowerCase()
          wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1)
        }

        const maxFreq = Math.max(...wordFreq.values())
        if (maxFreq > words.length * 0.3 && words.length > 10) {
          return { rule: 'spam', severity: 'warning', message: 'Content appears to be low quality (excessive word repetition)' }
        }

        return null
      },
    })

    this.registerRule({
      id: 'broken-links',
      name: 'Broken Link Detection',
      enabled: true,
      severity: 'info',
      check: (content) => {
        const links = content.match(/\[.*?\]\((.*?)\)/g) || []
        const broken = links.filter(l => {
          const url = l.match(/\((.*?)\)/)?.[1] || ''
          return url.startsWith('#') === false && url.length === 0
        })

        if (broken.length > 0) {
          return { rule: 'broken-links', severity: 'info', message: `${broken.length} potentially broken link(s) found` }
        }
        return null
      },
    })

    this.registerRule({
      id: 'has-structure',
      name: 'Content Structure Check',
      enabled: true,
      severity: 'info',
      check: (content) => {
        const headings = (content.match(/^#{1,6}\s/gm) || []).length
        const words = content.split(/\s+/).length

        if (words > 500 && headings === 0) {
          return { rule: 'has-structure', severity: 'info', message: 'Long content without headings — consider adding structure' }
        }
        return null
      },
    })

    this.registerRule({
      id: 'freshness',
      name: 'Content Freshness Check',
      enabled: true,
      severity: 'info',
      check: (_content, metadata) => {
        if (!metadata?.lastModified) return null

        const daysSince = (Date.now() - new Date(metadata.lastModified).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince > 365) {
          return { rule: 'freshness', severity: 'info', message: `Content may be outdated (last modified ${Math.round(daysSince)} days ago)` }
        }
        return null
      },
    })
  }

  // ── Helpers ────────────────────────────────────────────────

  private hash(content: string): string {
    let h = 0
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) - h + content.charCodeAt(i)) | 0
    }
    return Math.abs(h).toString(16)
  }
}

export const contentValidatorService = new ContentValidatorService()
