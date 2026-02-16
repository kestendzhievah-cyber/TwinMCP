/**
 * Error Tracking Service.
 *
 * Captures, groups, and analyzes application errors:
 *   - Error capture with context (stack, breadcrumbs, user, tags)
 *   - Fingerprinting and grouping
 *   - Error frequency and trend analysis
 *   - Sentry-compatible payload generation
 *   - Alert thresholds
 *   - Resolution workflow
 */

export interface CapturedError {
  id: string
  fingerprint: string
  message: string
  stack?: string
  level: 'fatal' | 'error' | 'warning' | 'info'
  timestamp: string
  context: ErrorContext
  tags: Record<string, string>
  breadcrumbs: Breadcrumb[]
  status: 'unresolved' | 'resolved' | 'ignored' | 'muted'
  occurrences: number
  firstSeen: string
  lastSeen: string
  assignee?: string
}

export interface ErrorContext {
  userId?: string
  sessionId?: string
  url?: string
  method?: string
  statusCode?: number
  userAgent?: string
  ip?: string
  environment: string
  release?: string
  serverName?: string
  extra?: Record<string, any>
}

export interface Breadcrumb {
  timestamp: string
  category: string
  message: string
  level: 'debug' | 'info' | 'warning' | 'error'
  data?: Record<string, any>
}

export interface ErrorGroup {
  fingerprint: string
  message: string
  level: string
  count: number
  firstSeen: string
  lastSeen: string
  status: string
  events: string[] // error IDs
}

export interface ErrorTrend {
  period: string
  count: number
  newErrors: number
  resolvedErrors: number
}

export interface SentryPayload {
  event_id: string
  timestamp: string
  level: string
  message: { formatted: string }
  exception?: { values: Array<{ type: string; value: string; stacktrace?: { frames: Array<{ filename: string; lineno: number; function: string }> } }> }
  tags: Record<string, string>
  environment: string
  release?: string
  breadcrumbs?: { values: Breadcrumb[] }
  user?: { id?: string; ip_address?: string; username?: string }
}

export interface AlertThreshold {
  id: string
  name: string
  condition: 'count' | 'rate' | 'new'
  threshold: number
  windowMinutes: number
  enabled: boolean
}

export class ErrorTrackingService {
  private errors: Map<string, CapturedError> = new Map()
  private groups: Map<string, ErrorGroup> = new Map()
  private thresholds: Map<string, AlertThreshold> = new Map()
  private triggeredAlerts: Array<{ thresholdId: string; timestamp: string; message: string }> = []
  private idCounter = 0

  // ── Capture ────────────────────────────────────────────────

  capture(message: string, options: { stack?: string; level?: CapturedError['level']; context?: Partial<ErrorContext>; tags?: Record<string, string>; breadcrumbs?: Breadcrumb[] } = {}): CapturedError {
    const fingerprint = this.generateFingerprint(message, options.stack)
    const now = new Date().toISOString()

    // Check if group exists
    const existing = this.groups.get(fingerprint)
    if (existing) {
      existing.count++
      existing.lastSeen = now
      // Find and update the existing error
      const existingError = Array.from(this.errors.values()).find(e => e.fingerprint === fingerprint)
      if (existingError) {
        existingError.occurrences++
        existingError.lastSeen = now
        existing.events.push(existingError.id)
        this.checkThresholds()
        return existingError
      }
    }

    const error: CapturedError = {
      id: `err-${++this.idCounter}`,
      fingerprint, message,
      stack: options.stack,
      level: options.level || 'error',
      timestamp: now,
      context: { environment: 'production', ...options.context },
      tags: options.tags || {},
      breadcrumbs: options.breadcrumbs || [],
      status: 'unresolved',
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
    }

    this.errors.set(error.id, error)

    // Update or create group
    if (existing) {
      existing.events.push(error.id)
    } else {
      this.groups.set(fingerprint, {
        fingerprint, message, level: error.level,
        count: 1, firstSeen: now, lastSeen: now,
        status: 'unresolved', events: [error.id],
      })
    }

    this.checkThresholds()
    return error
  }

  // ── Retrieval ──────────────────────────────────────────────

  getError(id: string): CapturedError | undefined {
    return this.errors.get(id)
  }

  getErrors(status?: string): CapturedError[] {
    let results = Array.from(this.errors.values())
    if (status) results = results.filter(e => e.status === status)
    return results.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
  }

  getGroups(): ErrorGroup[] {
    return Array.from(this.groups.values()).sort((a, b) => b.count - a.count)
  }

  getGroup(fingerprint: string): ErrorGroup | undefined {
    return this.groups.get(fingerprint)
  }

  get totalErrors(): number { return this.errors.size }
  get totalGroups(): number { return this.groups.size }

  // ── Resolution ─────────────────────────────────────────────

