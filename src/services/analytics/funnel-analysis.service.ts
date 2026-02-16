/**
 * Funnel Analysis Service.
 *
 * Tracks and analyzes user conversion funnels:
 *   - Define multi-step funnels
 *   - Track user progression through steps
 *   - Conversion rate calculation per step
 *   - Drop-off analysis
 *   - Time-between-steps analysis
 *   - Funnel comparison (A vs B)
 */

export interface FunnelDefinition {
  id: string
  name: string
  description?: string
  steps: FunnelStep[]
  createdAt: string
}

export interface FunnelStep {
  id: string
  name: string
  eventName: string
  order: number
  optional?: boolean
}

export interface FunnelEvent {
  userId: string
  funnelId: string
  stepId: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface FunnelStepMetrics {
  stepId: string
  stepName: string
  order: number
  entered: number
  completed: number
  conversionRate: number
  dropOffRate: number
  avgTimeToNextMs: number
}

export interface FunnelReport {
  funnelId: string
  funnelName: string
  totalUsers: number
  completedUsers: number
  overallConversionRate: number
  steps: FunnelStepMetrics[]
  biggestDropOff: { stepName: string; dropOffRate: number } | null
  avgCompletionTimeMs: number
  period: { from: string; to: string }
}

export interface FunnelComparison {
  funnelA: FunnelReport
  funnelB: FunnelReport
  conversionDiff: number
  betterFunnel: string
}

export class FunnelAnalysisService {
  private funnels: Map<string, FunnelDefinition> = new Map()
  private events: FunnelEvent[] = []
  private idCounter = 0

  // ── Funnel Definition ──────────────────────────────────────

  createFunnel(name: string, steps: Array<{ name: string; eventName: string; optional?: boolean }>, description?: string): FunnelDefinition {
    const funnel: FunnelDefinition = {
      id: `funnel-${++this.idCounter}`,
      name, description,
      steps: steps.map((s, i) => ({ id: `step-${this.idCounter}-${i}`, name: s.name, eventName: s.eventName, order: i, optional: s.optional })),
      createdAt: new Date().toISOString(),
    }
    this.funnels.set(funnel.id, funnel)
    return funnel
  }

  getFunnel(id: string): FunnelDefinition | undefined {
    return this.funnels.get(id)
  }

  getFunnels(): FunnelDefinition[] {
    return Array.from(this.funnels.values())
  }

  removeFunnel(id: string): boolean {
    return this.funnels.delete(id)
  }

  // ── Event Tracking ─────────────────────────────────────────

  trackEvent(userId: string, funnelId: string, stepId: string, metadata?: Record<string, any>): void {
    this.events.push({ userId, funnelId, stepId, timestamp: new Date().toISOString(), metadata })
  }

  trackByEventName(userId: string, eventName: string, metadata?: Record<string, any>): number {
    let tracked = 0
    for (const funnel of this.funnels.values()) {
      const step = funnel.steps.find(s => s.eventName === eventName)
      if (step) {
        this.trackEvent(userId, funnel.id, step.id, metadata)
        tracked++
      }
    }
    return tracked
  }

  getEvents(funnelId: string): FunnelEvent[] {
    return this.events.filter(e => e.funnelId === funnelId)
  }

  get totalEvents(): number { return this.events.length }

  // ── Analysis ───────────────────────────────────────────────

  analyze(funnelId: string, from?: string, to?: string): FunnelReport {
    const funnel = this.funnels.get(funnelId)
    if (!funnel) {
      return { funnelId, funnelName: 'Unknown', totalUsers: 0, completedUsers: 0, overallConversionRate: 0, steps: [], biggestDropOff: null, avgCompletionTimeMs: 0, period: { from: from || '', to: to || '' } }
    }

    let events = this.events.filter(e => e.funnelId === funnelId)
    if (from) events = events.filter(e => e.timestamp >= from)
    if (to) events = events.filter(e => e.timestamp <= to)

    // Group events by user
    const userEvents = new Map<string, FunnelEvent[]>()
    for (const e of events) {
      if (!userEvents.has(e.userId)) userEvents.set(e.userId, [])
      userEvents.get(e.userId)!.push(e)
    }

    const totalUsers = userEvents.size
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order)

    // Calculate per-step metrics
    const stepMetrics: FunnelStepMetrics[] = []
    let prevEntered = totalUsers

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]
      const usersAtStep = Array.from(userEvents.values()).filter(ue => ue.some(e => e.stepId === step.id)).length

      const entered = i === 0 ? totalUsers : prevEntered
      const completed = usersAtStep

      // Avg time to next step
      let avgTimeToNext = 0
      if (i < sortedSteps.length - 1) {
        const nextStep = sortedSteps[i + 1]
        const times: number[] = []
        for (const [, ue] of userEvents) {
          const currentEvent = ue.find(e => e.stepId === step.id)
          const nextEvent = ue.find(e => e.stepId === nextStep.id)
          if (currentEvent && nextEvent) {
            times.push(new Date(nextEvent.timestamp).getTime() - new Date(currentEvent.timestamp).getTime())
          }
        }
        avgTimeToNext = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0
      }

      const conversionRate = entered > 0 ? completed / entered : 0
      const dropOffRate = entered > 0 ? 1 - conversionRate : 0

      stepMetrics.push({
        stepId: step.id, stepName: step.name, order: step.order,
        entered, completed, conversionRate, dropOffRate, avgTimeToNextMs: avgTimeToNext,
      })

      prevEntered = completed
    }

    // Overall metrics
    const lastStep = sortedSteps[sortedSteps.length - 1]
    const completedUsers = lastStep ? Array.from(userEvents.values()).filter(ue => ue.some(e => e.stepId === lastStep.id)).length : 0
    const overallConversionRate = totalUsers > 0 ? completedUsers / totalUsers : 0

    // Biggest drop-off
    let biggestDropOff: { stepName: string; dropOffRate: number } | null = null
    for (const sm of stepMetrics) {
      if (!biggestDropOff || sm.dropOffRate > biggestDropOff.dropOffRate) {
        biggestDropOff = { stepName: sm.stepName, dropOffRate: sm.dropOffRate }
      }
    }

    // Avg completion time
    const completionTimes: number[] = []
    if (sortedSteps.length >= 2) {
      const firstStep = sortedSteps[0]
      for (const [, ue] of userEvents) {
        const first = ue.find(e => e.stepId === firstStep.id)
        const last = ue.find(e => e.stepId === lastStep.id)
        if (first && last) {
          completionTimes.push(new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime())
        }
      }
    }
    const avgCompletionTimeMs = completionTimes.length > 0 ? completionTimes.reduce((s, t) => s + t, 0) / completionTimes.length : 0

    return {
      funnelId, funnelName: funnel.name, totalUsers, completedUsers, overallConversionRate,
      steps: stepMetrics, biggestDropOff, avgCompletionTimeMs,
      period: { from: from || '', to: to || '' },
    }
  }

  compare(funnelIdA: string, funnelIdB: string): FunnelComparison {
    const a = this.analyze(funnelIdA)
    const b = this.analyze(funnelIdB)
    return {
      funnelA: a, funnelB: b,
      conversionDiff: a.overallConversionRate - b.overallConversionRate,
      betterFunnel: a.overallConversionRate >= b.overallConversionRate ? a.funnelName : b.funnelName,
    }
  }
}

export const funnelAnalysisService = new FunnelAnalysisService()
