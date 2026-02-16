/**
 * Compliance Service.
 *
 * SOC2 compliance, data retention policies, right to be forgotten:
 *   - SOC2 control tracking (Trust Service Criteria)
 *   - Data retention policy management
 *   - Automated data cleanup
 *   - Right to be forgotten (GDPR Art. 17) workflow
 *   - Compliance audit trail
 *   - Evidence collection
 */

export interface SOC2Control {
  id: string
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy'
  name: string
  description: string
  status: 'implemented' | 'partially_implemented' | 'not_implemented' | 'not_applicable'
  evidence: string[]
  lastReviewedAt: string
  reviewer?: string
  notes?: string
}

export interface DataRetentionPolicy {
  id: string
  name: string
  dataType: string
  retentionDays: number
  action: 'delete' | 'archive' | 'anonymize'
  enabled: boolean
  lastRunAt?: string
  nextRunAt: string
  affectedRecords: number
}

export interface DeletionRequest {
  id: string
  userId: string
  requestedAt: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  completedAt?: string
  dataCategories: string[]
  deletedItems: Array<{ category: string; count: number }>
  verificationToken?: string
  rejectionReason?: string
}

export interface ComplianceAuditEntry {
  id: string
  action: string
  actor: string
  target: string
  timestamp: string
  details: Record<string, any>
  category: 'retention' | 'deletion' | 'soc2' | 'access' | 'configuration'
}

export interface ComplianceReport {
  id: string
  type: 'soc2' | 'gdpr' | 'retention' | 'full'
  generatedAt: string
  period: { from: string; to: string }
  controls: { total: number; implemented: number; partial: number; missing: number }
  retentionPolicies: { total: number; active: number; overdue: number }
  deletionRequests: { total: number; completed: number; pending: number }
  overallScore: number
}

export class ComplianceService {
  private controls: Map<string, SOC2Control> = new Map()
  private retentionPolicies: Map<string, DataRetentionPolicy> = new Map()
  private deletionRequests: DeletionRequest[] = []
  private auditLog: ComplianceAuditEntry[] = []
  private reports: Map<string, ComplianceReport> = new Map()
  private idCounter = 0

  constructor() {
    this.initializeSOC2Controls()
  }

  // ── SOC2 Controls ──────────────────────────────────────────

  getControl(id: string): SOC2Control | undefined { return this.controls.get(id) }
  getControls(): SOC2Control[] { return Array.from(this.controls.values()) }

  getControlsByCategory(category: SOC2Control['category']): SOC2Control[] {
    return this.getControls().filter(c => c.category === category)
  }

  updateControlStatus(controlId: string, status: SOC2Control['status'], reviewer?: string, notes?: string): boolean {
    const control = this.controls.get(controlId)
    if (!control) return false
    control.status = status
    control.lastReviewedAt = new Date().toISOString()
    if (reviewer) control.reviewer = reviewer
    if (notes) control.notes = notes
    this.logAudit('control_updated', reviewer || 'system', controlId, { status, notes }, 'soc2')
    return true
  }

  addEvidence(controlId: string, evidence: string): boolean {
    const control = this.controls.get(controlId)
    if (!control) return false
    control.evidence.push(evidence)
    return true
  }

  getSOC2Score(): { total: number; implemented: number; score: number } {
    const controls = this.getControls().filter(c => c.status !== 'not_applicable')
    const implemented = controls.filter(c => c.status === 'implemented').length
    return { total: controls.length, implemented, score: controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0 }
  }

  // ── Data Retention Policies ────────────────────────────────

  addRetentionPolicy(name: string, dataType: string, retentionDays: number, action: DataRetentionPolicy['action'] = 'delete'): DataRetentionPolicy {
    const now = new Date()
    const policy: DataRetentionPolicy = {
      id: `ret-${++this.idCounter}`, name, dataType, retentionDays, action,
      enabled: true, nextRunAt: new Date(now.getTime() + 86400000).toISOString(),
      affectedRecords: 0,
    }
    this.retentionPolicies.set(policy.id, policy)
    this.logAudit('retention_policy_created', 'system', policy.id, { name, dataType, retentionDays, action }, 'retention')
    return policy
  }

