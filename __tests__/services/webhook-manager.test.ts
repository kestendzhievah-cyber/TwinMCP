import { WebhookManagerService } from '../../src/services/crawling/webhook-manager.service'

describe('WebhookManagerService', () => {
  let service: WebhookManagerService

  beforeEach(() => {
    service = new WebhookManagerService()
  })

  describe('Webhook registration', () => {
    it('registers a webhook', () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/facebook/react',
        callbackUrl: 'https://api.example.com/webhooks',
        secret: 'my-secret',
        events: ['push', 'release'],
        provider: 'github',
      })
      expect(wh.id).toBeDefined()
      expect(wh.status).toBe('active')
      expect(wh.failureCount).toBe(0)
      expect(service.getWebhooks().length).toBe(1)
    })

    it('gets a webhook by ID', () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })
      expect(service.getWebhook(wh.id)?.provider).toBe('github')
    })

    it('removes a webhook', () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })
      expect(service.removeWebhook(wh.id)).toBe(true)
      expect(service.getWebhooks().length).toBe(0)
    })

    it('activates and deactivates webhooks', () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })

      expect(service.deactivateWebhook(wh.id)).toBe(true)
      expect(service.getWebhook(wh.id)!.status).toBe('inactive')

      expect(service.activateWebhook(wh.id)).toBe(true)
      expect(service.getWebhook(wh.id)!.status).toBe('active')
    })
  })

  describe('Event handling', () => {
    it('receives and processes events', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })

      const event = await service.receiveEvent(wh.id, 'push', { ref: 'refs/heads/main' })
      expect(event.processed).toBe(true)
      expect(event.eventType).toBe('push')
      expect(service.eventCount).toBe(1)
    })

    it('routes events to registered handlers', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })

      const received: string[] = []
      service.on('push', async (event) => { received.push(event.eventType) })

      await service.receiveEvent(wh.id, 'push', { ref: 'main' })
      expect(received).toEqual(['push'])
    })

    it('supports wildcard handler', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push', 'release'],
        provider: 'github',
      })

      const received: string[] = []
      service.on('*', async (event) => { received.push(event.eventType) })

      await service.receiveEvent(wh.id, 'push', {})
      await service.receiveEvent(wh.id, 'release', {})
      expect(received).toEqual(['push', 'release'])
    })

    it('rejects events for inactive webhooks', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })
      service.deactivateWebhook(wh.id)

      await expect(service.receiveEvent(wh.id, 'push', {})).rejects.toThrow('inactive')
    })

    it('throws for unknown webhook', async () => {
      await expect(service.receiveEvent('unknown', 'push', {})).rejects.toThrow('not found')
    })
  })

  describe('Signature verification', () => {
    it('verifies valid signatures', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'my-secret',
        events: ['push'],
        provider: 'github',
      })

      const payload = { ref: 'main' }
      const signature = service.computeSignature('my-secret', JSON.stringify(payload))

      const event = await service.receiveEvent(wh.id, 'push', payload, signature)
      expect(event.processed).toBe(true)
    })

    it('rejects invalid signatures', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'my-secret',
        events: ['push'],
        provider: 'github',
      })

      await expect(
        service.receiveEvent(wh.id, 'push', { ref: 'main' }, 'sha256=invalid')
      ).rejects.toThrow('Invalid webhook signature')
    })

    it('marks webhook as failed after repeated signature failures', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'my-secret',
        events: ['push'],
        provider: 'github',
      })

      for (let i = 0; i < 5; i++) {
        try { await service.receiveEvent(wh.id, 'push', {}, 'sha256=bad') } catch {}
      }

      expect(service.getWebhook(wh.id)!.status).toBe('failed')
    })
  })

  describe('Health monitoring', () => {
    it('reports healthy webhook', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })

      await service.receiveEvent(wh.id, 'push', {})
      const report = service.getHealthReport(wh.id)
      expect(report).not.toBeNull()
      expect(report!.status).toBe('healthy')
      expect(report!.uptime).toBe(1)
    })

    it('returns null for unknown webhook', () => {
      expect(service.getHealthReport('unknown')).toBeNull()
    })
  })

  describe('Auto-repair', () => {
    it('repairs failed webhooks', async () => {
      const wh = service.registerWebhook({
        repositoryUrl: 'https://github.com/test/repo',
        callbackUrl: 'https://api.example.com/wh',
        secret: 'secret',
        events: ['push'],
        provider: 'github',
      })

      // Force failure
      for (let i = 0; i < 5; i++) {
        try { await service.receiveEvent(wh.id, 'push', {}, 'sha256=bad') } catch {}
      }
      expect(service.getWebhook(wh.id)!.status).toBe('failed')

      const result = service.autoRepair()
      expect(result.repaired).toContain(wh.id)
      expect(service.getWebhook(wh.id)!.status).toBe('active')
    })
  })
})
