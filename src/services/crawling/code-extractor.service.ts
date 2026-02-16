/**
 * Advanced Code Example Extraction Service.
 *
 * Extracts, classifies, and enriches code examples from documentation:
 *   - Fenced code block extraction (```lang ... ```)
 *   - Inline code detection
 *   - Language auto-detection
 *   - Import/dependency extraction
 *   - Complexity scoring
 *   - Runnable example detection
 *   - Context extraction (surrounding explanation)
 */

export interface CodeExample {
  id: string
  code: string
  language: string
  title: string
  description: string
  imports: string[]
  dependencies: string[]
  complexity: 'beginner' | 'intermediate' | 'advanced'
  isRunnable: boolean
  lineCount: number
  sourceUrl?: string
  context: string
  tags: string[]
}

export interface ExtractionResult {
  examples: CodeExample[]
  stats: {
    total: number
    byLanguage: Record<string, number>
    byComplexity: Record<string, number>
    runnableCount: number
  }
}

export class CodeExtractorService {
  private idCounter = 0

  /**
   * Extract all code examples from a document.
   */
  extract(content: string, sourceUrl?: string): ExtractionResult {
    const examples: CodeExample[] = []

    // Extract fenced code blocks
    const fencedBlocks = this.extractFencedBlocks(content, sourceUrl)
    examples.push(...fencedBlocks)

    // Extract indented code blocks (4+ spaces)
    const indentedBlocks = this.extractIndentedBlocks(content, sourceUrl)
    examples.push(...indentedBlocks)

    // Build stats
    const byLanguage: Record<string, number> = {}
    const byComplexity: Record<string, number> = {}
    let runnableCount = 0

    for (const ex of examples) {
      byLanguage[ex.language] = (byLanguage[ex.language] || 0) + 1
      byComplexity[ex.complexity] = (byComplexity[ex.complexity] || 0) + 1
      if (ex.isRunnable) runnableCount++
    }

    return {
      examples,
      stats: {
        total: examples.length,
        byLanguage,
        byComplexity,
        runnableCount,
      },
    }
  }

  /**
   * Extract fenced code blocks (```lang ... ```).
   */
  private extractFencedBlocks(content: string, sourceUrl?: string): CodeExample[] {
    const examples: CodeExample[] = []
    const regex = /```(\w*)\n([\s\S]*?)```/g
    let match

    while ((match = regex.exec(content)) !== null) {
      const declaredLang = match[1] || ''
      const code = match[2].trim()
      if (!code) continue

      const language = declaredLang || this.detectLanguage(code)
      const context = this.extractContext(content, match.index)
      const imports = this.extractImports(code, language)
      const dependencies = this.extractDependencies(imports)

      examples.push({
        id: `code-${++this.idCounter}`,
        code,
        language,
        title: this.generateTitle(code, language, context),
        description: context.slice(0, 200),
        imports,
        dependencies,
        complexity: this.assessComplexity(code, language),
        isRunnable: this.isRunnable(code, language),
        lineCount: code.split('\n').length,
        sourceUrl,
        context,
        tags: this.generateTags(code, language, imports),
      })
    }

    return examples
  }

