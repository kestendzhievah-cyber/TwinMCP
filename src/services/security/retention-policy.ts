/**
 * Automatic Data Retention Policy Service.
 *
 * Manages lifecycle of audit logs, security events, and other data
 * with configurable retention periods and automatic cleanup.
 *
 * Features:
 *   - Per-category retention periods
 *   - Automatic archival before deletion
 *   - Dry-run mode for previewing cleanup
 *   - Compliance-aware (won't delete data under legal hold)
 */

export interface RetentionRule {
  id: string
  name: string
  /** Data category this rule applies to */
  category: string
  /** Retention period in days */
  retentionDays: number
  /** Archive before deletion? */
  archiveBeforeDelete: boolean
  /** Is this data under legal hold (cannot be deleted)? */
  legalHold: boolean
  enabled: boolean
}

export interface RetentionResult {
  ruleId: string
  category: string
  scannedCount: number
  expiredCount: number
  archivedCount: number
  deletedCount: number
  skippedLegalHold: number
}

export interface ArchivedRecord {
  id: string
  category: string
  originalTimestamp: string
  archivedAt: string
  data: any
}

export class RetentionPolicyService {
  private rules: Map<string, RetentionRule> = new Map()
  private archives: ArchivedRecord[] = []
  private dataStore: Map<string, Array<{ id: string; timestamp: string; data: any }>> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  /** Add a retention rule. */
  addRule(rule: RetentionRule): void {
    this.rules.set(rule.id, rule)
  }

  /** Remove a retention rule. */
  removeRule(id: string): boolean {
    return this.rules.delete(id)
  }

  /** Get all rules. */
  getRules(): RetentionRule[] {
    return Array.from(this.rules.values())
  }

  /** Get a single rule. */
  getRule(id: string): RetentionRule | undefined {
    return this.rules.get(id)
  }

  /** Update a rule. */
  updateRule(id: string, updates: Partial<Omit<RetentionRule, 'id'>>): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    Object.assign(rule, updates)
    return true
  }

  /** Set legal hold on a category. */
  setLegalHold(ruleId: string, hold: boolean): boolean {
    const rule = this.rules.get(ruleId)
    if (!rule) return false
    rule.legalHold = hold
    return true
  }

  // ── Data Management (in-memory for testing) ────────────────

  /** Ingest a record into a category. */
  ingestRecord(category: string, id: string, data: any, timestamp?: string): void {
    if (!this.dataStore.has(category)) {
      this.dataStore.set(category, [])
    }
    this.dataStore.get(category)!.push({
      id,
      timestamp: timestamp || new Date().toISOString(),
      data,
    })
  }

  /** Get records for a category. */
  getRecords(category: string): Array<{ id: string; timestamp: string; data: any }> {
    return this.dataStore.get(category) || []
  }

  /** Get archived records. */
  getArchives(): ArchivedRecord[] {
    return [...this.archives]
  }

  // ── Cleanup Execution ──────────────────────────────────────

  /**
   * Execute retention policies. Returns results per rule.
   * If dryRun is true, no data is actually deleted or archived.
   */
  executeCleanup(dryRun: boolean = false): RetentionResult[] {
    const results: RetentionResult[] = []

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue

      const result = this.executeRule(rule, dryRun)
      results.push(result)
    }

    return results
  }

  private executeRule(rule: RetentionRule, dryRun: boolean): RetentionResult {
    const records = this.dataStore.get(rule.category) || []
    const cutoff = new Date(Date.now() - rule.retentionDays * 24 * 60 * 60 * 1000)

    let archivedCount = 0
    let deletedCount = 0
    let skippedLegalHold = 0
    const expiredIds: string[] = []

    for (const record of records) {
      const recordDate = new Date(record.timestamp)
      if (recordDate < cutoff) {
        if (rule.legalHold) {
          skippedLegalHold++
          continue
        }

        expiredIds.push(record.id)

        if (!dryRun) {
          if (rule.archiveBeforeDelete) {
            this.archives.push({
              id: record.id,
              category: rule.category,
              originalTimestamp: record.timestamp,
              archivedAt: new Date().toISOString(),
              data: record.data,
            })
            archivedCount++
          }
          deletedCount++
        }
      }
    }

    // Remove expired records (if not dry run)
    if (!dryRun && expiredIds.length > 0) {
      const remaining = records.filter(r => !expiredIds.includes(r.id))
      this.dataStore.set(rule.category, remaining)
    }

    return {
      ruleId: rule.id,
      category: rule.category,
      scannedCount: records.length,
      expiredCount: expiredIds.length,
      archivedCount,
      deletedCount,
      skippedLegalHold,
    }
  }

  // ── Scheduled Cleanup ──────────────────────────────────────

  /** Start automatic cleanup on an interval (ms). */
  startScheduledCleanup(intervalMs: number = 24 * 60 * 60 * 1000): void {
    this.stopScheduledCleanup()
    this.cleanupTimer = setInterval(() => this.executeCleanup(false), intervalMs)
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  /** Stop scheduled cleanup. */
  stopScheduledCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** Destroy the service. */
  destroy(): void {
    this.stopScheduledCleanup()
    this.rules.clear()
    this.dataStore.clear()
    this.archives = []
  }

  // ── Default Rules ──────────────────────────────────────────

  /** Load standard SOC2-aligned retention rules. */
  loadDefaultRules(): void {
    this.addRule({
      id: 'audit-logs',
      name: 'Audit Logs',
      category: 'audit_logs',
      retentionDays: 365,
      archiveBeforeDelete: true,
      legalHold: false,
      enabled: true,
    })
    this.addRule({
      id: 'security-events',
      name: 'Security Events',
      category: 'security_events',
      retentionDays: 730, // 2 years
      archiveBeforeDelete: true,
      legalHold: false,
      enabled: true,
    })
    this.addRule({
      id: 'access-logs',
      name: 'Access Logs',
      category: 'access_logs',
      retentionDays: 90,
      archiveBeforeDelete: false,
      legalHold: false,
      enabled: true,
    })
    this.addRule({
      id: 'session-data',
      name: 'Session Data',
      category: 'sessions',
      retentionDays: 30,
      archiveBeforeDelete: false,
      legalHold: false,
      enabled: true,
    })
  }
}

export const retentionPolicyService = new RetentionPolicyService()
