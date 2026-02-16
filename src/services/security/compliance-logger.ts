/**
 * SOC2 Compliance Logging Service.
 *
 * Provides structured, tamper-evident audit logging aligned with SOC2
 * Trust Service Criteria (TSC):
 *   - CC6: Logical and Physical Access Controls
 *   - CC7: System Operations
 *   - CC8: Change Management
 *
 * Features:
 *   - Immutable log entries with SHA-256 chain hashing
 *   - Structured event categories mapped to SOC2 controls
 *   - Log integrity verification
 *   - Export for compliance auditors
 */

import crypto from 'crypto'

export type SOC2Category =
  | 'access_control'      // CC6 — login, logout, permission changes
  | 'data_access'         // CC6 — read/write sensitive data
  | 'system_operations'   // CC7 — deployments, restarts, config changes
  | 'change_management'   // CC8 — code changes, schema migrations
  | 'incident_response'   // CC7 — security incidents, alerts
  | 'availability'        // A1  — uptime, failover events

export type Severity = 'info' | 'warning' | 'critical'

export interface ComplianceLogEntry {
  id: string
  timestamp: string
  category: SOC2Category
  severity: Severity
  actor: {
    userId?: string
    email?: string
    role?: string
    ipAddress?: string
    userAgent?: string
  }
  action: string
  resource: {
    type: string
    id?: string
    name?: string
  }
  outcome: 'success' | 'failure' | 'denied'
  details?: Record<string, any>
  /** SHA-256 hash of this entry + previous hash for tamper detection */
  hash: string
  previousHash: string
}

export interface ComplianceReport {
  generatedAt: string
  period: { from: string; to: string }
  summary: {
    totalEvents: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    byOutcome: Record<string, number>
    integrityValid: boolean
  }
  entries: ComplianceLogEntry[]
}

export class ComplianceLogger {
  private logs: ComplianceLogEntry[] = []
  private lastHash: string = '0'.repeat(64)

  /** Log a compliance event. */
  log(entry: Omit<ComplianceLogEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>): ComplianceLogEntry {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const previousHash = this.lastHash

    const record: ComplianceLogEntry = {
      id,
      timestamp,
      ...entry,
      hash: '', // computed below
      previousHash,
    }

    record.hash = this.computeHash(record)
    this.lastHash = record.hash
    this.logs.push(record)

    return record
  }

  // ── Convenience Methods ────────────────────────────────────

  logAccessControl(
    actor: ComplianceLogEntry['actor'],
    action: string,
    resource: ComplianceLogEntry['resource'],
    outcome: ComplianceLogEntry['outcome'],
    details?: Record<string, any>
  ): ComplianceLogEntry {
    return this.log({
      category: 'access_control',
      severity: outcome === 'denied' ? 'warning' : 'info',
      actor,
      action,
      resource,
      outcome,
      details,
    })
  }

  logDataAccess(
    actor: ComplianceLogEntry['actor'],
    action: string,
    resource: ComplianceLogEntry['resource'],
    outcome: ComplianceLogEntry['outcome'],
    details?: Record<string, any>
  ): ComplianceLogEntry {
    return this.log({
      category: 'data_access',
      severity: 'info',
      actor,
      action,
      resource,
      outcome,
      details,
    })
  }

  logSystemOperation(
    action: string,
    resource: ComplianceLogEntry['resource'],
    outcome: ComplianceLogEntry['outcome'],
    details?: Record<string, any>
  ): ComplianceLogEntry {
    return this.log({
      category: 'system_operations',
      severity: outcome === 'failure' ? 'critical' : 'info',
      actor: { userId: 'system' },
      action,
      resource,
      outcome,
      details,
    })
  }

  logIncident(
    severity: Severity,
    action: string,
    resource: ComplianceLogEntry['resource'],
    details?: Record<string, any>
  ): ComplianceLogEntry {
    return this.log({
      category: 'incident_response',
      severity,
      actor: { userId: 'system' },
      action,
      resource,
      outcome: 'failure',
      details,
    })
  }

  // ── Query & Reporting ──────────────────────────────────────

  /** Get all logs. */
  getLogs(): ComplianceLogEntry[] {
    return [...this.logs]
  }

  /** Query logs by category. */
  getByCategory(category: SOC2Category): ComplianceLogEntry[] {
    return this.logs.filter(l => l.category === category)
  }

  /** Query logs by severity. */
  getBySeverity(severity: Severity): ComplianceLogEntry[] {
    return this.logs.filter(l => l.severity === severity)
  }

  /** Query logs within a time range. */
  getByTimeRange(from: Date, to: Date): ComplianceLogEntry[] {
    return this.logs.filter(l => {
      const t = new Date(l.timestamp)
      return t >= from && t <= to
    })
  }

  /** Verify the integrity of the entire log chain. */
  verifyIntegrity(): { valid: boolean; brokenAt?: number } {
    let prevHash = '0'.repeat(64)

    for (let i = 0; i < this.logs.length; i++) {
      const entry = this.logs[i]

      if (entry.previousHash !== prevHash) {
        return { valid: false, brokenAt: i }
      }

      const computed = this.computeHash(entry)
      if (computed !== entry.hash) {
        return { valid: false, brokenAt: i }
      }

      prevHash = entry.hash
    }

    return { valid: true }
  }

  /** Generate a compliance report for a time period. */
  generateReport(from: Date, to: Date): ComplianceReport {
    const entries = this.getByTimeRange(from, to)

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const byOutcome: Record<string, number> = {}

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1
    }

    return {
      generatedAt: new Date().toISOString(),
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalEvents: entries.length,
        byCategory,
        bySeverity,
        byOutcome,
        integrityValid: this.verifyIntegrity().valid,
      },
      entries,
    }
  }

  /** Get total log count. */
  get size(): number {
    return this.logs.length
  }

  // ── Internal ───────────────────────────────────────────────

  private computeHash(entry: ComplianceLogEntry): string {
    const payload = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      category: entry.category,
      severity: entry.severity,
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome,
      details: entry.details,
      previousHash: entry.previousHash,
    })
    return crypto.createHash('sha256').update(payload).digest('hex')
  }
}

export const complianceLogger = new ComplianceLogger()
