/**
 * Documentation Change Detection Service.
 *
 * Detects changes in documentation sources by comparing content snapshots:
 *   - Content hash comparison for quick change detection
 *   - Diff generation between versions
 *   - Section-level change tracking
 *   - Change classification (added, modified, removed)
 *   - Notification triggers for significant changes
 */

export interface DocSnapshot {
  id: string
  sourceId: string
  url: string
  contentHash: string
  content: string
  sections: DocSection[]
  capturedAt: string
  version: number
}

export interface DocSection {
  id: string
  title: string
  content: string
  hash: string
  level: number
}

export interface DocChange {
  id: string
  sourceId: string
  url: string
  changeType: 'added' | 'modified' | 'removed'
  severity: 'major' | 'minor' | 'patch'
  previousVersion: number
  currentVersion: number
  detectedAt: string
  sections: SectionChange[]
  summary: string
}

export interface SectionChange {
  sectionTitle: string
  changeType: 'added' | 'modified' | 'removed'
  previousContent?: string
  currentContent?: string
  diffSummary: string
}

export type ChangeNotificationFn = (change: DocChange) => void

export class DocChangeDetectorService {
  private snapshots: Map<string, DocSnapshot[]> = new Map() // sourceId → snapshots (ordered by version)
  private changes: DocChange[] = []
  private notificationCallbacks: ChangeNotificationFn[] = []
  private idCounter = 0

  // ── Snapshot Management ────────────────────────────────────

  /** Take a snapshot of a document. */
  takeSnapshot(sourceId: string, url: string, content: string): DocSnapshot {
    const existing = this.snapshots.get(sourceId) || []
    const version = existing.length + 1
    const sections = this.extractSections(content)

    const snapshot: DocSnapshot = {
      id: `snap-${++this.idCounter}`,
      sourceId,
      url,
      contentHash: this.hash(content),
      content,
      sections,
      capturedAt: new Date().toISOString(),
      version,
    }

    existing.push(snapshot)
    this.snapshots.set(sourceId, existing)

    return snapshot
  }

  /** Get the latest snapshot for a source. */
  getLatestSnapshot(sourceId: string): DocSnapshot | undefined {
    const snaps = this.snapshots.get(sourceId)
    return snaps ? snaps[snaps.length - 1] : undefined
  }

  /** Get all snapshots for a source. */
  getSnapshots(sourceId: string): DocSnapshot[] {
    return this.snapshots.get(sourceId) || []
  }

  /** Get snapshot count across all sources. */
  get totalSnapshots(): number {
    let count = 0
    for (const snaps of this.snapshots.values()) count += snaps.length
    return count
  }

  // ── Change Detection ───────────────────────────────────────

  /** Detect changes between the latest two snapshots of a source. */
  detectChanges(sourceId: string): DocChange | null {
    const snaps = this.snapshots.get(sourceId)
    if (!snaps || snaps.length < 2) return null

    const previous = snaps[snaps.length - 2]
    const current = snaps[snaps.length - 1]

    // Quick hash check
    if (previous.contentHash === current.contentHash) return null

    return this.compareSnapshots(previous, current)
  }

  /** Compare two specific snapshots. */
  compareSnapshots(previous: DocSnapshot, current: DocSnapshot): DocChange | null {
    if (previous.contentHash === current.contentHash) return null

    const sectionChanges = this.compareSections(previous.sections, current.sections)
    if (sectionChanges.length === 0 && previous.contentHash === current.contentHash) return null

    const severity = this.classifySeverity(sectionChanges, previous.content, current.content)
    const changeType = this.classifyChangeType(sectionChanges)

    const change: DocChange = {
      id: `chg-${++this.idCounter}`,
      sourceId: current.sourceId,
      url: current.url,
      changeType,
      severity,
      previousVersion: previous.version,
      currentVersion: current.version,
      detectedAt: new Date().toISOString(),
      sections: sectionChanges,
      summary: this.generateSummary(sectionChanges, severity),
    }

    this.changes.push(change)

    // Notify
    for (const cb of this.notificationCallbacks) {
      try { cb(change) } catch { /* ignore */ }
    }

    return change
  }

  /** Check a new content against the latest snapshot and auto-snapshot if changed. */
  checkForChanges(sourceId: string, url: string, newContent: string): DocChange | null {
    const latest = this.getLatestSnapshot(sourceId)

    if (!latest) {
      // First snapshot, no change to detect
      this.takeSnapshot(sourceId, url, newContent)
      return null
    }

    const newHash = this.hash(newContent)
    if (newHash === latest.contentHash) return null

    // Content changed — take new snapshot and detect
    this.takeSnapshot(sourceId, url, newContent)
    return this.detectChanges(sourceId)
  }

  // ── Notifications ──────────────────────────────────────────

  /** Register a change notification callback. */
  onChange(callback: ChangeNotificationFn): void {
    this.notificationCallbacks.push(callback)
  }

