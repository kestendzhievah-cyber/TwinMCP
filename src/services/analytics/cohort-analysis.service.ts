/**
 * Cohort Analysis Service.
 *
 * Groups users into cohorts and tracks behavior over time:
 *   - Time-based cohorts (signup week/month)
 *   - Behavioral cohorts (first action)
 *   - Retention analysis
 *   - Revenue per cohort
 *   - Cohort comparison
 */

export interface CohortDefinition {
  id: string
  name: string
  type: 'time' | 'behavior' | 'custom'
  granularity: 'day' | 'week' | 'month'
  criteria?: string
  createdAt: string
}

export interface CohortUser {
  userId: string
  cohortId: string
  joinedAt: string
  properties?: Record<string, any>
}

export interface CohortEvent {
  userId: string
  eventName: string
  timestamp: string
  value?: number
}

export interface RetentionRow {
  cohortPeriod: string
  cohortSize: number
  periods: Array<{ period: number; activeUsers: number; retentionRate: number }>
}

export interface CohortReport {
  cohortId: string
  cohortName: string
  type: string
  totalUsers: number
  retention: RetentionRow[]
  avgRetention: number[]
  revenuePerCohort: Record<string, number>
}

export class CohortAnalysisService {
  private cohorts: Map<string, CohortDefinition> = new Map()
  private users: CohortUser[] = []
  private events: CohortEvent[] = []
  private idCounter = 0

  // ── Cohort Definition ──────────────────────────────────────

  createCohort(name: string, type: 'time' | 'behavior' | 'custom', granularity: 'day' | 'week' | 'month' = 'month', criteria?: string): CohortDefinition {
    const cohort: CohortDefinition = {
      id: `cohort-${++this.idCounter}`,
      name, type, granularity, criteria,
      createdAt: new Date().toISOString(),
    }
    this.cohorts.set(cohort.id, cohort)
    return cohort
  }

  getCohort(id: string): CohortDefinition | undefined {
    return this.cohorts.get(id)
  }

  getCohorts(): CohortDefinition[] {
    return Array.from(this.cohorts.values())
  }

  removeCohort(id: string): boolean {
    return this.cohorts.delete(id)
  }

  // ── User Assignment ────────────────────────────────────────

  addUser(userId: string, cohortId: string, joinedAt: string, properties?: Record<string, any>): void {
    this.users.push({ userId, cohortId, joinedAt, properties })
  }

  getCohortUsers(cohortId: string): CohortUser[] {
    return this.users.filter(u => u.cohortId === cohortId)
  }

  getUserCohorts(userId: string): CohortDefinition[] {
    const cohortIds = new Set(this.users.filter(u => u.userId === userId).map(u => u.cohortId))
    return this.getCohorts().filter(c => cohortIds.has(c.id))
  }

  /** Auto-assign users to time-based cohorts. */
  autoAssignTimeCohort(cohortId: string, usersWithDates: Array<{ userId: string; signupDate: string; properties?: Record<string, any> }>): number {
    const cohort = this.cohorts.get(cohortId)
    if (!cohort || cohort.type !== 'time') return 0
    let count = 0
    for (const u of usersWithDates) {
      this.addUser(u.userId, cohortId, u.signupDate, u.properties)
      count++
    }
    return count
  }

  get totalUsers(): number { return this.users.length }

  // ── Event Tracking ─────────────────────────────────────────

  trackEvent(userId: string, eventName: string, value?: number): void {
    this.events.push({ userId, eventName, timestamp: new Date().toISOString(), value })
  }

  trackEventAt(userId: string, eventName: string, timestamp: string, value?: number): void {
    this.events.push({ userId, eventName, timestamp, value })
  }

  get totalEvents(): number { return this.events.length }

  // ── Retention Analysis ─────────────────────────────────────

  analyzeRetention(cohortId: string, eventName: string, periods: number = 6): CohortReport {
    const cohort = this.cohorts.get(cohortId)
    if (!cohort) {
      return { cohortId, cohortName: 'Unknown', type: 'unknown', totalUsers: 0, retention: [], avgRetention: [], revenuePerCohort: {} }
    }

    const cohortUsers = this.getCohortUsers(cohortId)
    const granMs = this.granularityToMs(cohort.granularity)

    // Group users by their join period
    const periodGroups = new Map<string, CohortUser[]>()
    for (const u of cohortUsers) {
      const periodKey = this.getPeriodKey(u.joinedAt, cohort.granularity)
      if (!periodGroups.has(periodKey)) periodGroups.set(periodKey, [])
      periodGroups.get(periodKey)!.push(u)
    }

    const retention: RetentionRow[] = []
    const periodRetentionSums: number[] = new Array(periods).fill(0)
    let periodRetentionCounts = 0

    for (const [periodKey, groupUsers] of periodGroups) {
      const userIds = new Set(groupUsers.map(u => u.userId))
      const baseTime = new Date(groupUsers[0].joinedAt).getTime()
      const row: RetentionRow = {
        cohortPeriod: periodKey,
        cohortSize: groupUsers.length,
        periods: [],
      }

      for (let p = 0; p < periods; p++) {
        const periodStart = baseTime + p * granMs
        const periodEnd = periodStart + granMs
        const activeUsers = this.events.filter(e =>
          userIds.has(e.userId) &&
          e.eventName === eventName &&
          new Date(e.timestamp).getTime() >= periodStart &&
          new Date(e.timestamp).getTime() < periodEnd
        ).map(e => e.userId)
        const uniqueActive = new Set(activeUsers).size
        const rate = groupUsers.length > 0 ? uniqueActive / groupUsers.length : 0

        row.periods.push({ period: p, activeUsers: uniqueActive, retentionRate: rate })
        periodRetentionSums[p] += rate
      }

      retention.push(row)
      periodRetentionCounts++
    }

    const avgRetention = periodRetentionSums.map(s => periodRetentionCounts > 0 ? s / periodRetentionCounts : 0)

    // Revenue per cohort period
    const revenuePerCohort: Record<string, number> = {}
    for (const [periodKey, groupUsers] of periodGroups) {
      const userIds = new Set(groupUsers.map(u => u.userId))
      const revenue = this.events
        .filter(e => userIds.has(e.userId) && e.value !== undefined && e.value > 0)
        .reduce((sum, e) => sum + (e.value || 0), 0)
      revenuePerCohort[periodKey] = revenue
    }

    return {
      cohortId, cohortName: cohort.name, type: cohort.type,
      totalUsers: cohortUsers.length, retention, avgRetention, revenuePerCohort,
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private getPeriodKey(dateStr: string, granularity: string): string {
    const d = new Date(dateStr)
    if (granularity === 'day') return d.toISOString().slice(0, 10)
    if (granularity === 'week') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      return `W-${monday.toISOString().slice(0, 10)}`
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  private granularityToMs(g: string): number {
    if (g === 'day') return 86400000
    if (g === 'week') return 604800000
    return 2592000000 // ~30 days
  }
}

export const cohortAnalysisService = new CohortAnalysisService()
