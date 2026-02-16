import { EmailProviderService } from '../../src/services/billing/email-provider.service'

describe('EmailProviderService', () => {
  let service: EmailProviderService

  beforeEach(() => {
    service = new EmailProviderService()
  })

  describe('Provider management', () => {
    it('adds a provider', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 100 })
      expect(service.getProviders().length).toBe(1)
    })

    it('sorts by priority', () => {
      service.addProvider({ name: 'mailgun', type: 'mailgun', apiKey: 'mg_test', priority: 2, enabled: true, rateLimit: 100 })
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 100 })
      expect(service.getProviders()[0].name).toBe('sendgrid')
    })

    it('enables/disables provider', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 100 })
      service.enableProvider('sendgrid', false)
      expect(service.getProvider('sendgrid')!.enabled).toBe(false)
    })

    it('removes a provider', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 100 })
      expect(service.removeProvider('sendgrid')).toBe(true)
      expect(service.getProviders().length).toBe(0)
    })

    it('gets best provider', () => {
      service.addProvider({ name: 'mailgun', type: 'mailgun', apiKey: 'mg_test', priority: 2, enabled: true, rateLimit: 100 })
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 100 })
      expect(service.getBestProvider()!.name).toBe('sendgrid')
    })

    it('skips disabled providers', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: false, rateLimit: 100 })
      service.addProvider({ name: 'mailgun', type: 'mailgun', apiKey: 'mg_test', priority: 2, enabled: true, rateLimit: 100 })
      expect(service.getBestProvider()!.name).toBe('mailgun')
    })
  })

  describe('Sending', () => {
    beforeEach(() => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 1000 })
      service.addProvider({ name: 'mailgun', type: 'mailgun', apiKey: 'mg_test', priority: 2, enabled: true, rateLimit: 1000 })
    })

    it('sends via best provider', () => {
      const result = service.send({ to: 'user@test.com', from: 'noreply@app.com', subject: 'Test', text: 'Hello' })
      expect(result.status).toBe('sent')
      expect(result.provider).toBe('sendgrid')
      expect(result.messageId).toBeDefined()
    })

    it('sends via specific provider', () => {
      const result = service.sendVia('mailgun', { to: 'user@test.com', from: 'noreply@app.com', subject: 'Test', text: 'Hello' })
      expect(result.status).toBe('sent')
      expect(result.provider).toBe('mailgun')
    })

    it('fails for unknown provider', () => {
      const result = service.sendVia('unknown', { to: 'user@test.com', from: 'noreply@app.com', subject: 'Test' })
      expect(result.status).toBe('failed')
    })

    it('fails for disabled provider', () => {
      service.enableProvider('sendgrid', false)
      const result = service.sendVia('sendgrid', { to: 'user@test.com', from: 'noreply@app.com', subject: 'Test' })
      expect(result.status).toBe('failed')
    })

    it('fails when no providers configured', () => {
      const empty = new EmailProviderService()
      const result = empty.send({ to: 'user@test.com', from: 'noreply@app.com', subject: 'Test' })
      expect(result.status).toBe('failed')
    })

    it('sends batch', () => {
      const results = service.sendBatch([
        { to: 'a@test.com', from: 'noreply@app.com', subject: 'A' },
        { to: 'b@test.com', from: 'noreply@app.com', subject: 'B' },
      ])
      expect(results.length).toBe(2)
      expect(results.every(r => r.status === 'sent')).toBe(true)
    })

    it('fails for provider without API key', () => {
      service.addProvider({ name: 'nokey', type: 'sendgrid', priority: 0, enabled: true, rateLimit: 100 })
      const result = service.sendVia('nokey', { to: 'user@test.com', from: 'noreply@app.com', subject: 'Test' })
      expect(result.status).toBe('failed')
    })
  })

  describe('Template rendering', () => {
    it('renders templates', () => {
      const result = service.renderTemplate('Hello {{name}}, your order #{{orderId}} is confirmed.', { name: 'Alice', orderId: '12345' })
      expect(result).toBe('Hello Alice, your order #12345 is confirmed.')
    })

    it('handles missing variables', () => {
      const result = service.renderTemplate('Hello {{name}}', {})
      expect(result).toBe('Hello {{name}}')
    })
  })

  describe('Delivery tracking', () => {
    it('records delivery events', () => {
      service.recordDeliveryEvent('msg-1', 'delivered', 'user@test.com')
      service.recordDeliveryEvent('msg-1', 'opened', 'user@test.com')
      expect(service.getDeliveryEvents('msg-1').length).toBe(2)
    })

    it('gets all events', () => {
      service.recordDeliveryEvent('msg-1', 'delivered', 'a@test.com')
      service.recordDeliveryEvent('msg-2', 'bounced', 'b@test.com')
      expect(service.getDeliveryEvents().length).toBe(2)
    })
  })

  describe('Stats', () => {
    it('computes stats', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 1000 })
      service.send({ to: 'a@test.com', from: 'noreply@app.com', subject: 'A' })
      service.send({ to: 'b@test.com', from: 'noreply@app.com', subject: 'B' })

      const stats = service.getStats()
      expect(stats.totalSent).toBe(2)
      expect(stats.deliveryRate).toBeGreaterThan(0)
      expect(stats.byProvider['sendgrid'].sent).toBe(2)
    })

    it('tracks sent log', () => {
      service.addProvider({ name: 'sendgrid', type: 'sendgrid', apiKey: 'sg_test', priority: 1, enabled: true, rateLimit: 1000 })
      service.send({ to: 'a@test.com', from: 'noreply@app.com', subject: 'A' })
      expect(service.getSentLog().length).toBe(1)
      expect(service.totalSent).toBe(1)
    })
  })
})