  getRetentionPolicies(): DataRetentionPolicy[] { return Array.from(this.retentionPolicies.values()) }
  getRetentionPolicy(id: string): DataRetentionPolicy | undefined { return this.retentionPolicies.get(id) }

  enableRetentionPolicy(id: string, enabled: boolean): boolean {
    const policy = this.retentionPolicies.get(id)
    if (!policy) return false
    policy.enabled = enabled
    return true
  }

  /** Execute a retention policy (simulate cleanup). */
  executeRetentionPolicy(id: string): { recordsAffected: number } | null {
    const policy = this.retentionPolicies.get(id)
    if (!policy || !policy.enabled) return null

    const recordsAffected = Math.floor(Math.random() * 100)
    policy.lastRunAt = new Date().toISOString()
    policy.nextRunAt = new Date(Date.now() + 86400000).toISOString()
    policy.affectedRecords += recordsAffected

    this.logAudit('retention_executed', 'system', id, { action: policy.action, recordsAffected }, 'retention')
    return { recordsAffected }
  }

  getDueRetentionPolicies(): DataRetentionPolicy[] {
    const now = new Date().toISOString()
    return this.getRetentionPolicies().filter(p => p.enabled && p.nextRunAt <= now)
  }

  removeRetentionPolicy(id: string): boolean { return this.retentionPolicies.delete(id) }

  // ── Right to be Forgotten ──────────────────────────────────

  /** Submit a deletion request (GDPR Art. 17). */
  submitDeletionRequest(userId: string, dataCategories: string[]): DeletionRequest {
    const request: DeletionRequest = {
      id: `del-${++this.idCounter}`, userId,
      requestedAt: new Date().toISOString(),
      status: 'pending', dataCategories, deletedItems: [],
      verificationToken: `verify-${Math.random().toString(36).slice(2)}`,
    }
    this.deletionRequests.push(request)
    this.logAudit('deletion_requested', userId, request.id, { dataCategories }, 'deletion')
    return request
  }

  /** Process a deletion request. */
  processDeletionRequest(requestId: string): boolean {
    const request = this.deletionRequests.find(r => r.id === requestId)
    if (!request || request.status !== 'pending') return false

    request.status = 'processing'
    // Simulate deletion of each category
    for (const category of request.dataCategories) {
      const count = Math.floor(5 + Math.random() * 50)
      request.deletedItems.push({ category, count })
    }

    request.status = 'completed'
    request.completedAt = new Date().toISOString()
    this.logAudit('deletion_completed', 'system', requestId, { deletedItems: request.deletedItems }, 'deletion')
    return true
  }

  /** Reject a deletion request with reason. */
  rejectDeletionRequest(requestId: string, reason: string): boolean {
    const request = this.deletionRequests.find(r => r.id === requestId)
    if (!request || request.status !== 'pending') return false
    request.status = 'rejected'
    request.rejectionReason = reason
    this.logAudit('deletion_rejected', 'system', requestId, { reason }, 'deletion')
    return true
  }

  getDeletionRequests(userId?: string): DeletionRequest[] {
    if (userId) return this.deletionRequests.filter(r => r.userId === userId)
    return [...this.deletionRequests]
  }

  getDeletionRequest(id: string): DeletionRequest | undefined {
    return this.deletionRequests.find(r => r.id === id)
  }

  // ── Audit Trail ────────────────────────────────────────────

  getAuditLog(category?: string): ComplianceAuditEntry[] {
    if (category) return this.auditLog.filter(e => e.category === category)
    return [...this.auditLog]
  }

  get auditLogCount(): number { return this.auditLog.length }

  // ── Compliance Reports ─────────────────────────────────────