  /** Get all detected changes. */
  getChanges(sourceId?: string): DocChange[] {
    if (sourceId) return this.changes.filter(c => c.sourceId === sourceId)
    return [...this.changes]
  }

  /** Get change count. */
  get changeCount(): number {
    return this.changes.length
  }

  // ── Section Comparison ─────────────────────────────────────

  private compareSections(previous: DocSection[], current: DocSection[]): SectionChange[] {
    const changes: SectionChange[] = []
    const prevMap = new Map(previous.map(s => [s.title, s]))
    const currMap = new Map(current.map(s => [s.title, s]))

    // Check for modified and removed sections
    for (const [title, prevSection] of prevMap) {
      const currSection = currMap.get(title)
      if (!currSection) {
        changes.push({
          sectionTitle: title,
          changeType: 'removed',
          previousContent: prevSection.content,
          diffSummary: `Section "${title}" was removed`,
        })
      } else if (prevSection.hash !== currSection.hash) {
        changes.push({
          sectionTitle: title,
          changeType: 'modified',
          previousContent: prevSection.content,
          currentContent: currSection.content,
          diffSummary: this.generateDiffSummary(prevSection.content, currSection.content),
        })
      }
    }

    // Check for added sections
    for (const [title, currSection] of currMap) {
      if (!prevMap.has(title)) {
        changes.push({
          sectionTitle: title,
          changeType: 'added',
          currentContent: currSection.content,
          diffSummary: `New section "${title}" added`,
        })
      }
    }

    return changes
  }

  private generateDiffSummary(prev: string, curr: string): string {
    const prevWords = prev.split(/\s+/).length
    const currWords = curr.split(/\s+/).length
    const diff = currWords - prevWords

    if (diff > 0) return `Content expanded by ~${diff} words`
    if (diff < 0) return `Content reduced by ~${Math.abs(diff)} words`
    return 'Content modified (same length)'
  }

  // ── Classification ─────────────────────────────────────────

  private classifySeverity(sectionChanges: SectionChange[], prevContent: string, currContent: string): 'major' | 'minor' | 'patch' {
    const addedOrRemoved = sectionChanges.filter(c => c.changeType === 'added' || c.changeType === 'removed')
    if (addedOrRemoved.length > 0) return 'major'

    const prevLen = prevContent.length
    const currLen = currContent.length
    const changePct = Math.abs(currLen - prevLen) / Math.max(prevLen, 1)

    if (changePct > 0.3) return 'major'
    if (changePct > 0.1) return 'minor'
    return 'patch'
  }

  private classifyChangeType(sectionChanges: SectionChange[]): 'added' | 'modified' | 'removed' {
    const types = new Set(sectionChanges.map(c => c.changeType))
    if (types.has('removed') && !types.has('added')) return 'removed'
    if (types.has('added') && !types.has('removed')) return 'added'
    return 'modified'
  }

  private generateSummary(sectionChanges: SectionChange[], severity: string): string {
    const added = sectionChanges.filter(c => c.changeType === 'added').length
    const modified = sectionChanges.filter(c => c.changeType === 'modified').length
    const removed = sectionChanges.filter(c => c.changeType === 'removed').length

    const parts: string[] = []
    if (added > 0) parts.push(`${added} section(s) added`)
    if (modified > 0) parts.push(`${modified} section(s) modified`)
    if (removed > 0) parts.push(`${removed} section(s) removed`)

    return `[${severity.toUpperCase()}] ${parts.join(', ') || 'Content changed'}`
  }

  // ── Helpers ────────────────────────────────────────────────

  private extractSections(content: string): DocSection[] {
    const sections: DocSection[] = []
    // Split by markdown headings
    const lines = content.split('\n')
    let currentTitle = 'Introduction'
    let currentContent: string[] = []
    let currentLevel = 0

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
      if (headingMatch) {
        // Save previous section
        if (currentContent.length > 0 || sections.length === 0) {
          const text = currentContent.join('\n').trim()
          if (text) {
            sections.push({
              id: `sec-${sections.length}`,
              title: currentTitle,
              content: text,
              hash: this.hash(text),
              level: currentLevel,
            })
          }
        }
        currentTitle = headingMatch[2].trim()
        currentLevel = headingMatch[1].length
        currentContent = []
      } else {
        currentContent.push(line)
      }
    }

    // Last section
    const lastText = currentContent.join('\n').trim()
    if (lastText) {
      sections.push({
        id: `sec-${sections.length}`,
        title: currentTitle,
        content: lastText,
        hash: this.hash(lastText),
        level: currentLevel,
      })
    }

    return sections
  }

  private hash(content: string): string {
    let h = 0
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) - h + content.charCodeAt(i)) | 0
    }
    return Math.abs(h).toString(16)
  }
}

export const docChangeDetectorService = new DocChangeDetectorService()
