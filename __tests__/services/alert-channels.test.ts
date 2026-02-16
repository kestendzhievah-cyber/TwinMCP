import { AlertChannelsService } from '../../src/services/analytics/alert-channels.service'

describe('AlertChannelsService', () => {
  let service: AlertChannelsService

  beforeEach(() => {
    service = new AlertChannelsService()
  })

  describe('Channel management', () => {
    it('adds a channel', () => {
      const ch = service.addChannel('Slack #alerts', 'slack', { webhook_url: 'https://hooks.slack.com/xxx' })
      expect(ch.type).toBe('slack')
      expect(ch.enabled).toBe(true)
    })

    it('lists channels', () => {
      service.addChannel('Slack', 'slack', {})
      service.addChannel('PagerDuty', 'pagerduty', {})
      expect(service.getChannels().length).toBe(2)
    })

    it('enables/disables channel', () => {
      const ch = service.addChannel('Test', 'email', {})
      service.enableChannel(ch.id, false)
      expect(service.getChannel(ch.id)!.enabled).toBe(false)
    })

    it('removes a channel', () => {
      const ch = service.addChannel('Test', 'webhook', {})
      expect(service.removeChannel(ch.id)).toBe(true)
    })
  })

  describe('Escalation policies', () => {
    it('creates a policy with levels', () => {
      const ch1 = service.addChannel('Slack', 'slack', {})
      const ch2 = service.addChannel('PagerDuty', 'pagerduty', {})
      const policy = service.createPolicy('Critical', [
        { channelIds: [ch1.id], delayMinutes: 0 },
        { channelIds: [ch2.id], delayMinutes: 15, notifyOnCall: true },
      ], 60)
      expect(policy.levels.length).toBe(2)
      expect(policy.levels[0].order).toBe(0)
      expect(policy.repeatAfterMinutes).toBe(60)
    })

    it('gets next escalation level', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      const policy = service.createPolicy('Test', [
        { channelIds: [ch.id], delayMinutes: 0 },
        { channelIds: [ch.id], delayMinutes: 30 },
      ])
      const next = service.getNextEscalationLevel(policy.id, 0)
      expect(next).not.toBeNull()
      expect(next!.order).toBe(1)
      expect(next!.delayMinutes).toBe(30)
    })

    it('returns null when no more levels', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      const policy = service.createPolicy('Test', [{ channelIds: [ch.id], delayMinutes: 0 }])
      expect(service.getNextEscalationLevel(policy.id, 0)).toBeNull()
    })

    it('lists and removes policies', () => {
      service.createPolicy('A', [])
      const p = service.createPolicy('B', [])
      expect(service.getPolicies().length).toBe(2)
      service.removePolicy(p.id)
      expect(service.getPolicies().length).toBe(1)
    })
  })

  describe('On-call schedules', () => {
    it('creates a schedule', () => {
      const s = service.createSchedule('Engineering', 'Europe/Paris')
      expect(s.timezone).toBe('Europe/Paris')
    })

    it('adds rotations', () => {
      const s = service.createSchedule('Eng')
      const now = new Date()
      const start = new Date(now.getTime() - 3600000).toISOString()
      const end = new Date(now.getTime() + 3600000).toISOString()
      expect(service.addRotation(s.id, 'u1', 'Alice', start, end)).toBe(true)
      expect(service.getSchedule(s.id)!.rotations.length).toBe(1)
    })

    it('gets current on-call', () => {
      const s = service.createSchedule('Eng')
      const now = new Date()
      service.addRotation(s.id, 'u1', 'Alice',
        new Date(now.getTime() - 3600000).toISOString(),
        new Date(now.getTime() + 3600000).toISOString()
      )
      const onCall = service.getCurrentOnCall(s.id)
      expect(onCall).not.toBeNull()
      expect(onCall!.userName).toBe('Alice')
    })

    it('returns null when no one on-call', () => {
      const s = service.createSchedule('Eng')
      service.addRotation(s.id, 'u1', 'Alice', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z')
      expect(service.getCurrentOnCall(s.id)).toBeNull()
    })

    it('lists and removes schedules', () => {
      service.createSchedule('A')
      const s = service.createSchedule('B')
      expect(service.getSchedules().length).toBe(2)
      service.removeSchedule(s.id)
      expect(service.getSchedules().length).toBe(1)
    })
  })

  describe('Routing rules', () => {
    it('adds a rule', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      const rule = service.addRule('Critical alerts', { field: 'severity', operator: 'equals', value: 'critical' }, [ch.id])
      expect(rule.enabled).toBe(true)
    })

    it('matches rules', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      service.addRule('Critical', { field: 'severity', operator: 'equals', value: 'critical' }, [ch.id])
      service.addRule('High latency', { field: 'latency', operator: 'gt', value: '1000' }, [ch.id])

      expect(service.matchRules({ severity: 'critical' }).length).toBe(1)
      expect(service.matchRules({ latency: '2000' }).length).toBe(1)
      expect(service.matchRules({ severity: 'info' }).length).toBe(0)
    })

    it('matches contains operator', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      service.addRule('DB errors', { field: 'message', operator: 'contains', value: 'database' }, [ch.id])
      expect(service.matchRules({ message: 'database connection failed' }).length).toBe(1)
    })
  })

  describe('Notification dispatch', () => {
    it('sends notification to a channel', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      const n = service.notify('alert-1', ch.id, 'Server down!')
      expect(n.status).toBe('sent')
      expect(n.channelType).toBe('slack')
    })

    it('fails for disabled channel', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      service.enableChannel(ch.id, false)
      const n = service.notify('alert-1', ch.id, 'Test')
      expect(n.status).toBe('failed')
    })

    it('dispatches to matched channels', () => {
      const ch1 = service.addChannel('Slack', 'slack', {})
      const ch2 = service.addChannel('PagerDuty', 'pagerduty', {})
      service.addRule('Critical', { field: 'severity', operator: 'equals', value: 'critical' }, [ch1.id, ch2.id])

      const results = service.dispatch('alert-1', { severity: 'critical' }, 'Server down!')
      expect(results.length).toBe(2)
    })

    it('dispatches to all channels when no rules match', () => {
      service.addChannel('Slack', 'slack', {})
      service.addChannel('Email', 'email', {})
      const results = service.dispatch('alert-1', { severity: 'unknown' }, 'Test')
      expect(results.length).toBe(2)
    })

    it('acknowledges a notification', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      const n = service.notify('alert-1', ch.id, 'Test')
      expect(service.acknowledge(n.id, 'alice')).toBe(true)
      expect(service.getNotifications('alert-1')[0].status).toBe('acknowledged')
    })

    it('counts notifications', () => {
      const ch = service.addChannel('Slack', 'slack', {})
      service.notify('a1', ch.id, 'msg1')
      service.notify('a2', ch.id, 'msg2')
      expect(service.notificationCount).toBe(2)
    })
  })
})
