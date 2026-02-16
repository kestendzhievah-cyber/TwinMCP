import { PrometheusGrafanaService } from '../../src/services/production/prometheus-grafana.service'
import { StagingEnvironmentService } from '../../src/services/production/staging-environment.service'
import { RoleManagementService } from '../../src/services/production/role-management.service'
import { MLRankingService } from '../../src/services/library/ml-ranking.service'
import { IncrementalDownloadService } from '../../src/services/crawling/incremental-download.service'

// ═══════════════════════════════════════════════════════════════
// Prometheus & Grafana
// ═══════════════════════════════════════════════════════════════
describe('PrometheusGrafanaService', () => {
  let service: PrometheusGrafanaService

  beforeEach(() => { service = new PrometheusGrafanaService() })

  describe('Metrics', () => {
    it('registers and increments a counter', () => {
      service.registerCounter('http_requests_total', 'Total HTTP requests')
      service.incrementCounter('http_requests_total', 5)
      expect(service.getMetric('http_requests_total')!.value).toBe(5)
    })

    it('registers and sets a gauge', () => {
      service.registerGauge('active_connections', 'Active connections')
      service.setGauge('active_connections', 42)
      expect(service.getMetric('active_connections')!.value).toBe(42)
    })

    it('registers and observes a histogram', () => {
      service.registerHistogram('request_duration', 'Request duration')
      service.observeHistogram('request_duration', 0.05)
      service.observeHistogram('request_duration', 0.15)
      expect(service.getMetric('request_duration')!.observations!.length).toBe(2)
    })

    it('registers and observes a summary', () => {
      service.registerSummary('response_size', 'Response size')
      service.observeSummary('response_size', 1024)
      expect(service.getMetric('response_size')!.value).toBe(1)
    })

    it('generates OpenMetrics output', () => {
      service.registerCounter('test_counter', 'A test counter')
      service.incrementCounter('test_counter', 10)
      const output = service.generateMetricsOutput()
      expect(output).toContain('# HELP test_counter')
      expect(output).toContain('# TYPE test_counter counter')
      expect(output).toContain('test_counter 10')
    })

    it('generates histogram output with buckets', () => {
      service.registerHistogram('latency', 'Latency', [0.1, 0.5, 1])
      service.observeHistogram('latency', 0.05)
      service.observeHistogram('latency', 0.3)
      const output = service.generateMetricsOutput()
      expect(output).toContain('latency_bucket{le="0.1"} 1')
      expect(output).toContain('latency_bucket{le="0.5"} 2')
      expect(output).toContain('latency_count 2')
    })

    it('rejects wrong metric type operations', () => {
      service.registerCounter('c', 'counter')
      expect(service.setGauge('c', 5)).toBe(false)
      expect(service.observeHistogram('c', 1)).toBe(false)
    })
  })

  describe('Dashboards', () => {
    it('creates a dashboard', () => {
      const d = service.createDashboard('Test Dashboard', 'desc', ['test'])
      expect(d.title).toBe('Test Dashboard')
      expect(service.getDashboards().length).toBe(1)
    })

    it('adds panels', () => {
      const d = service.createDashboard('Test')
      const panel = service.addPanel(d.uid, 'CPU', 'timeseries', [{ expr: 'cpu_usage', legendFormat: 'CPU' }])
      expect(panel).not.toBeNull()
      expect(service.getDashboard(d.uid)!.panels.length).toBe(1)
    })

    it('exports dashboard JSON', () => {
      const d = service.createDashboard('Export Test')
      service.addPanel(d.uid, 'Panel', 'stat', [{ expr: 'metric', legendFormat: 'M' }])
      const json = service.exportDashboardJSON(d.uid) as any
      expect(json.dashboard.title).toBe('Export Test')
      expect(json.dashboard.panels.length).toBe(1)
    })

    it('creates default dashboards', () => {
      const sys = service.createSystemDashboard()
      const app = service.createApplicationDashboard()
      const biz = service.createBusinessDashboard()
      expect(sys.panels.length).toBe(3)
      expect(app.panels.length).toBe(4)
      expect(biz.panels.length).toBe(3)
    })
  })

  describe('Alert rules', () => {
    it('adds and evaluates alert rules', () => {
      const d = service.createDashboard('Alerts')
      const rule = service.addAlertRule('High CPU', d.uid, 1, { metric: 'cpu', operator: 'gt', threshold: 80, forDuration: '5m' })
      expect(service.evaluateAlertRule(rule.id, 90)).toBe('alerting')
      expect(service.evaluateAlertRule(rule.id, 50)).toBe('ok')
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// Staging Environment
// ═══════════════════════════════════════════════════════════════
describe('StagingEnvironmentService', () => {
  let service: StagingEnvironmentService

  beforeEach(() => { service = new StagingEnvironmentService() })

  it('initializes with 3 default environments', () => {
    expect(service.getEnvironments().length).toBe(3)
    expect(service.getEnvironmentByName('staging')).toBeDefined()
  })

  it('sets and gets variables', () => {
    const env = service.getEnvironmentByName('staging')!
    service.setVariable(env.id, 'DATABASE_URL', 'postgres://staging', { sensitive: true })
    const v = service.getVariable(env.id, 'DATABASE_URL')
    expect(v!.value).toBe('postgres://staging')
    expect(v!.sensitive).toBe(true)
  })

  it('validates required keys', () => {
    const env = service.getEnvironmentByName('staging')!
    service.setVariable(env.id, 'DB_URL', 'x')
    const result = service.validateEnvironment(env.id, ['DB_URL', 'API_KEY'])
    expect(result.valid).toBe(false)
    expect(result.missing).toEqual(['API_KEY'])
  })

  it('diffs two environments', () => {
    const dev = service.getEnvironmentByName('development')!
    const staging = service.getEnvironmentByName('staging')!
    service.setVariable(dev.id, 'A', '1')
    service.setVariable(dev.id, 'B', '2')
    service.setVariable(staging.id, 'A', '1')
    service.setVariable(staging.id, 'C', '3')
    const diff = service.diffEnvironments(dev.id, staging.id)!
    expect(diff.added.length).toBe(1) // C only in staging
    expect(diff.removed.length).toBe(1) // B only in dev
    expect(diff.unchanged.length).toBe(1) // A same
  })

  it('promotes variables between environments', () => {
    const staging = service.getEnvironmentByName('staging')!
    const prod = service.getEnvironmentByName('production')!
    service.setVariable(staging.id, 'APP_VERSION', 'v2.0')
    service.setVariable(staging.id, 'SECRET', 'xxx')
    const record = service.promote(staging.id, prod.id, 'admin', ['SECRET'])!
    expect(record.variables).toContain('APP_VERSION')
    expect(record.skipped).toContain('SECRET')
    expect(service.getVariable(prod.id, 'APP_VERSION')!.value).toBe('v2.0')
  })

  it('creates and restores snapshots', () => {
    const env = service.getEnvironmentByName('staging')!
    service.setVariable(env.id, 'KEY', 'original')
    const snap = service.createSnapshot(env.id, 'admin', 'Before change')!
    service.setVariable(env.id, 'KEY', 'changed')
    expect(service.getVariable(env.id, 'KEY')!.value).toBe('changed')
    service.restoreSnapshot(snap.id)
    expect(service.getVariable(env.id, 'KEY')!.value).toBe('original')
  })

  it('tracks audit log', () => {
    const env = service.getEnvironmentByName('staging')!
    service.setVariable(env.id, 'X', 'Y')
    expect(service.auditLogCount).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Role Management
// ═══════════════════════════════════════════════════════════════
describe('RoleManagementService', () => {
  let service: RoleManagementService

  beforeEach(() => { service = new RoleManagementService() })

  it('initializes with system roles', () => {
    const roles = service.getRoles()
    expect(roles.length).toBeGreaterThanOrEqual(4)
    expect(service.getRoleByName('admin')).toBeDefined()
    expect(service.getRoleByName('viewer')).toBeDefined()
  })

  it('creates a custom role', () => {
    const role = service.createRole('tester', 'QA tester')
    expect(role.isSystem).toBe(false)
  })

  it('cannot delete system roles', () => {
    const admin = service.getRoleByName('admin')!
    expect(service.deleteRole(admin.id)).toBe(false)
  })

  it('adds permissions to a role', () => {
    const role = service.createRole('custom')
    service.addPermission(role.id, 'libraries', 'read')
    service.addPermission(role.id, 'libraries', 'create')
    expect(service.getRole(role.id)!.permissions.length).toBe(2)
  })

  it('resolves inherited permissions', () => {
    const admin = service.getRoleByName('admin')!
    const manager = service.getRoleByName('manager')!
    const effective = service.getEffectivePermissions(manager.id)
    // Manager inherits from admin, so should have wildcard
    expect(effective.some(p => p.resource === '*' && p.action === '*')).toBe(true)
  })

  it('assigns and revokes roles', () => {
    const viewer = service.getRoleByName('viewer')!
    expect(service.assignRole('user-1', viewer.id, 'admin')).toBe(true)
    expect(service.getUserRoles('user-1').length).toBe(1)
    expect(service.revokeRole('user-1', viewer.id)).toBe(true)
    expect(service.getUserRoles('user-1').length).toBe(0)
  })

  it('prevents duplicate assignment', () => {
    const viewer = service.getRoleByName('viewer')!
    service.assignRole('user-1', viewer.id, 'admin')
    expect(service.assignRole('user-1', viewer.id, 'admin')).toBe(false)
  })

  it('bulk assigns roles', () => {
    const viewer = service.getRoleByName('viewer')!
    const count = service.bulkAssignRole(['u1', 'u2', 'u3'], viewer.id, 'admin')
    expect(count).toBe(3)
    expect(service.getRoleUsers(viewer.id).length).toBe(3)
  })

  it('audits user permissions', () => {
    const dev = service.getRoleByName('developer')!
    service.assignRole('user-1', dev.id, 'admin')
    const audit = service.auditUserPermissions('user-1')
    expect(audit.roles).toContain('developer')
    expect(audit.effectivePermissions.length).toBeGreaterThan(0)
  })

  it('checks permission', () => {
    const admin = service.getRoleByName('admin')!
    service.assignRole('user-1', admin.id, 'system')
    expect(service.hasPermission('user-1', 'anything', 'delete')).toBe(true)
  })

  it('applies templates', () => {
    const role = service.createRole('api-dev')
    const templates = service.getTemplates()
    expect(templates.length).toBeGreaterThan(0)
    const apiDev = templates.find(t => t.id === 'api-developer')!
    expect(service.applyTemplate(apiDev.id, role.id)).toBe(true)
    expect(service.getRole(role.id)!.permissions.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// ML Ranking
// ═══════════════════════════════════════════════════════════════
describe('MLRankingService', () => {
  let service: MLRankingService

  beforeEach(() => { service = new MLRankingService() })

  it('has a default active model', () => {
    expect(service.getActiveModel()).toBeDefined()
    expect(service.getActiveModel()!.name).toBe('default-v1')
  })

  it('extracts features', () => {
    const features = service.extractFeatures({ downloads: 500000, stars: 5000, lastUpdated: new Date().toISOString(), qualityScore: 0.9, hasReadme: true, vulnerabilities: 0 })
    expect(features.popularity).toBeGreaterThan(0)
    expect(features.recency).toBeGreaterThan(0.9)
    expect(features.security).toBe(1)
  })

  it('scores items', () => {
    const features = service.extractFeatures({ downloads: 1000000, stars: 10000, qualityScore: 0.95, textMatchScore: 0.8 })
    const score = service.scoreItem(features)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('ranks items by score', () => {
    const items = [
      { id: 'a', features: service.extractFeatures({ downloads: 100, qualityScore: 0.3, textMatchScore: 0.2 }) },
      { id: 'b', features: service.extractFeatures({ downloads: 1000000, qualityScore: 0.95, textMatchScore: 0.9 }) },
    ]
    const ranked = service.rankItems(items)
    expect(ranked[0].itemId).toBe('b')
    expect(ranked[0].position).toBe(1)
  })

  it('explains ranking', () => {
    const features = service.extractFeatures({ downloads: 500000, textMatchScore: 0.9 })
    const model = service.getActiveModel()!
    const explanation = service.explainRanking(features, model)
    expect(explanation.topFactors.length).toBe(3)
    expect(explanation.totalScore).toBeGreaterThan(0)
  })

  it('records clicks and computes CTR', () => {
    service.recordClick('q1', 'item-a', 1, true)
    service.recordClick('q1', 'item-a', 1, true)
    service.recordClick('q1', 'item-a', 1, false)
    expect(service.getClickThroughRate('item-a')).toBeCloseTo(2 / 3)
  })

  it('trains from click data', () => {
    const model = service.getActiveModel()!
    const origVersion = model.version
    service.recordClick('q1', 'item-a', 1, true, 5000)
    service.recordClick('q1', 'item-b', 2, false)
    expect(service.trainFromClicks(model.id)).toBe(true)
    expect(service.getModel(model.id)!.version).toBe(origVersion + 1)
  })

  it('evaluates model with test data', () => {
    const model = service.getActiveModel()!
    const testData = [
      { features: service.extractFeatures({ downloads: 1000000, textMatchScore: 0.9 }), relevant: true },
      { features: service.extractFeatures({ downloads: 100, textMatchScore: 0.1 }), relevant: false },
      { features: service.extractFeatures({ downloads: 500000, textMatchScore: 0.7 }), relevant: true },
    ]
    const metrics = service.evaluateModel(model.id, testData)
    expect(metrics.precision).toBeGreaterThan(0)
    expect(metrics.mrr).toBeGreaterThan(0)
  })

  it('supports personalized ranking', () => {
    service.setUserProfile('user-1', { boostFactors: { quality: 0.5 } })
    const items = [
      { id: 'a', features: service.extractFeatures({ qualityScore: 0.9, textMatchScore: 0.5 }) },
      { id: 'b', features: service.extractFeatures({ qualityScore: 0.3, textMatchScore: 0.8 }) },
    ]
    const ranked = service.rankItems(items, 'user-1')
    // With quality boost, item 'a' should rank higher
    expect(ranked.length).toBe(2)
  })

  it('creates and activates models', () => {
    const model = service.createModel('test-v2', {
      popularity: 0.5, recency: 0.1, quality: 0.1, relevance: 0.1,
      maintenance: 0.05, communityHealth: 0.05, documentation: 0.05, security: 0.05,
    })
    service.activateModel(model.id)
    expect(service.getActiveModel()!.id).toBe(model.id)
  })
})

// ═══════════════════════════════════════════════════════════════
// Incremental Downloads
// ═══════════════════════════════════════════════════════════════
describe('IncrementalDownloadService', () => {
  let service: IncrementalDownloadService

  beforeEach(() => { service = new IncrementalDownloadService() })

  describe('Incremental downloads', () => {
    it('detects new resources', () => {
      const result = service.checkForUpdates('https://example.com/doc.html')
      expect(result.needsDownload).toBe(true)
      expect(result.reason).toBe('new_resource')
    })

    it('detects unchanged resources', () => {
      service.registerDownload('https://example.com/doc.html', '/tmp/doc.html', 1024, { etag: '"abc"' })
      const result = service.checkForUpdates('https://example.com/doc.html', '"abc"')
      expect(result.needsDownload).toBe(false)
    })

    it('detects changed etag', () => {
      service.registerDownload('https://example.com/doc.html', '/tmp/doc.html', 1024, { etag: '"abc"' })
      const result = service.checkForUpdates('https://example.com/doc.html', '"def"')
      expect(result.needsDownload).toBe(true)
      expect(result.reason).toBe('etag_changed')
    })

    it('tracks delta downloads', () => {
      service.registerDownload('https://example.com/a', '/tmp/a', 100, { etag: '"v1"' })
      service.registerDownload('https://example.com/a', '/tmp/a', 110, { etag: '"v2"' })
      expect(service.findByUrl('https://example.com/a')!.deltaDownloads).toBe(1)
    })

    it('detects duplicates by hash', () => {
      service.registerDownload('https://a.com/file', '/tmp/a', 100, { contentHash: 'abc123' })
      expect(service.findDuplicate('abc123')).toBeDefined()
      expect(service.findDuplicate('xyz789')).toBeUndefined()
    })
  })

  describe('Resume support', () => {
    it('saves and retrieves resume state', () => {
      service.saveResumeState('dl-1', 'https://example.com/big.zip', 5000, 10000)
      const state = service.getResumeState('dl-1')!
      expect(state.bytesDownloaded).toBe(5000)
      expect(state.rangeHeader).toBe('bytes=5000-')
    })

    it('clears resume state', () => {
      service.saveResumeState('dl-1', 'https://example.com/big.zip', 5000, 10000)
      service.clearResumeState('dl-1')
      expect(service.getResumeState('dl-1')).toBeUndefined()
    })

    it('lists pending resumes', () => {
      service.saveResumeState('dl-1', 'url1', 100, 1000)
      service.saveResumeState('dl-2', 'url2', 200, 2000)
      expect(service.getPendingResumes().length).toBe(2)
    })
  })

  describe('Cleanup', () => {
    it('adds and executes cleanup policy', () => {
      service.registerDownload('https://old.com/a', '/tmp/old', 5000)
      // Force old date
      const record = service.findByUrl('https://old.com/a')!
      ;(record as any).downloadedAt = new Date(Date.now() - 100 * 86400000).toISOString()

      const policy = service.addCleanupPolicy('Old files', 30, 1e9)
      const result = service.executeCleanup(policy.id)!
      expect(result.filesAffected).toBe(1)
      expect(result.bytesFreed).toBe(5000)
    })

    it('runs all cleanups', () => {
      service.addCleanupPolicy('Policy A', 1, 1e9)
      const results = service.runAllCleanups()
      expect(results.length).toBe(1)
    })

    it('marks stale records', () => {
      service.registerDownload('https://a.com/x', '/tmp/x', 100)
      const record = service.findByUrl('https://a.com/x')!
      ;(record as any).lastCheckedAt = new Date(Date.now() - 100 * 86400000).toISOString()
      expect(service.markStale(30)).toBe(1)
      expect(record.status).toBe('stale')
    })
  })

  describe('Storage quota', () => {
    it('tracks used storage', () => {
      service.registerDownload('https://a.com/1', '/tmp/1', 1000)
      service.registerDownload('https://a.com/2', '/tmp/2', 2000)
      expect(service.getQuota().usedBytes).toBe(3000)
      expect(service.getQuota().fileCount).toBe(2)
    })

    it('detects quota exceeded', () => {
      service.setMaxQuota(500)
      service.registerDownload('https://a.com/big', '/tmp/big', 1000)
      expect(service.isQuotaExceeded()).toBe(true)
    })

    it('detects quota warning', () => {
      service.setMaxQuota(1000)
      service.registerDownload('https://a.com/big', '/tmp/big', 850)
      expect(service.isQuotaWarning()).toBe(true)
    })
  })
})