  /**
   * Extract indented code blocks (4+ spaces or tab).
   */
  private extractIndentedBlocks(content: string, sourceUrl?: string): CodeExample[] {
    const examples: CodeExample[] = []
    const lines = content.split('\n')
    let codeLines: string[] = []
    let startIdx = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^(\s{4}|\t)/.test(line) && line.trim().length > 0) {
        if (codeLines.length === 0) startIdx = i
        codeLines.push(line.replace(/^(\s{4}|\t)/, ''))
      } else {
        if (codeLines.length >= 3) { // At least 3 lines to count as a block
          const code = codeLines.join('\n').trim()
          const language = this.detectLanguage(code)
          const contextStart = Math.max(0, startIdx - 3)
          const context = lines.slice(contextStart, startIdx).join('\n').trim()

          examples.push({
            id: `code-${++this.idCounter}`,
            code,
            language,
            title: this.generateTitle(code, language, context),
            description: context.slice(0, 200),
            imports: this.extractImports(code, language),
            dependencies: this.extractDependencies(this.extractImports(code, language)),
            complexity: this.assessComplexity(code, language),
            isRunnable: this.isRunnable(code, language),
            lineCount: codeLines.length,
            sourceUrl,
            context,
            tags: this.generateTags(code, language, []),
          })
        }
        codeLines = []
      }
    }

    return examples
  }

  // ── Language Detection ─────────────────────────────────────

  /** Detect programming language from code content. */
  detectLanguage(code: string): string {
    const indicators: Record<string, RegExp[]> = {
      typescript: [/:\s*(string|number|boolean|any|void|never)\b/, /interface\s+\w+/, /type\s+\w+\s*=/, /<\w+>/, /as\s+\w+/],
      javascript: [/const\s+\w+\s*=/, /let\s+\w+\s*=/, /function\s+\w+/, /=>\s*{/, /require\(/, /module\.exports/],
      python: [/def\s+\w+\(/, /import\s+\w+/, /from\s+\w+\s+import/, /class\s+\w+:/, /if\s+__name__/],
      java: [/public\s+(class|static|void)/, /System\.out\./, /import\s+java\./, /private\s+\w+\s+\w+/],
      html: [/<html/i, /<div/i, /<head/i, /<body/i, /<!DOCTYPE/i],
      css: [/\{[\s\S]*?:\s*[\w#]+;/, /@media\s/, /\.[\w-]+\s*\{/, /#[\w-]+\s*\{/],
      bash: [/^#!/, /\$\(/, /echo\s/, /if\s+\[/, /fi$/m],
      json: [/^\s*\{[\s\S]*"[\w]+"\s*:/, /^\s*\[/],
      sql: [/SELECT\s/i, /FROM\s/i, /WHERE\s/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i],
      rust: [/fn\s+\w+/, /let\s+mut\s/, /impl\s+/, /pub\s+fn/, /use\s+std::/],
      go: [/func\s+\w+/, /package\s+\w+/, /import\s+\(/, /fmt\.Print/],
    }

    let bestLang = 'text'
    let bestScore = 0

    for (const [lang, patterns] of Object.entries(indicators)) {
      let score = 0
      for (const pattern of patterns) {
        if (pattern.test(code)) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestLang = lang
      }
    }

    return bestScore > 0 ? bestLang : 'text'
  }

  // ── Import Extraction ──────────────────────────────────────

  private extractImports(code: string, language: string): string[] {
    const imports: string[] = []

    if (language === 'javascript' || language === 'typescript') {
      // ES imports
      const esImports = code.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
      for (const m of esImports) imports.push(m[1])

      // CommonJS requires
      const cjsImports = code.matchAll(/require\(['"]([^'"]+)['"]\)/g)
      for (const m of cjsImports) imports.push(m[1])
    } else if (language === 'python') {
      const pyImports = code.matchAll(/(?:from\s+(\S+)\s+)?import\s+(\S+)/g)
      for (const m of pyImports) imports.push(m[1] || m[2])
    }

    return [...new Set(imports)]
  }

  private extractDependencies(imports: string[]): string[] {
    return imports
      .filter(i => !i.startsWith('.') && !i.startsWith('/'))
      .map(i => i.split('/')[0])
      .filter((v, i, a) => a.indexOf(v) === i)
  }

  // ── Complexity Assessment ──────────────────────────────────

  private assessComplexity(code: string, language: string): 'beginner' | 'intermediate' | 'advanced' {
    let score = 0
    const lines = code.split('\n').length

    // Line count
    if (lines > 30) score += 2
    else if (lines > 15) score += 1

    // Nesting depth
    const maxNesting = this.getMaxNesting(code)
    if (maxNesting > 3) score += 2
    else if (maxNesting > 2) score += 1

    // Advanced patterns
    const advancedPatterns = [
      /async\s+/, /await\s+/, /Promise/, /Observable/,
      /class\s+\w+\s+extends/, /implements\s+/,
      /\bgeneric\b/i, /<\w+\s*,\s*\w+>/, /\bdecorator\b/i,
      /\bcurry\b/i, /\bmonad\b/i, /\bfunctor\b/i,
    ]
    for (const p of advancedPatterns) {
      if (p.test(code)) score++
    }

    if (score >= 4) return 'advanced'
    if (score >= 2) return 'intermediate'
    return 'beginner'
  }

  private getMaxNesting(code: string): number {
    let max = 0, current = 0
    for (const ch of code) {
      if (ch === '{' || ch === '(') { current++; max = Math.max(max, current) }
      else if (ch === '}' || ch === ')') current = Math.max(0, current - 1)
    }
    return max
  }

  // ── Runnable Detection ─────────────────────────────────────

  private isRunnable(code: string, language: string): boolean {
    if (language === 'javascript' || language === 'typescript') {
      // Has a function call or top-level expression
      return /\w+\(/.test(code) && !/^\s*(interface|type|export\s+type)\s/m.test(code)
    }
    if (language === 'python') {
      return /\w+\(/.test(code) || /if\s+__name__/.test(code)
    }
    if (language === 'bash') return true
    if (language === 'html') return /<html/i.test(code)
    return false
  }

  // ── Context & Metadata ─────────────────────────────────────

  private extractContext(content: string, codeBlockIndex: number): string {
    // Get the text before the code block (up to 500 chars)
    const before = content.slice(Math.max(0, codeBlockIndex - 500), codeBlockIndex)
    const lines = before.split('\n').filter(l => l.trim().length > 0)
    return lines.slice(-3).join(' ').trim()
  }

  private generateTitle(code: string, language: string, context: string): string {
    // Try to extract function/class name
    const funcMatch = code.match(/(?:function|class|const|let|var|def|fn)\s+(\w+)/)
    if (funcMatch) return `${language}: ${funcMatch[1]}`

    // Use first meaningful line
    const firstLine = code.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('#'))
    if (firstLine) return `${language}: ${firstLine.trim().slice(0, 50)}`

    return `${language} example`
  }

  private generateTags(code: string, language: string, imports: string[]): string[] {
    const tags = new Set<string>([language])

    if (/async|await|Promise/.test(code)) tags.add('async')
    if (/class\s+\w+/.test(code)) tags.add('oop')
    if (/=>\s*/.test(code)) tags.add('arrow-functions')
    if (/test\(|describe\(|it\(|expect\(/.test(code)) tags.add('testing')
    if (/fetch\(|axios|http/.test(code)) tags.add('http')
    if (/useState|useEffect/.test(code)) tags.add('react-hooks')
    if (/express|app\.get|app\.post/.test(code)) tags.add('express')

    for (const imp of imports) {
      if (!imp.startsWith('.')) tags.add(imp.split('/')[0])
    }

    return Array.from(tags)
  }
}

export const codeExtractorService = new CodeExtractorService()
