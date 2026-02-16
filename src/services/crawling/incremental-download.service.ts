/**
 * Incremental Download & Cleanup Service.
 *
 * Efficient download management:
 *   - Incremental downloads (ETag/Last-Modified tracking)
 *   - Delta downloads (only changed content)
 *   - Resume interrupted downloads
 *   - Automatic cleanup of stale/expired files
 *   - Storage quota management
 *   - Download deduplication
 */

export interface DownloadRecord {
  id: string
  url: string
  localPath: string
  etag?: string
  lastModified?: string
  contentHash: string
  sizeBytes: number
  downloadedAt: string
  lastCheckedAt: string
  status: 'current' | 'stale' | 'expired' | 'deleted'
  checkCount: number
  deltaDownloads: number
}

export interface CleanupPolicy {
  id: string
  name: string
  maxAgeDays: number
  maxSizeBytes: number
  pattern: string
  action: 'delete' | 'archive' | 'compress'
  enabled: boolean
}

export interface CleanupResult {
  policyId: string
  filesScanned: number
  filesAffected: number
  bytesFreed: number
  executedAt: string
}

export interface StorageQuota {
  maxBytes: number
  usedBytes: number
  fileCount: number
  warningThreshold: number
}

export interface ResumeState {
  downloadId: string
  url: string
  bytesDownloaded: number
  totalBytes: number
  rangeHeader: string
  createdAt: string
}

export class IncrementalDownloadService {
  private records: Map<string, DownloadRecord> = new Map()
  private cleanupPolicies: Map<string, CleanupPolicy> = new Map()
  private cleanupResults: CleanupResult[] = []
  private resumeStates: Map<string, ResumeState> = new Map()
  private quota: StorageQuota = { maxBytes: 10 * 1024 * 1024 * 1024, usedBytes: 0, fileCount: 0, warningThreshold: 0.8 }
  private idCounter = 0

  // ── Incremental Downloads ──────────────────────────────────

  /** Check if a URL needs re-downloading based on ETag/Last-Modified. */
  checkForUpdates(url: string, currentEtag?: string, currentLastModified?: string): { needsDownload: boolean; reason: string } {
    const existing = this.findByUrl(url)
    if (!existing) return { needsDownload: true, reason: 'new_resource' }

    existing.lastCheckedAt = new Date().toISOString()
    existing.checkCount++

    if (currentEtag && existing.etag && currentEtag !== existing.etag) {
      return { needsDownload: true, reason: 'etag_changed' }
    }
    if (currentLastModified && existing.lastModified && currentLastModified !== existing.lastModified) {
      return { needsDownload: true, reason: 'last_modified_changed' }
    }
    return { needsDownload: false, reason: 'unchanged' }
  }

  /** Register a completed download. */
  registerDownload(url: string, localPath: string, sizeBytes: number, options: { etag?: string; lastModified?: string; contentHash?: string } = {}): DownloadRecord {
    const existing = this.findByUrl(url)
    if (existing) {
      existing.localPath = localPath
      existing.sizeBytes = sizeBytes
      existing.etag = options.etag || existing.etag
      existing.lastModified = options.lastModified || existing.lastModified
      existing.contentHash = options.contentHash || existing.contentHash
      existing.downloadedAt = new Date().toISOString()
      existing.lastCheckedAt = new Date().toISOString()
      existing.status = 'current'
      existing.deltaDownloads++
      this.updateQuota()
      return existing
    }

    const record: DownloadRecord = {
      id: `dl-${++this.idCounter}`, url, localPath,
      etag: options.etag, lastModified: options.lastModified,
      contentHash: options.contentHash || this.hashString(url + Date.now()),
      sizeBytes, downloadedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      status: 'current', checkCount: 1, deltaDownloads: 0,
    }
    this.records.set(record.id, record)
    this.updateQuota()
    return record
  }

  /** Check for duplicate content by hash. */
  findDuplicate(contentHash: string): DownloadRecord | undefined {
    return Array.from(this.records.values()).find(r => r.contentHash === contentHash && r.status === 'current')
  }

  findByUrl(url: string): DownloadRecord | undefined {
    return Array.from(this.records.values()).find(r => r.url === url)
  }

  getRecords(): DownloadRecord[] { return Array.from(this.records.values()) }
  getRecord(id: string): DownloadRecord | undefined { return this.records.get(id) }

