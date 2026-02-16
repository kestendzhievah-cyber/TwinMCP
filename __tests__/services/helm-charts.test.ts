import { HelmChartsService } from '../../src/services/production/helm-charts.service'

describe('HelmChartsService', () => {
  let service: HelmChartsService

  beforeEach(() => {
    service = new HelmChartsService()
  })

  describe('Chart management', () => {
    it('creates a chart', () => {
      const chart = service.createChart('twinmcp', '1.0.0', '2.0.0', 'TwinMCP Application')
      expect(chart.name).toBe('twinmcp')
      expect(chart.version).toBe('1.0.0')
    })

    it('lists charts', () => {
      service.createChart('a', '1.0.0', '1.0.0')
      service.createChart('b', '1.0.0', '1.0.0')
      expect(service.getCharts().length).toBe(2)
    })

    it('adds dependencies', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      expect(service.addDependency('app', { name: 'postgresql', version: '12.0.0', repository: 'https://charts.bitnami.com/bitnami' })).toBe(true)
      expect(service.getChart('app')!.dependencies.length).toBe(1)
    })

    it('removes a chart', () => {
      service.createChart('test', '1.0.0', '1.0.0')
      expect(service.removeChart('test')).toBe(true)
    })
  })

  describe('Values generation', () => {
    it('generates default values', () => {
      const values = service.generateDefaultValues()
      expect(values.replicaCount).toBe(2)
      expect(values.image.repository).toBe('twinmcp/app')
      expect(values.autoscaling.enabled).toBe(true)
    })

    it('sets environment overrides', () => {
      service.setEnvironmentOverrides('production', { replicaCount: 5, image: { repository: 'twinmcp/app', tag: 'v2.0.0', pullPolicy: 'Always' } })
      const values = service.getValuesForEnvironment('production')
      expect(values.replicaCount).toBe(5)
      expect(values.image.tag).toBe('v2.0.0')
    })

    it('merges values correctly', () => {
      const base = service.generateDefaultValues()
      const merged = service.mergeValues(base, { replicaCount: 10, env: { EXTRA: 'yes' } })
      expect(merged.replicaCount).toBe(10)
      expect(merged.env.EXTRA).toBe('yes')
      expect(merged.env.NODE_ENV).toBe('production') // preserved from base
    })

    it('lists environments', () => {
      service.setEnvironmentOverrides('dev', { replicaCount: 1 })
      service.setEnvironmentOverrides('prod', { replicaCount: 5 })
      expect(service.getEnvironments().length).toBe(2)
    })
  })

  describe('Template generation', () => {
    it('generates templates', () => {
      service.createChart('twinmcp', '1.0.0', '2.0.0')
      const values = service.generateDefaultValues()
      const templates = service.generateTemplates('twinmcp', values)
      expect(templates.length).toBe(5)
      expect(templates.map(t => t.kind)).toContain('Deployment')
      expect(templates.map(t => t.kind)).toContain('Service')
      expect(templates.map(t => t.kind)).toContain('Ingress')
    })

    it('deployment template contains image', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      const values = service.generateDefaultValues()
      const templates = service.generateTemplates('app', values)
      const deploy = templates.find(t => t.kind === 'Deployment')!
      expect(deploy.content).toContain('twinmcp/app')
    })

    it('returns empty for unknown chart', () => {
      expect(service.generateTemplates('unknown', service.generateDefaultValues()).length).toBe(0)
    })
  })

  describe('Chart.yaml generation', () => {
    it('generates Chart.yaml', () => {
      service.createChart('twinmcp', '1.0.0', '2.0.0', 'TwinMCP App')
      const yaml = service.generateChartYaml('twinmcp')
      expect(yaml).toContain('name: twinmcp')
      expect(yaml).toContain('version: 1.0.0')
      expect(yaml).toContain('appVersion: "2.0.0"')
    })

    it('includes dependencies', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      service.addDependency('app', { name: 'redis', version: '17.0.0', repository: 'https://charts.bitnami.com/bitnami', condition: 'redis.enabled' })
      const yaml = service.generateChartYaml('app')!
      expect(yaml).toContain('dependencies:')
      expect(yaml).toContain('name: redis')
      expect(yaml).toContain('condition: redis.enabled')
    })

    it('returns null for unknown chart', () => {
      expect(service.generateChartYaml('unknown')).toBeNull()
    })
  })

  describe('Release management', () => {
    it('installs a release', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      const release = service.install('app', 'default', 'production')
      expect(release).not.toBeNull()
      expect(release!.status).toBe('deployed')
      expect(release!.revision).toBe(1)
    })

    it('upgrades a release', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      const release = service.install('app', 'default', 'production')!
      expect(service.upgrade(release.id, { replicaCount: 5 })).toBe(true)
      expect(service.getRelease(release.id)!.revision).toBe(2)
    })

    it('uninstalls a release', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      const release = service.install('app', 'default', 'production')!
      expect(service.uninstall(release.id)).toBe(true)
      expect(service.getRelease(release.id)!.status).toBe('uninstalled')
    })

    it('lists releases by environment', () => {
      service.createChart('app', '1.0.0', '1.0.0')
      service.install('app', 'default', 'production')
      service.install('app', 'dev', 'development')
      expect(service.getReleasesByEnvironment('production').length).toBe(1)
    })
  })
})
