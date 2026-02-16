/**
 * Alert Channels Service.
 *
 * Multi-channel alert notifications with escalation and on-call:
 *   - Channel management (Slack, PagerDuty, email, webhook)
 *   - Escalation policies (tiered, time-based)
 *   - On-call schedule management
 *   - Alert routing rules
 *   - Notification history
 */

export interface AlertChannel {
  id: string
  name: string
  type: 'slack' | 'pagerduty' | 'email' | 'webhook' | 'sms'
  config: Record<string, string>
  enabled: boolean
  createdAt: string
}

export interface EscalationPolicy {
  id: string
  name: string
  levels: EscalationLevel[]
  repeatAfterMinutes?: number
  enabled: boolean
}

export interface EscalationLevel {
  order: number
  channelIds: string[]
  delayMinutes: number
  notifyOnCall: boolean
}

export interface OnCallSchedule {
  id: string
  name: string
  rotations: OnCallRotation[]
  timezone: string
}

export interface OnCallRotation {
  userId: string
  userName: string
  startTime: string
  endTime: string
  contactChannelId?: string
}

export interface AlertNotification {
  id: string
  alertId: string
  channelId: string
  channelType: string
  status: 'pending' | 'sent' | 'failed' | 'acknowledged'
  sentAt?: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  escalationLevel: number
  message: string
}

export interface RoutingRule {
  id: string
  name: string
  condition: { field: string; operator: 'equals' | 'contains' | 'gt' | 'lt'; value: string }
  channelIds: string[]
  escalationPolicyId?: string
  enabled: boolean
}

export class AlertChannelsService {
  private channels: Map<string, AlertChannel> = new Map()
  private policies: Map<string, EscalationPolicy> = new Map()
  private schedules: Map<string, OnCallSchedule> = new Map()
  private notifications: AlertNotification[] = []
  private rules: Map<string, RoutingRule> = new Map()
  private idCounter = 0

  // ── Channel Management ─────────────────────────────────────

  addChannel(name: string, type: AlertChannel['type'], config: Record<string, string>): AlertChannel {
    const channel: AlertChannel = {
      id: `ch-${++this.idCounter}`,
      name, type, config, enabled: true,
      createdAt: new Date().toISOString(),
    }
    this.channels.set(channel.id, channel)
    return channel
  }

  getChannel(id: string): AlertChannel | undefined {
    return this.channels.get(id)
  }

  getChannels(): AlertChannel[] {
    return Array.from(this.channels.values())
  }

  enableChannel(id: string, enabled: boolean): boolean {
    const ch = this.channels.get(id)
    if (!ch) return false
    ch.enabled = enabled
    return true
  }

  removeChannel(id: string): boolean {
    return this.channels.delete(id)
  }

  // ── Escalation Policies ────────────────────────────────────

  createPolicy(name: string, levels: Array<{ channelIds: string[]; delayMinutes: number; notifyOnCall?: boolean }>, repeatAfterMinutes?: number): EscalationPolicy {
    const policy: EscalationPolicy = {
      id: `policy-${++this.idCounter}`,
      name, enabled: true, repeatAfterMinutes,
      levels: levels.map((l, i) => ({ order: i, channelIds: l.channelIds, delayMinutes: l.delayMinutes, notifyOnCall: l.notifyOnCall || false })),
    }
    this.policies.set(policy.id, policy)
    return policy
  }

  getPolicy(id: string): EscalationPolicy | undefined {
    return this.policies.get(id)
  }

  getPolicies(): EscalationPolicy[] {
    return Array.from(this.policies.values())
  }

  removePolicy(id: string): boolean {
    return this.policies.delete(id)
  }

  /** Get the next escalation level for an alert. */
  getNextEscalationLevel(policyId: string, currentLevel: number): EscalationLevel | null {
    const policy = this.policies.get(policyId)
    if (!policy) return null
    const next = policy.levels.find(l => l.order === currentLevel + 1)
    return next || null
  }

  // ── On-Call Schedules ──────────────────────────────────────