  resolve(errorId: string): boolean {
    const error = this.errors.get(errorId)
    if (!error) return false
    error.status = 'resolved'
    const group = this.groups.get(error.fingerprint)
    if (group) group.status = 'resolved'
    return true
  }

  ignore(errorId: string): boolean {
    const error = this.errors.get(errorId)
    if (!error) return false
    error.status = 'ignored'
    return true
  }

  mute(fingerprint: string): boolean {
    const group = this.groups.get(fingerprint)
    if (!group) return false
    group.status = 'muted'
    for (const eid of group.events) {
      const e = this.errors.get(eid)
      if (e) e.status = 'muted'
    }
    return true
  }

  assign(errorId: string, assignee: string): boolean {
    const error = this.errors.get(errorId)
    if (!error) return false
    error.assignee = assignee
    return true
  }

  // ── Trends ─────────────────────────────────────────────────

  getTrends(granularity: 'hour' | 'day' | 'week' = 'day', periods: number = 7): ErrorTrend[] {
    const trends: ErrorTrend[] = []
    const now = Date.now()
    const granMs = granularity === 'hour' ? 3600000 : granularity === 'day' ? 86400000 : 604800000

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = now - (i + 1) * granMs
      const periodEnd = now - i * granMs
      const periodErrors = Array.from(this.errors.values()).filter(e => {
        const t = new Date(e.timestamp).getTime()
        return t >= periodStart && t < periodEnd
      })

      trends.push({
        period: new Date(periodStart).toISOString().slice(0, 10),
        count: periodErrors.length,
        newErrors: periodErrors.filter(e => e.occurrences === 1).length,
        resolvedErrors: periodErrors.filter(e => e.status === 'resolved').length,
      })
    }

    return trends
  }

  // ── Sentry-compatible Payload ──────────────────────────────

  toSentryPayload(errorId: string): SentryPayload | null {
    const error = this.errors.get(errorId)
    if (!error) return null

    const frames = error.stack ? this.parseStack(error.stack) : []

    return {
      event_id: error.id,
      timestamp: error.timestamp,
      level: error.level,
      message: { formatted: error.message },
      exception: error.stack ? {
        values: [{
          type: 'Error',
          value: error.message,
          stacktrace: { frames },
        }],
      } : undefined,
      tags: error.tags,
      environment: error.context.environment,
      release: error.context.release,
      breadcrumbs: error.breadcrumbs.length > 0 ? { values: error.breadcrumbs } : undefined,
      user: error.context.userId ? { id: error.context.userId, ip_address: error.context.ip } : undefined,
    }
  }

  // ── Alert Thresholds ───────────────────────────────────────

  addThreshold(name: string, condition: AlertThreshold['condition'], threshold: number, windowMinutes: number = 60): AlertThreshold {
    const t: AlertThreshold = {
      id: `threshold-${++this.idCounter}`,
      name, condition, threshold, windowMinutes, enabled: true,
    }
    this.thresholds.set(t.id, t)
    return t
  }

  getThresholds(): AlertThreshold[] {
    return Array.from(this.thresholds.values())
  }

  getTriggeredAlerts(): Array<{ thresholdId: string; timestamp: string; message: string }> {
    return [...this.triggeredAlerts]
  }

  removeThreshold(id: string): boolean {
    return this.thresholds.delete(id)
  }

  // ── Internal ───────────────────────────────────────────────

  private generateFingerprint(message: string, stack?: string): string {
    const key = stack ? `${message}::${stack.split('\n')[0]}` : message
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i)
      hash |= 0
    }
    return `fp-${Math.abs(hash).toString(36)}`
  }

  private parseStack(stack: string): Array<{ filename: string; lineno: number; function: string }> {
    return stack.split('\n').slice(1, 6).map(line => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+)/)
      if (match) return { function: match[1], filename: match[2], lineno: parseInt(match[3]) }
      return { function: 'anonymous', filename: 'unknown', lineno: 0 }
    })
  }

  private checkThresholds(): void {
    const now = Date.now()
    for (const t of this.thresholds.values()) {
      if (!t.enabled) continue
      const windowStart = now - t.windowMinutes * 60000
      const recentErrors = Array.from(this.errors.values()).filter(e => new Date(e.timestamp).getTime() >= windowStart)

      let triggered = false
      if (t.condition === 'count' && recentErrors.length >= t.threshold) triggered = true
      if (t.condition === 'new' && recentErrors.filter(e => e.occurrences === 1).length >= t.threshold) triggered = true
      if (t.condition === 'rate') {
        const rate = recentErrors.length / (t.windowMinutes / 60)
        if (rate >= t.threshold) triggered = true
      }

      if (triggered) {
        this.triggeredAlerts.push({
          thresholdId: t.id,
          timestamp: new Date().toISOString(),
          message: `Alert "${t.name}": ${t.condition} threshold (${t.threshold}) exceeded`,
        })
      }
    }
  }
}

export const errorTrackingService = new ErrorTrackingService()
