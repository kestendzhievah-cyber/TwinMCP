/**
 * Email Provider Integration Service.
 *
 * Abstracts email sending through third-party providers:
 *   - SendGrid integration
 *   - Mailgun integration
 *   - SMTP fallback
 *   - Provider failover
 *   - Template rendering
 *   - Delivery tracking
 *   - Rate limiting
 */

export interface EmailMessage {
  to: string | string[]
  from: string
  subject: string
  html?: string
  text?: string
  templateId?: string
  templateData?: Record<string, any>
  replyTo?: string
  cc?: string[]
  bcc?: string[]
  attachments?: EmailAttachment[]
  tags?: string[]
  metadata?: Record<string, any>
}

export interface EmailAttachment {
  filename: string
  content: string // base64
  contentType: string
}

export interface EmailResult {
  id: string
  provider: string
  status: 'sent' | 'queued' | 'failed'
  messageId?: string
  timestamp: string
  error?: string
}

export interface EmailProviderConfig {
  name: string
  type: 'sendgrid' | 'mailgun' | 'smtp'
  apiKey?: string
  domain?: string
  host?: string
  port?: number
  priority: number
  enabled: boolean
  rateLimit: number // per minute
}

export interface DeliveryEvent {
  messageId: string
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'dropped'
  timestamp: string
  recipient: string
  metadata?: Record<string, any>
}

export interface EmailStats {
  totalSent: number
  totalFailed: number
  byProvider: Record<string, { sent: number; failed: number }>
  deliveryRate: number
  recentEvents: DeliveryEvent[]
}

export class EmailProviderService {
  private providers: Map<string, EmailProviderConfig> = new Map()
  private sentLog: EmailResult[] = []
  private deliveryEvents: DeliveryEvent[] = []
  private rateCounts: Map<string, { count: number; resetAt: number }> = new Map()
  private idCounter = 0

  // ── Provider Management ────────────────────────────────────

  addProvider(config: EmailProviderConfig): void {
    this.providers.set(config.name, config)
  }

  getProvider(name: string): EmailProviderConfig | undefined {
    return this.providers.get(name)
  }

  getProviders(): EmailProviderConfig[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority)
  }

  enableProvider(name: string, enabled: boolean): boolean {
    const p = this.providers.get(name)
    if (!p) return false
    p.enabled = enabled
    return true
  }

  removeProvider(name: string): boolean {
    return this.providers.delete(name)
  }

  /** Get the best available provider (enabled, not rate-limited, highest priority). */
  getBestProvider(): EmailProviderConfig | null {
    const sorted = this.getProviders().filter(p => p.enabled)
    for (const p of sorted) {
      if (!this.isRateLimited(p.name)) return p
    }
    return null
  }

  // ── Sending ────────────────────────────────────────────────

  /** Send an email using the best available provider with failover. */
  send(message: EmailMessage): EmailResult {
    const providers = this.getProviders().filter(p => p.enabled)
    if (providers.length === 0) {
      return this.logResult('none', 'failed', undefined, 'No email providers configured')
    }

    for (const provider of providers) {
      if (this.isRateLimited(provider.name)) continue

      const result = this.sendViaProvider(provider, message)
      if (result.status !== 'failed') return result
    }

    return this.logResult('all', 'failed', undefined, 'All providers failed')
  }

  /** Send via a specific provider. */
  sendVia(providerName: string, message: EmailMessage): EmailResult {
    const provider = this.providers.get(providerName)
    if (!provider) return this.logResult(providerName, 'failed', undefined, 'Provider not found')
    if (!provider.enabled) return this.logResult(providerName, 'failed', undefined, 'Provider disabled')
    if (this.isRateLimited(providerName)) return this.logResult(providerName, 'failed', undefined, 'Rate limited')
    return this.sendViaProvider(provider, message)
  }

  /** Send a batch of emails. */
  sendBatch(messages: EmailMessage[]): EmailResult[] {
    return messages.map(m => this.send(m))
  }

  // ── Template Rendering ─────────────────────────────────────

  /** Render a simple template with variable substitution. */
  renderTemplate(template: string, data: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
    }
    return result
  }

  // ── Delivery Tracking ──────────────────────────────────────

  recordDeliveryEvent(messageId: string, event: DeliveryEvent['event'], recipient: string, metadata?: Record<string, any>): void {
    this.deliveryEvents.push({ messageId, event, timestamp: new Date().toISOString(), recipient, metadata })
  }

  getDeliveryEvents(messageId?: string): DeliveryEvent[] {
    if (messageId) return this.deliveryEvents.filter(e => e.messageId === messageId)
    return [...this.deliveryEvents]
  }

  // ── Stats ──────────────────────────────────────────────────

  getStats(): EmailStats {
    const byProvider: Record<string, { sent: number; failed: number }> = {}
    let totalSent = 0
    let totalFailed = 0

    for (const r of this.sentLog) {
      if (!byProvider[r.provider]) byProvider[r.provider] = { sent: 0, failed: 0 }
      if (r.status === 'sent' || r.status === 'queued') {
        byProvider[r.provider].sent++
        totalSent++
      } else {
        byProvider[r.provider].failed++
        totalFailed++
      }
    }

    const total = totalSent + totalFailed
    const deliveryRate = total > 0 ? totalSent / total : 0

    return {
      totalSent, totalFailed, byProvider, deliveryRate,
      recentEvents: this.deliveryEvents.slice(-20),
    }
  }

  getSentLog(): EmailResult[] {
    return [...this.sentLog]
  }

  get totalSent(): number { return this.sentLog.filter(r => r.status === 'sent' || r.status === 'queued').length }
  get totalFailed(): number { return this.sentLog.filter(r => r.status === 'failed').length }

  // ── Internal ───────────────────────────────────────────────

  private sendViaProvider(provider: EmailProviderConfig, message: EmailMessage): EmailResult {
    this.incrementRateCount(provider.name)

    // Render template if provided
    let html = message.html
    if (message.templateId && message.templateData && html) {
      html = this.renderTemplate(html, message.templateData)
    }

    // Simulate provider-specific sending
    const messageId = `msg-${provider.type}-${++this.idCounter}`
    const success = provider.apiKey !== undefined || provider.type === 'smtp'

    if (success) {
      return this.logResult(provider.name, 'sent', messageId)
    } else {
      return this.logResult(provider.name, 'failed', undefined, `${provider.type}: missing API key`)
    }
  }

  private logResult(provider: string, status: EmailResult['status'], messageId?: string, error?: string): EmailResult {
    const result: EmailResult = {
      id: `email-${++this.idCounter}`,
      provider, status, messageId,
      timestamp: new Date().toISOString(),
      error,
    }
    this.sentLog.push(result)
    return result
  }

  private isRateLimited(providerName: string): boolean {
    const provider = this.providers.get(providerName)
    if (!provider) return true
    const rate = this.rateCounts.get(providerName)
    if (!rate) return false
    if (Date.now() > rate.resetAt) return false
    return rate.count >= provider.rateLimit
  }

  private incrementRateCount(providerName: string): void {
    const now = Date.now()
    const rate = this.rateCounts.get(providerName)
    if (!rate || now > rate.resetAt) {
      this.rateCounts.set(providerName, { count: 1, resetAt: now + 60000 })
    } else {
      rate.count++
    }
  }
}

export const emailProviderService = new EmailProviderService()