  createSchedule(name: string, timezone: string = 'UTC'): OnCallSchedule {
    const schedule: OnCallSchedule = {
      id: `oncall-${++this.idCounter}`,
      name, timezone, rotations: [],
    }
    this.schedules.set(schedule.id, schedule)
    return schedule
  }

  addRotation(scheduleId: string, userId: string, userName: string, startTime: string, endTime: string, contactChannelId?: string): boolean {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return false
    schedule.rotations.push({ userId, userName, startTime, endTime, contactChannelId })
    return true
  }

  getSchedule(id: string): OnCallSchedule | undefined {
    return this.schedules.get(id)
  }

  getSchedules(): OnCallSchedule[] {
    return Array.from(this.schedules.values())
  }

  /** Get the current on-call person for a schedule. */
  getCurrentOnCall(scheduleId: string): OnCallRotation | null {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return null
    const now = new Date().toISOString()
    return schedule.rotations.find(r => r.startTime <= now && r.endTime > now) || null
  }

  removeSchedule(id: string): boolean {
    return this.schedules.delete(id)
  }

  // ── Routing Rules ──────────────────────────────────────────

  addRule(name: string, condition: RoutingRule['condition'], channelIds: string[], escalationPolicyId?: string): RoutingRule {
    const rule: RoutingRule = {
      id: `rule-${++this.idCounter}`,
      name, condition, channelIds, escalationPolicyId, enabled: true,
    }
    this.rules.set(rule.id, rule)
    return rule
  }

  getRules(): RoutingRule[] {
    return Array.from(this.rules.values())
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id)
  }

  /** Find matching routing rules for an alert. */
  matchRules(alertData: Record<string, any>): RoutingRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false
      const fieldValue = String(alertData[rule.condition.field] || '')
      switch (rule.condition.operator) {
        case 'equals': return fieldValue === rule.condition.value
        case 'contains': return fieldValue.includes(rule.condition.value)
        case 'gt': return parseFloat(fieldValue) > parseFloat(rule.condition.value)
        case 'lt': return parseFloat(fieldValue) < parseFloat(rule.condition.value)
        default: return false
      }
    })
  }

  // ── Notification Dispatch ──────────────────────────────────

  /** Send an alert notification to a channel. */
  notify(alertId: string, channelId: string, message: string, escalationLevel: number = 0): AlertNotification {
    const channel = this.channels.get(channelId)
    const notification: AlertNotification = {
      id: `notif-${++this.idCounter}`,
      alertId, channelId,
      channelType: channel?.type || 'unknown',
      status: channel?.enabled ? 'sent' : 'failed',
      sentAt: channel?.enabled ? new Date().toISOString() : undefined,
      escalationLevel, message,
    }
    this.notifications.push(notification)
    return notification
  }

  /** Dispatch alert to all channels matched by routing rules. */
  dispatch(alertId: string, alertData: Record<string, any>, message: string): AlertNotification[] {
    const matched = this.matchRules(alertData)
    const results: AlertNotification[] = []

    if (matched.length === 0) {
      // Default: send to all enabled channels
      for (const ch of this.channels.values()) {
        if (ch.enabled) results.push(this.notify(alertId, ch.id, message))
      }
    } else {
      for (const rule of matched) {
        for (const chId of rule.channelIds) {
          results.push(this.notify(alertId, chId, message))
        }
      }
    }

    return results
  }

  /** Acknowledge a notification. */
  acknowledge(notificationId: string, userId: string): boolean {
    const n = this.notifications.find(n => n.id === notificationId)
    if (!n) return false
    n.status = 'acknowledged'
    n.acknowledgedAt = new Date().toISOString()
    n.acknowledgedBy = userId
    return true
  }

  getNotifications(alertId?: string): AlertNotification[] {
    if (alertId) return this.notifications.filter(n => n.alertId === alertId)
    return [...this.notifications]
  }

  get notificationCount(): number { return this.notifications.length }
}

export const alertChannelsService = new AlertChannelsService()