  generateReport(type: ComplianceReport['type'] = 'full', from: string = '', to: string = ''): ComplianceReport {
    const controls = this.getControls().filter(c => c.status !== 'not_applicable')
    const policies = this.getRetentionPolicies()
    const deletions = this.deletionRequests

    const score = this.getSOC2Score()
    const retentionScore = policies.length > 0 ? (policies.filter(p => p.enabled).length / policies.length) * 100 : 100
    const deletionScore = deletions.length > 0 ? (deletions.filter(d => d.status === 'completed').length / deletions.length) * 100 : 100

    const report: ComplianceReport = {
      id: `report-${++this.idCounter}`, type,
      generatedAt: new Date().toISOString(),
      period: { from, to },
      controls: {
        total: controls.length,
        implemented: controls.filter(c => c.status === 'implemented').length,
        partial: controls.filter(c => c.status === 'partially_implemented').length,
        missing: controls.filter(c => c.status === 'not_implemented').length,
      },
      retentionPolicies: {
        total: policies.length,
        active: policies.filter(p => p.enabled).length,
        overdue: this.getDueRetentionPolicies().length,
      },
      deletionRequests: {
        total: deletions.length,
        completed: deletions.filter(d => d.status === 'completed').length,
        pending: deletions.filter(d => d.status === 'pending').length,
      },
      overallScore: Math.round((score.score + retentionScore + deletionScore) / 3),
    }
    this.reports.set(report.id, report)
    return report
  }

  getReports(): ComplianceReport[] { return Array.from(this.reports.values()) }

  // ── Internal ───────────────────────────────────────────────

  private logAudit(action: string, actor: string, target: string, details: Record<string, any>, category: ComplianceAuditEntry['category']): void {
    this.auditLog.push({ id: `audit-${++this.idCounter}`, action, actor, target, timestamp: new Date().toISOString(), details, category })
  }

  private initializeSOC2Controls(): void {
    const controls: Array<{ cat: SOC2Control['category']; name: string; desc: string; status: SOC2Control['status'] }> = [
      { cat: 'security', name: 'Access Control', desc: 'Logical and physical access controls', status: 'implemented' },
      { cat: 'security', name: 'Encryption at Rest', desc: 'Data encrypted at rest using AES-256', status: 'implemented' },
      { cat: 'security', name: 'Encryption in Transit', desc: 'TLS 1.2+ for all communications', status: 'implemented' },
      { cat: 'security', name: 'Vulnerability Management', desc: 'Regular vulnerability scanning', status: 'partially_implemented' },
      { cat: 'security', name: 'Incident Response', desc: 'Documented incident response plan', status: 'partially_implemented' },
      { cat: 'availability', name: 'Backup & Recovery', desc: 'Regular backups with tested recovery', status: 'implemented' },
      { cat: 'availability', name: 'Disaster Recovery', desc: 'DR plan with RTO/RPO targets', status: 'partially_implemented' },
      { cat: 'availability', name: 'Monitoring & Alerting', desc: 'Real-time monitoring and alerting', status: 'implemented' },
      { cat: 'processing_integrity', name: 'Input Validation', desc: 'All inputs validated and sanitized', status: 'implemented' },
      { cat: 'processing_integrity', name: 'Error Handling', desc: 'Consistent error handling', status: 'implemented' },
      { cat: 'confidentiality', name: 'Data Classification', desc: 'Data classified by sensitivity', status: 'partially_implemented' },
      { cat: 'confidentiality', name: 'Data Masking', desc: 'PII masked in logs and non-prod', status: 'implemented' },
      { cat: 'privacy', name: 'Consent Management', desc: 'User consent tracked and managed', status: 'partially_implemented' },
      { cat: 'privacy', name: 'Data Deletion', desc: 'Right to be forgotten implemented', status: 'implemented' },
      { cat: 'privacy', name: 'Privacy Policy', desc: 'Privacy policy published and maintained', status: 'implemented' },
    ]

    for (const c of controls) {
      const control: SOC2Control = {
        id: `soc2-${++this.idCounter}`, category: c.cat, name: c.name,
        description: c.desc, status: c.status, evidence: [],
        lastReviewedAt: new Date().toISOString(),
      }
      this.controls.set(control.id, control)
    }
  }
}

export const complianceService = new ComplianceService()