  /** Mark stale records (not checked within N days). */
  markStale(maxAgeDays: number): number {
    const cutoff = Date.now() - maxAgeDays * 86400000
    let count = 0
    for (const record of this.records.values()) {
      if (record.status === 'current' && new Date(record.lastCheckedAt).getTime() < cutoff) {
        record.status = 'stale'
        count++
      }
    }
    return count
  }

  // ── Resume Support ─────────────────────────────────────────

  saveResumeState(downloadId: string, url: string, bytesDownloaded: number, totalBytes: number): ResumeState {
    const state: ResumeState = {
      downloadId, url, bytesDownloaded, totalBytes,
      rangeHeader: `bytes=${bytesDownloaded}-`,
      createdAt: new Date().toISOString(),
    }
    this.resumeStates.set(downloadId, state)
    return state
  }

  getResumeState(downloadId: string): ResumeState | undefined { return this.resumeStates.get(downloadId) }
  clearResumeState(downloadId: string): boolean { return this.resumeStates.delete(downloadId) }
  getPendingResumes(): ResumeState[] { return Array.from(this.resumeStates.values()) }

  // ── Cleanup Policies ───────────────────────────────────────

  addCleanupPolicy(name: string, maxAgeDays: number, maxSizeBytes: number, pattern: string = '*', action: CleanupPolicy['action'] = 'delete'): CleanupPolicy {
    const policy: CleanupPolicy = {
      id: `cleanup-${++this.idCounter}`, name, maxAgeDays, maxSizeBytes, pattern, action, enabled: true,
    }
    this.cleanupPolicies.set(policy.id, policy)
    return policy
  }

  getCleanupPolicies(): CleanupPolicy[] { return Array.from(this.cleanupPolicies.values()) }
  removeCleanupPolicy(id: string): boolean { return this.cleanupPolicies.delete(id) }

  /** Execute a cleanup policy. */
  executeCleanup(policyId: string): CleanupResult | null {
    const policy = this.cleanupPolicies.get(policyId)
    if (!policy || !policy.enabled) return null

    const cutoff = Date.now() - policy.maxAgeDays * 86400000
    let filesAffected = 0
    let bytesFreed = 0
    let filesScanned = 0

    for (const record of this.records.values()) {
      filesScanned++
      const matchesPattern = policy.pattern === '*' || record.localPath.includes(policy.pattern)
      const isOld = new Date(record.downloadedAt).getTime() < cutoff
      const isOversize = record.sizeBytes > policy.maxSizeBytes

      if (matchesPattern && (isOld || isOversize) && record.status !== 'deleted') {
        if (policy.action === 'delete') {
          record.status = 'deleted'
        } else if (policy.action === 'archive') {
          record.status = 'expired'
        }
        bytesFreed += record.sizeBytes
        filesAffected++
      }
    }

    const result: CleanupResult = { policyId, filesScanned, filesAffected, bytesFreed, executedAt: new Date().toISOString() }
    this.cleanupResults.push(result)
    this.updateQuota()
    return result
  }

  /** Run all enabled cleanup policies. */
  runAllCleanups(): CleanupResult[] {
    const results: CleanupResult[] = []
    for (const policy of this.cleanupPolicies.values()) {
      if (policy.enabled) {
        const result = this.executeCleanup(policy.id)
        if (result) results.push(result)
      }
    }
    return results
  }

  getCleanupResults(): CleanupResult[] { return [...this.cleanupResults] }

  // ── Storage Quota ──────────────────────────────────────────

  getQuota(): StorageQuota { return { ...this.quota } }
  setMaxQuota(maxBytes: number): void { this.quota.maxBytes = maxBytes }

  isQuotaExceeded(): boolean { return this.quota.usedBytes >= this.quota.maxBytes }
  isQuotaWarning(): boolean { return this.quota.usedBytes >= this.quota.maxBytes * this.quota.warningThreshold }

  private updateQuota(): void {
    const active = Array.from(this.records.values()).filter(r => r.status === 'current' || r.status === 'stale')
    this.quota.usedBytes = active.reduce((s, r) => s + r.sizeBytes, 0)
    this.quota.fileCount = active.length
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16)
  }
}

export const incrementalDownloadService = new IncrementalDownloadService()
