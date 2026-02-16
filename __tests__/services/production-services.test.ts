import { CDNIntegrationService } from '../../src/services/production/cdn-integration.service'
import { DatabaseShardingService } from '../../src/services/production/database-sharding.service'
import { HighAvailabilityService } from '../../src/services/production/high-availability.service'
import { SecurityScanningService } from '../../src/services/production/security-scanning.service'
import { ComplianceService } from '../../src/services/production/compliance.service'
import { SupportMaintenanceService } from '../../src/services/production/support-maintenance.service'

// ═══════════════════════════════════════════════════════════════
// CDN Integration
// ═══════════════════════════════════════════════════════════════
describe('CDNIntegrationService', () => {
  let service: CDNIntegrationService

  beforeEach(() => { service = new CDNIntegrationService() })

  it('adds a provider', () => {
    const p = service.addProvider('CloudFront', 'cloudfront', { distributionId: 'E123' })
    expect(p.type).toBe('cloudfront')
    expect(service.getProviders().length).toBe(1)
  })

  it('adds origins', () => {
    const p = service.addProvider('CF', 'cloudflare', {})
    expect(service.addOrigin(p.id, 'api.twinmcp.com')).toBe(true)
    expect(service.getProvider(p.id)!.origins.length).toBe(1)
  })

  it('manages cache rules', () => {
    const rule = service.addCacheRule('/static/.*', 86400)
    expect(rule.ttlSeconds).toBe(86400)
    expect(service.getCacheRules().length).toBe(1)
    expect(service.matchCacheRule('/static/js/main.js')).not.toBeNull()
    expect(service.matchCacheRule('/api/data')).toBeNull()
  })

  it('invalidates paths', () => {
    const p = service.addProvider('CF', 'cloudfront', {})
    const inv = service.invalidatePaths(p.id, ['/api/*'])
    expect(inv.status).toBe('completed')
    expect(inv.type).toBe('path')
  })

  it('invalidates tags', () => {
    const p = service.addProvider('CF', 'cloudflare', {})
    const inv = service.invalidateTags(p.id, ['user-data'])
    expect(inv.type).toBe('tag')
  })

  it('purges all', () => {
    const p = service.addProvider('CF', 'cloudfront', {})
    const inv = service.purgeAll(p.id)
    expect(inv.type).toBe('full')
  })

  it('manages edge rules', () => {
    service.addEdgeRule('Block bots', 'block', 'user-agent contains bot', 'block', 1)
    expect(service.getEdgeRules().length).toBe(1)
  })

  it('generates stats', () => {
    const stats = service.generateStats(5000)
    expect(stats.totalRequests).toBe(5000)
    expect(stats.hitRate).toBeGreaterThan(0.8)
    expect(stats.topPaths.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Database Sharding
// ═══════════════════════════════════════════════════════════════
describe('DatabaseShardingService', () => {
  let service: DatabaseShardingService

  beforeEach(() => {
    service = new DatabaseShardingService()
    service.addShard('shard-a', 'db1.internal', 5432, 'twinmcp_a')
    service.addShard('shard-b', 'db2.internal', 5432, 'twinmcp_b')
  })

  it('adds and lists shards', () => {
    expect(service.getShards().length).toBe(2)
    expect(service.getActiveShards().length).toBe(2)
  })

  it('routes keys to shards deterministically', () => {
    const shard1 = service.getShardForKey('tenant-123')
    const shard2 = service.getShardForKey('tenant-123')
    expect(shard1!.id).toBe(shard2!.id)
  })

  it('distributes keys across shards', () => {
    const shardIds = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const shard = service.getShardForKey(`tenant-${i}`)
      if (shard) shardIds.add(shard.id)
    }
    expect(shardIds.size).toBeGreaterThan(1)
  })

  it('respects shard status for writes', () => {
    const shards = service.getShards()
    service.setShardStatus(shards[0].id, 'readonly')
    // Keys routed to readonly shard should fail for writes
    const writeShard = service.getWriteShard('test-key')
    // May or may not be the readonly shard depending on hash
    if (writeShard) expect(writeShard.status).toBe('active')
  })

  it('plans and executes rebalance', () => {
    const shards = service.getShards()
    // Assign some keys first
    for (let i = 0; i < 10; i++) service.getShardForKey(`key-${i}`)
    const op = service.planRebalance(shards[0].id, shards[1].id, 3)
    expect(op).not.toBeNull()
    expect(service.executeRebalance(op!.id)).toBe(true)
    expect(service.getRebalanceOps()[0].status).toBe('completed')
  })

  it('executes cross-shard queries', () => {
    const result = service.executeCrossShardQuery('SELECT * FROM users')
    expect(result.status).toBe('completed')
    expect(result.targetShards.length).toBe(2)
    expect(result.totalRows).toBeGreaterThanOrEqual(0)
  })

  it('monitors shard health', () => {
    const health = service.getShardHealth()
    expect(health.length).toBe(2)
    expect(health[0].healthy).toBe(true)
  })

  it('configures strategy', () => {
    service.setStrategy({ type: 'range', shardKey: 'user_id', totalShards: 4 })
    expect(service.getStrategy().type).toBe('range')
  })
})

// ═══════════════════════════════════════════════════════════════
// High Availability
// ═══════════════════════════════════════════════════════════════
describe('HighAvailabilityService', () => {
  let service: HighAvailabilityService

  beforeEach(() => {
    service = new HighAvailabilityService()
    service.addRegion('us-east-1', 'AWS', 'https://us-east.api.twinmcp.com', { isPrimary: true, latencyMs: 20, trafficWeight: 70 })
    service.addRegion('eu-west-1', 'AWS', 'https://eu-west.api.twinmcp.com', { latencyMs: 80, trafficWeight: 30 })
  })

  it('manages regions', () => {
    expect(service.getRegions().length).toBe(2)
    expect(service.getPrimaryRegion()!.name).toBe('us-east-1')
  })

  it('promotes a region', () => {
    const regions = service.getRegions()
    const secondary = regions.find(r => !r.isPrimary)!
    service.promoteRegion(secondary.id)
    expect(service.getPrimaryRegion()!.name).toBe('eu-west-1')
  })

  it('routes by latency', () => {
    service.setTrafficPolicy({ type: 'latency' })
    const routed = service.routeRequest()
    expect(routed!.name).toBe('us-east-1') // lowest latency
  })

  it('routes by failover', () => {
    service.setTrafficPolicy({ type: 'failover' })
    const routed = service.routeRequest()
    expect(routed!.isPrimary).toBe(true)
  })

  it('triggers failover', () => {
    const regions = service.getRegions()
    const primary = regions.find(r => r.isPrimary)!
    const secondary = regions.find(r => !r.isPrimary)!
    const event = service.failover(primary.id, secondary.id, 'Health check failed', true)
    expect(event).not.toBeNull()
    expect(event!.status).toBe('completed')
    expect(service.getPrimaryRegion()!.name).toBe('eu-west-1')
  })

  it('manages recovery points', () => {
    const regions = service.getRegions()
    service.createRecoveryPoint(regions[0].id, 'snapshot')
    service.createRecoveryPoint(regions[0].id, 'continuous')
    expect(service.getRecoveryPoints(regions[0].id).length).toBe(2)
  })

  it('finds closest recovery point', () => {
    const regions = service.getRegions()
    service.createRecoveryPoint(regions[0].id)
    const closest = service.findClosestRecoveryPoint(regions[0].id, new Date().toISOString())
    expect(closest).not.toBeNull()
  })

  it('starts recovery', () => {
    const regions = service.getRegions()
    const rp = service.createRecoveryPoint(regions[0].id)
    const op = service.startRecovery(rp.id, regions[1].id)
    expect(op).not.toBeNull()
    expect(op!.status).toBe('completed')
  })

  it('configures PITR', () => {
    service.setPITRConfig({ retentionDays: 60 })
    expect(service.getPITRConfig().retentionDays).toBe(60)
  })
})

// ═══════════════════════════════════════════════════════════════
// Security Scanning
// ═══════════════════════════════════════════════════════════════
describe('SecurityScanningService', () => {
  let service: SecurityScanningService

  beforeEach(() => { service = new SecurityScanningService() })

  it('runs SAST scan', () => {
    const scan = service.runSASTScan('src/services/')
    expect(scan.status).toBe('completed')
    expect(scan.findings.length).toBeGreaterThan(0)
    expect(scan.summary.medium).toBeGreaterThan(0)
  })

  it('runs DAST scan', () => {
    const scan = service.runDASTScan('https://api.twinmcp.com')
    expect(scan.status).toBe('completed')
    expect(scan.pagesScanned).toBeGreaterThan(0)
  })

  it('tracks all findings', () => {
    service.runSASTScan('src/')
    service.runDASTScan('https://api.test.com')
    expect(service.getAllFindings().length).toBeGreaterThan(0)
    expect(service.getOpenFindings().length).toBeGreaterThan(0)
  })

  it('updates finding status', () => {
    const scan = service.runSASTScan('src/')
    const finding = scan.findings[0]
    expect(service.updateFindingStatus(finding.id, 'fixed')).toBe(true)
  })

  it('manages WAF rules', () => {
    service.addWAFRule('Block SQLi', 'block', { field: 'query', operator: 'contains', value: 'UNION SELECT' }, 'block')
    expect(service.getWAFRules().length).toBe(1)
  })

  it('evaluates WAF rules', () => {
    service.addWAFRule('Block SQLi', 'block', { field: 'query', operator: 'contains', value: 'UNION SELECT' }, 'block')
    expect(service.evaluateRequest({ query: "1' UNION SELECT * FROM users" }).allowed).toBe(false)
    expect(service.evaluateRequest({ query: 'normal search' }).allowed).toBe(true)
  })

  it('manages DDoS config', () => {
    service.setDDoSConfig({ rateLimit: 50 })
    expect(service.getDDoSConfig().rateLimit).toBe(50)
  })

  it('blocks and unblocks IPs', () => {
    service.blockIP('1.2.3.4', 60)
    expect(service.checkIP('1.2.3.4').allowed).toBe(false)
    service.unblockIP('1.2.3.4')
    expect(service.checkIP('1.2.3.4').allowed).toBe(true)
  })

  it('whitelists IPs', () => {
    service.setDDoSConfig({ whitelistedIPs: ['10.0.0.1'] })
    expect(service.checkIP('10.0.0.1').allowed).toBe(true)
  })

  it('blacklists IPs', () => {
    service.setDDoSConfig({ blacklistedIPs: ['evil.ip'] })
    expect(service.checkIP('evil.ip').allowed).toBe(false)
  })

  it('manages secret rotations', () => {
    const rot = service.addSecretRotation('DB_PASSWORD', 90)
    expect(rot.status).toBe('active')
    expect(service.getSecretRotations().length).toBe(1)
  })

  it('rotates secrets', () => {
    const rot = service.addSecretRotation('API_KEY', 30)
    expect(service.rotateSecret(rot.id)).toBe(true)
    expect(service.getSecretRotations()[0].rotationHistory.length).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════
// Compliance
// ═══════════════════════════════════════════════════════════════
describe('ComplianceService', () => {
  let service: ComplianceService

  beforeEach(() => { service = new ComplianceService() })

  it('has pre-initialized SOC2 controls', () => {
    expect(service.getControls().length).toBeGreaterThan(10)
  })

  it('filters controls by category', () => {
    const security = service.getControlsByCategory('security')
    expect(security.length).toBeGreaterThan(0)
    expect(security.every(c => c.category === 'security')).toBe(true)
  })

  it('updates control status', () => {
    const control = service.getControls()[0]
    expect(service.updateControlStatus(control.id, 'implemented', 'alice', 'Verified')).toBe(true)
    expect(service.getControl(control.id)!.status).toBe('implemented')
  })

  it('adds evidence', () => {
    const control = service.getControls()[0]
    service.addEvidence(control.id, 'Screenshot of access control config')
    expect(service.getControl(control.id)!.evidence.length).toBe(1)
  })

  it('computes SOC2 score', () => {
    const score = service.getSOC2Score()
    expect(score.total).toBeGreaterThan(0)
    expect(score.score).toBeGreaterThan(0)
  })

  it('manages retention policies', () => {
    const policy = service.addRetentionPolicy('Logs', 'application_logs', 90, 'delete')
    expect(policy.enabled).toBe(true)
    expect(service.getRetentionPolicies().length).toBe(1)
  })

  it('executes retention policy', () => {
    const policy = service.addRetentionPolicy('Logs', 'logs', 30)
    const result = service.executeRetentionPolicy(policy.id)
    expect(result).not.toBeNull()
    expect(result!.recordsAffected).toBeGreaterThanOrEqual(0)
  })

  it('submits deletion request', () => {
    const req = service.submitDeletionRequest('user-1', ['profile', 'messages', 'analytics'])
    expect(req.status).toBe('pending')
    expect(req.dataCategories.length).toBe(3)
    expect(req.verificationToken).toBeDefined()
  })

  it('processes deletion request', () => {
    const req = service.submitDeletionRequest('user-1', ['profile', 'messages'])
    expect(service.processDeletionRequest(req.id)).toBe(true)
    expect(service.getDeletionRequest(req.id)!.status).toBe('completed')
    expect(service.getDeletionRequest(req.id)!.deletedItems.length).toBe(2)
  })

  it('rejects deletion request', () => {
    const req = service.submitDeletionRequest('user-1', ['billing'])
    expect(service.rejectDeletionRequest(req.id, 'Legal hold')).toBe(true)
    expect(service.getDeletionRequest(req.id)!.status).toBe('rejected')
  })

  it('tracks audit log', () => {
    service.submitDeletionRequest('user-1', ['data'])
    expect(service.auditLogCount).toBeGreaterThan(0)
    expect(service.getAuditLog('deletion').length).toBeGreaterThan(0)
  })

  it('generates compliance report', () => {
    service.addRetentionPolicy('Logs', 'logs', 30)
    service.submitDeletionRequest('user-1', ['data'])
    const report = service.generateReport('full')
    expect(report.controls.total).toBeGreaterThan(0)
    expect(report.overallScore).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Support & Maintenance
// ═══════════════════════════════════════════════════════════════
describe('SupportMaintenanceService', () => {
  let service: SupportMaintenanceService

  beforeEach(() => { service = new SupportMaintenanceService() })

  describe('Tickets', () => {
    it('creates a ticket', () => {
      const ticket = service.createTicket('Login broken', 'Cannot login', 'user-1', 'high', 'auth')
      expect(ticket.status).toBe('open')
      expect(ticket.priority).toBe('high')
      expect(ticket.sla.responseTimeMinutes).toBe(60)
    })

    it('assigns a ticket', () => {
      const ticket = service.createTicket('Bug', 'Desc', 'user-1')
      expect(service.assignTicket(ticket.id, 'agent-1')).toBe(true)
      expect(service.getTicket(ticket.id)!.status).toBe('in_progress')
    })

    it('updates ticket status', () => {
      const ticket = service.createTicket('Bug', 'Desc', 'user-1')
      service.updateTicketStatus(ticket.id, 'resolved')
      expect(service.getTicket(ticket.id)!.resolvedAt).toBeDefined()
    })

    it('adds messages', () => {
      const ticket = service.createTicket('Bug', 'Desc', 'user-1')
      service.addTicketMessage(ticket.id, 'agent-1', 'agent', 'Looking into it')
      expect(service.getTicket(ticket.id)!.messages.length).toBe(1)
    })

    it('filters tickets', () => {
      service.createTicket('A', 'Desc', 'user-1', 'high')
      service.createTicket('B', 'Desc', 'user-2', 'low')
      expect(service.getTickets({ priority: 'high' }).length).toBe(1)
      expect(service.getTickets({ userId: 'user-1' }).length).toBe(1)
    })

    it('computes stats', () => {
      service.createTicket('A', 'Desc', 'user-1')
      const ticket = service.createTicket('B', 'Desc', 'user-2')
      service.updateTicketStatus(ticket.id, 'resolved')
      const stats = service.getTicketStats()
      expect(stats.total).toBe(2)
      expect(stats.resolved).toBe(1)
    })
  })

  describe('Knowledge base', () => {
    it('creates and publishes articles', () => {
      const article = service.createArticle('How to reset password', 'Go to settings...', 'auth', 'admin')
      expect(article.status).toBe('draft')
      service.publishArticle(article.id)
      expect(service.getArticle(article.id)!.status).toBe('published')
    })

    it('searches articles', () => {
      const a = service.createArticle('Password Reset', 'Steps to reset', 'auth', 'admin', ['password'])
      service.publishArticle(a.id)
      expect(service.searchArticles('password').length).toBe(1)
      expect(service.searchArticles('billing').length).toBe(0)
    })

    it('tracks views and ratings', () => {
      const a = service.createArticle('Guide', 'Content', 'general', 'admin')
      service.publishArticle(a.id)
      service.recordArticleView(a.id)
      service.rateArticle(a.id, true)
      service.rateArticle(a.id, false)
      expect(service.getArticle(a.id)!.views).toBe(1)
      expect(service.getArticle(a.id)!.helpful).toBe(1)
      expect(service.getArticle(a.id)!.notHelpful).toBe(1)
    })

    it('filters by category', () => {
      const a1 = service.createArticle('A', 'C', 'auth', 'admin')
      const a2 = service.createArticle('B', 'C', 'billing', 'admin')
      service.publishArticle(a1.id)
      service.publishArticle(a2.id)
      expect(service.getArticles('auth').length).toBe(1)
    })
  })

  describe('Status page', () => {
    it('adds components', () => {
      service.addComponent('API', 'Main API', 'Core')
      service.addComponent('Database', 'PostgreSQL', 'Core')
      expect(service.getComponents().length).toBe(2)
    })

    it('updates component status', () => {
      const comp = service.addComponent('API', 'Main API')
      service.updateComponentStatus(comp.id, 'degraded')
      expect(service.getComponent(comp.id)!.status).toBe('degraded')
    })

    it('computes overall status', () => {
      service.addComponent('API', 'API')
      expect(service.getOverallStatus()).toBe('operational')
      const comp = service.addComponent('DB', 'DB')
      service.updateComponentStatus(comp.id, 'major_outage')
      expect(service.getOverallStatus()).toBe('major_outage')
    })
  })

  describe('Incidents', () => {
    it('creates an incident', () => {
      const comp = service.addComponent('API', 'API')
      const incident = service.createIncident('API Down', 'critical', [comp.id])
      expect(incident.status).toBe('investigating')
      expect(service.getComponent(comp.id)!.status).toBe('major_outage')
    })

    it('updates and resolves incident', () => {
      const comp = service.addComponent('API', 'API')
      const incident = service.createIncident('API Slow', 'minor', [comp.id])
      service.updateIncident(incident.id, 'identified', 'Root cause found')
      service.updateIncident(incident.id, 'resolved', 'Fixed')
      expect(service.getIncident(incident.id)!.status).toBe('resolved')
      expect(service.getIncident(incident.id)!.updates.length).toBe(3)
      expect(service.getComponent(comp.id)!.status).toBe('operational')
    })

    it('lists active incidents', () => {
      const comp = service.addComponent('API', 'API')
      service.createIncident('Issue 1', 'minor', [comp.id])
      const inc2 = service.createIncident('Issue 2', 'major', [comp.id])
      service.updateIncident(inc2.id, 'resolved', 'Fixed')
      expect(service.getActiveIncidents().length).toBe(1)
    })
  })
})
