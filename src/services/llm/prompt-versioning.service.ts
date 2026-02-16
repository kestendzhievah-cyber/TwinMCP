/**
 * Prompt Versioning Service.
 *
 * Manages prompt template versions with:
 *   - Semantic versioning (major.minor.patch)
 *   - Version history and diff
 *   - Rollback capability
 *   - Performance tracking per version
 *   - Publish/draft workflow
 */

export interface PromptVersion {
  id: string
  templateId: string
  version: string // semver
  content: string
  variables: string[]
  status: 'draft' | 'published' | 'archived' | 'rollback'
  createdAt: string
  publishedAt?: string
  author?: string
  changelog?: string
  metrics?: VersionMetrics
}

export interface VersionMetrics {
  usageCount: number
  avgQuality: number
  avgLatency: number
  avgCost: number
  errorRate: number
}

export interface VersionDiff {
  fromVersion: string
  toVersion: string
  addedLines: number
  removedLines: number
  changedVariables: { added: string[]; removed: string[] }
  contentDiff: string
}

export interface PromptTemplate {
  id: string
  name: string
  description?: string
  currentVersion: string
  versions: string[] // version strings
  createdAt: string
  updatedAt: string
}

export class PromptVersioningService {
  private templates: Map<string, PromptTemplate> = new Map()
  private versions: Map<string, PromptVersion> = new Map() // key: templateId:version
  private idCounter = 0

  // ── Template Management ────────────────────────────────────

  createTemplate(id: string, name: string, description?: string): PromptTemplate {
    const template: PromptTemplate = {
      id, name, description,
      currentVersion: '0.0.0',
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.templates.set(id, template)
    return template
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id)
  }

  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  removeTemplate(id: string): boolean {
    // Remove all versions
    const template = this.templates.get(id)
    if (template) {
      for (const v of template.versions) {
        this.versions.delete(`${id}:${v}`)
      }
    }
    return this.templates.delete(id)
  }

  // ── Version Management ─────────────────────────────────────

  /** Create a new version of a template. */
  createVersion(templateId: string, content: string, variables: string[], bump: 'major' | 'minor' | 'patch' = 'patch', changelog?: string, author?: string): PromptVersion | null {
    const template = this.templates.get(templateId)
    if (!template) return null

    // Bump from the latest version in the list, not currentVersion (which only updates on publish)
    const latestVersion = template.versions.length > 0
      ? template.versions[template.versions.length - 1]
      : '0.0.0'
    const newVersion = this.bumpVersion(latestVersion, bump)
    const key = `${templateId}:${newVersion}`

    const version: PromptVersion = {
      id: `pv-${++this.idCounter}`,
      templateId,
      version: newVersion,
      content,
      variables,
      status: 'draft',
      createdAt: new Date().toISOString(),
      changelog,
      author,
      metrics: { usageCount: 0, avgQuality: 0, avgLatency: 0, avgCost: 0, errorRate: 0 },
    }

    this.versions.set(key, version)
    template.versions.push(newVersion)
    template.updatedAt = new Date().toISOString()

    return version
  }

  /** Get a specific version. */
  getVersion(templateId: string, version: string): PromptVersion | undefined {
    return this.versions.get(`${templateId}:${version}`)
  }

  /** Get all versions for a template. */
  getVersions(templateId: string): PromptVersion[] {
    const template = this.templates.get(templateId)
    if (!template) return []
    return template.versions
      .map(v => this.versions.get(`${templateId}:${v}`))
      .filter((v): v is PromptVersion => v !== undefined)
  }

  /** Get the current published version. */
  getCurrentVersion(templateId: string): PromptVersion | undefined {
    const template = this.templates.get(templateId)
    if (!template || template.currentVersion === '0.0.0') return undefined
    return this.versions.get(`${templateId}:${template.currentVersion}`)
  }

  /** Publish a version (makes it the current active version). */
  publishVersion(templateId: string, version: string): boolean {
    const template = this.templates.get(templateId)
    const ver = this.versions.get(`${templateId}:${version}`)
    if (!template || !ver) return false

    // Archive previous published version
    const prev = this.getCurrentVersion(templateId)
    if (prev && prev.status === 'published') {
      prev.status = 'archived'
    }

    ver.status = 'published'
    ver.publishedAt = new Date().toISOString()
    template.currentVersion = version
    template.updatedAt = new Date().toISOString()

    return true
  }

  /** Rollback to a previous version. */
  rollback(templateId: string, targetVersion: string): boolean {
    const template = this.templates.get(templateId)
    const ver = this.versions.get(`${templateId}:${targetVersion}`)
    if (!template || !ver) return false

    // Archive current
    const current = this.getCurrentVersion(templateId)
    if (current) current.status = 'archived'

    ver.status = 'rollback'
    template.currentVersion = targetVersion
    template.updatedAt = new Date().toISOString()

    return true
  }

  // ── Diff ───────────────────────────────────────────────────

  /** Compare two versions. */
  diff(templateId: string, fromVersion: string, toVersion: string): VersionDiff | null {
    const from = this.versions.get(`${templateId}:${fromVersion}`)
    const to = this.versions.get(`${templateId}:${toVersion}`)
    if (!from || !to) return null

    const fromLines = from.content.split('\n')
    const toLines = to.content.split('\n')

    const fromSet = new Set(fromLines)
    const toSet = new Set(toLines)

    const addedLines = toLines.filter(l => !fromSet.has(l)).length
    const removedLines = fromLines.filter(l => !toSet.has(l)).length

    const fromVars = new Set(from.variables)
    const toVars = new Set(to.variables)
    const addedVars = to.variables.filter(v => !fromVars.has(v))
    const removedVars = from.variables.filter(v => !toVars.has(v))

    const contentDiff = addedLines === 0 && removedLines === 0
      ? 'No changes'
      : `+${addedLines} lines, -${removedLines} lines`

    return {
      fromVersion, toVersion,
      addedLines, removedLines,
      changedVariables: { added: addedVars, removed: removedVars },
      contentDiff,
    }
  }

  // ── Metrics ────────────────────────────────────────────────

  /** Record usage metrics for a version. */
  recordMetrics(templateId: string, version: string, quality: number, latencyMs: number, cost: number, isError: boolean = false): void {
    const ver = this.versions.get(`${templateId}:${version}`)
    if (!ver || !ver.metrics) return

    const m = ver.metrics
    const n = m.usageCount
    m.usageCount++
    m.avgQuality = (m.avgQuality * n + quality) / (n + 1)
    m.avgLatency = (m.avgLatency * n + latencyMs) / (n + 1)
    m.avgCost = (m.avgCost * n + cost) / (n + 1)
    m.errorRate = (m.errorRate * n + (isError ? 1 : 0)) / (n + 1)
  }

  /** Get metrics comparison between versions. */
  compareMetrics(templateId: string, versionA: string, versionB: string): { a: VersionMetrics | null; b: VersionMetrics | null } {
    const a = this.versions.get(`${templateId}:${versionA}`)?.metrics || null
    const b = this.versions.get(`${templateId}:${versionB}`)?.metrics || null
    return { a, b }
  }

  // ── Helpers ────────────────────────────────────────────────

  private bumpVersion(current: string, bump: 'major' | 'minor' | 'patch'): string {
    const parts = current.split('.').map(Number)
    if (parts.length !== 3) return '1.0.0'

    switch (bump) {
      case 'major': return `${parts[0] + 1}.0.0`
      case 'minor': return `${parts[0]}.${parts[1] + 1}.0`
      case 'patch': return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    }
  }
}

export const promptVersioningService = new PromptVersioningService()
