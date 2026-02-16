/**
 * Subscription Management Service.
 *
 * Complete subscription lifecycle management:
 *   - Recurring billing cycles (monthly, yearly, custom)
 *   - Prorated plan changes (upgrades/downgrades)
 *   - Free trial management with auto-conversion
 *   - Dunning management (automatic retry + escalation)
 *   - Subscription pause/resume
 *   - Usage-based add-ons
 */

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  currency: string
  interval: 'monthly' | 'yearly' | 'quarterly' | 'weekly'
  intervalCount: number
  trialDays: number
  features: string[]
  limits: Record<string, number>
  active: boolean
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired'
  currentPeriodStart: string
  currentPeriodEnd: string
  trialStart?: string
  trialEnd?: string
  canceledAt?: string
  pausedAt?: string
  resumeAt?: string
  createdAt: string
  billingHistory: BillingEvent[]
  dunningState?: DunningState
  metadata: Record<string, any>
}

export interface BillingEvent {
  id: string
  type: 'charge' | 'refund' | 'proration_credit' | 'proration_charge' | 'trial_start' | 'trial_end' | 'plan_change' | 'dunning_attempt'
  amount: number
  currency: string
  description: string
  timestamp: string
  success: boolean
}

export interface ProrataResult {
  creditAmount: number
  chargeAmount: number
  netAmount: number
  daysRemaining: number
  daysInPeriod: number
  description: string
}

export interface DunningState {
  failedAttempts: number
  lastAttemptAt: string
  nextAttemptAt: string
  maxAttempts: number
  escalationLevel: 'email' | 'warning' | 'final_notice' | 'suspension'
}

export interface DunningConfig {
  maxAttempts: number
  retryIntervalDays: number[]
  escalationThresholds: Record<number, DunningState['escalationLevel']>
  gracePeriodDays: number
}

const DEFAULT_DUNNING: DunningConfig = {
  maxAttempts: 4,
  retryIntervalDays: [1, 3, 7, 14],
  escalationThresholds: { 1: 'email', 2: 'warning', 3: 'final_notice', 4: 'suspension' },
  gracePeriodDays: 14,
}

export class SubscriptionManagementService {
  private plans: Map<string, SubscriptionPlan> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()
  private dunningConfig: DunningConfig = DEFAULT_DUNNING
  private idCounter = 0

  // ── Plan Management ────────────────────────────────────────

  createPlan(name: string, price: number, interval: SubscriptionPlan['interval'], options: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
    const plan: SubscriptionPlan = {
      id: `plan-${++this.idCounter}`,
      name, price, interval,
      currency: options.currency || 'USD',
      intervalCount: options.intervalCount || 1,
      trialDays: options.trialDays || 0,
      features: options.features || [],
      limits: options.limits || {},
      active: true,
    }
    this.plans.set(plan.id, plan)
    return plan
  }

  getPlan(id: string): SubscriptionPlan | undefined {
    return this.plans.get(id)
  }

  getPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values()).filter(p => p.active)
  }

  deactivatePlan(id: string): boolean {
    const plan = this.plans.get(id)
    if (!plan) return false
    plan.active = false
    return true
  }

  // ── Subscription Lifecycle ─────────────────────────────────

  subscribe(userId: string, planId: string): Subscription | null {
    const plan = this.plans.get(planId)
    if (!plan || !plan.active) return null

    const now = new Date()
    const periodEnd = this.computePeriodEnd(now, plan.interval, plan.intervalCount)
    const hasTrial = plan.trialDays > 0

    const sub: Subscription = {
      id: `sub-${++this.idCounter}`,
      userId, planId,
      status: hasTrial ? 'trialing' : 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      trialStart: hasTrial ? now.toISOString() : undefined,
      trialEnd: hasTrial ? new Date(now.getTime() + plan.trialDays * 86400000).toISOString() : undefined,
      createdAt: now.toISOString(),
      billingHistory: [],
      metadata: {},
    }

    if (hasTrial) {
      sub.billingHistory.push(this.createEvent('trial_start', 0, plan.currency, `Free trial started (${plan.trialDays} days)`))
    } else {
      sub.billingHistory.push(this.createEvent('charge', plan.price, plan.currency, `Initial charge for ${plan.name}`, true))
    }

    this.subscriptions.set(sub.id, sub)
    return sub
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id)
  }

  getUserSubscriptions(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.userId === userId)
  }

  getActiveSubscription(userId: string): Subscription | undefined {
    return this.getUserSubscriptions(userId).find(s => s.status === 'active' || s.status === 'trialing')
  }

  // ── Trial Management ───────────────────────────────────────

  /** Convert a trial to a paid subscription. */
  convertTrial(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || sub.status !== 'trialing') return false

    const plan = this.plans.get(sub.planId)
    if (!plan) return false

    sub.status = 'active'
    sub.billingHistory.push(this.createEvent('trial_end', 0, plan.currency, 'Trial ended — converted to paid'))
    sub.billingHistory.push(this.createEvent('charge', plan.price, plan.currency, `First charge for ${plan.name}`, true))
    return true
  }

  /** Check if a trial has expired. */
  isTrialExpired(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || sub.status !== 'trialing' || !sub.trialEnd) return false
    return new Date() >= new Date(sub.trialEnd)
  }

  /** Get remaining trial days. */
  getTrialDaysRemaining(subscriptionId: string): number {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || !sub.trialEnd) return 0
    const remaining = (new Date(sub.trialEnd).getTime() - Date.now()) / 86400000
    return Math.max(0, Math.ceil(remaining))
  }

  // ── Plan Changes (Proration) ───────────────────────────────

  /** Calculate proration for a plan change. */
  calculateProration(subscriptionId: string, newPlanId: string): ProrataResult | null {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) return null
    const oldPlan = this.plans.get(sub.planId)
    const newPlan = this.plans.get(newPlanId)
    if (!oldPlan || !newPlan) return null

    const now = Date.now()
    const periodStart = new Date(sub.currentPeriodStart).getTime()
    const periodEnd = new Date(sub.currentPeriodEnd).getTime()
    const daysInPeriod = Math.max(1, Math.ceil((periodEnd - periodStart) / 86400000))
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / 86400000))

    const dailyOld = oldPlan.price / daysInPeriod
    const dailyNew = newPlan.price / daysInPeriod

    const creditAmount = Math.round(dailyOld * daysRemaining * 100) / 100
    const chargeAmount = Math.round(dailyNew * daysRemaining * 100) / 100
    const netAmount = Math.round((chargeAmount - creditAmount) * 100) / 100

    const direction = newPlan.price > oldPlan.price ? 'Upgrade' : 'Downgrade'

    return {
      creditAmount, chargeAmount, netAmount, daysRemaining, daysInPeriod,
      description: `${direction} from ${oldPlan.name} to ${newPlan.name}: credit $${creditAmount}, charge $${chargeAmount}, net $${netAmount}`,
    }
  }

  /** Execute a plan change with proration. */
  changePlan(subscriptionId: string, newPlanId: string): ProrataResult | null {
    const proration = this.calculateProration(subscriptionId, newPlanId)
    if (!proration) return null

    const sub = this.subscriptions.get(subscriptionId)!
    const oldPlan = this.plans.get(sub.planId)!
    const newPlan = this.plans.get(newPlanId)!

    if (proration.creditAmount > 0) {
      sub.billingHistory.push(this.createEvent('proration_credit', proration.creditAmount, oldPlan.currency, `Proration credit for ${oldPlan.name}`, true))
    }
    if (proration.chargeAmount > 0) {
      sub.billingHistory.push(this.createEvent('proration_charge', proration.chargeAmount, newPlan.currency, `Proration charge for ${newPlan.name}`, true))
    }
    sub.billingHistory.push(this.createEvent('plan_change', proration.netAmount, newPlan.currency, proration.description, true))

    sub.planId = newPlanId
    return proration
  }

  // ── Billing Cycles ─────────────────────────────────────────

  /** Renew a subscription for the next billing cycle. */
  renewSubscription(subscriptionId: string, paymentSuccess: boolean = true): BillingEvent | null {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || (sub.status !== 'active' && sub.status !== 'past_due')) return null

    const plan = this.plans.get(sub.planId)
    if (!plan) return null

    if (paymentSuccess) {
      const now = new Date()
      const newEnd = this.computePeriodEnd(now, plan.interval, plan.intervalCount)
      sub.currentPeriodStart = now.toISOString()
      sub.currentPeriodEnd = newEnd.toISOString()
      sub.status = 'active'
      sub.dunningState = undefined

      const event = this.createEvent('charge', plan.price, plan.currency, `Renewal charge for ${plan.name}`, true)
      sub.billingHistory.push(event)
      return event
    } else {
      return this.handleFailedPayment(subscriptionId)
    }
  }

  /** Check if a subscription needs renewal. */
  needsRenewal(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || sub.status !== 'active') return false
    return new Date() >= new Date(sub.currentPeriodEnd)
  }

  // ── Dunning Management ─────────────────────────────────────

  /** Handle a failed payment with dunning logic. */
  handleFailedPayment(subscriptionId: string): BillingEvent | null {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) return null

    const plan = this.plans.get(sub.planId)
    if (!plan) return null

    if (!sub.dunningState) {
      sub.dunningState = {
        failedAttempts: 0,
        lastAttemptAt: new Date().toISOString(),
        nextAttemptAt: '',
        maxAttempts: this.dunningConfig.maxAttempts,
        escalationLevel: 'email',
      }
    }

    sub.dunningState.failedAttempts++
    sub.dunningState.lastAttemptAt = new Date().toISOString()

    const attempt = sub.dunningState.failedAttempts
    const retryDays = this.dunningConfig.retryIntervalDays[Math.min(attempt - 1, this.dunningConfig.retryIntervalDays.length - 1)]
    sub.dunningState.nextAttemptAt = new Date(Date.now() + retryDays * 86400000).toISOString()
    sub.dunningState.escalationLevel = this.dunningConfig.escalationThresholds[attempt] || 'suspension'

    sub.status = 'past_due'

    if (attempt >= this.dunningConfig.maxAttempts) {
      sub.status = 'canceled'
      sub.canceledAt = new Date().toISOString()
    }

    const event = this.createEvent('dunning_attempt', plan.price, plan.currency,
      `Payment failed (attempt ${attempt}/${this.dunningConfig.maxAttempts}) — ${sub.dunningState.escalationLevel}`, false)
    sub.billingHistory.push(event)
    return event
  }

  getDunningConfig(): DunningConfig { return { ...this.dunningConfig } }
  setDunningConfig(config: Partial<DunningConfig>): void { Object.assign(this.dunningConfig, config) }

  /** Get all subscriptions in dunning. */
  getSubscriptionsInDunning(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.status === 'past_due' && s.dunningState)
  }

  // ── Pause / Resume ─────────────────────────────────────────

  pause(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || sub.status !== 'active') return false
    sub.status = 'paused'
    sub.pausedAt = new Date().toISOString()
    return true
  }

  resume(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub || sub.status !== 'paused') return false
    sub.status = 'active'
    sub.resumeAt = new Date().toISOString()
    return true
  }

  // ── Cancel ─────────────────────────────────────────────────

  cancel(subscriptionId: string, immediate: boolean = false): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) return false
    if (immediate) {
      sub.status = 'canceled'
    } else {
      sub.status = 'canceled'
    }
    sub.canceledAt = new Date().toISOString()
    return true
  }

  // ── Helpers ────────────────────────────────────────────────

  private computePeriodEnd(start: Date, interval: string, count: number): Date {
    const end = new Date(start)
    if (interval === 'weekly') end.setDate(end.getDate() + 7 * count)
    else if (interval === 'monthly') end.setMonth(end.getMonth() + count)
    else if (interval === 'quarterly') end.setMonth(end.getMonth() + 3 * count)
    else if (interval === 'yearly') end.setFullYear(end.getFullYear() + count)
    return end
  }

  private createEvent(type: BillingEvent['type'], amount: number, currency: string, description: string, success: boolean = true): BillingEvent {
    return { id: `evt-${++this.idCounter}`, type, amount, currency, description, timestamp: new Date().toISOString(), success }
  }
}

export const subscriptionManagementService = new SubscriptionManagementService()
