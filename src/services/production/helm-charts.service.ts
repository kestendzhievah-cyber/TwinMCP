/**
 * Helm Charts Service.
 *
 * Generates and manages Helm chart configurations:
 *   - Chart.yaml generation
 *   - Values.yaml templating
 *   - Template rendering (deployment, service, ingress, configmap, secrets)
 *   - Multi-environment overrides (dev, staging, prod)
 *   - Dependency management
 *   - Release management
 */

export interface HelmChart {
  name: string
  version: string
  appVersion: string
  description: string
  type: 'application' | 'library'
  dependencies: HelmDependency[]
  keywords: string[]
  maintainers: Array<{ name: string; email: string }>
}

export interface HelmDependency {
  name: string
  version: string
  repository: string
  condition?: string
}

export interface HelmValues {
  replicaCount: number
  image: { repository: string; tag: string; pullPolicy: string }
  service: { type: string; port: number }
  ingress: { enabled: boolean; className: string; hosts: Array<{ host: string; paths: Array<{ path: string; pathType: string }> }>; tls: Array<{ secretName: string; hosts: string[] }> }
  resources: { limits: { cpu: string; memory: string }; requests: { cpu: string; memory: string } }
  autoscaling: { enabled: boolean; minReplicas: number; maxReplicas: number; targetCPU: number; targetMemory: number }
  env: Record<string, string>
  secrets: Record<string, string>
  persistence: { enabled: boolean; size: string; storageClass: string }
  postgresql: { enabled: boolean; auth: { database: string; username: string } }
  redis: { enabled: boolean; architecture: string }
}

export interface HelmRelease {
  id: string
  chartName: string
  chartVersion: string
  namespace: string
  environment: string
  status: 'deployed' | 'pending' | 'failed' | 'superseded' | 'uninstalled'
  revision: number
  deployedAt: string
  values: Partial<HelmValues>
  notes: string
}

export interface HelmTemplate {
  name: string
  kind: string
  content: string
}

export class HelmChartsService {
  private charts: Map<string, HelmChart> = new Map()
  private releases: Map<string, HelmRelease> = new Map()
  private environmentOverrides: Map<string, Partial<HelmValues>> = new Map()
  private idCounter = 0

  // ── Chart Management ───────────────────────────────────────

  createChart(name: string, version: string, appVersion: string, description: string = ''): HelmChart {
    const chart: HelmChart = {
      name, version, appVersion, description,
      type: 'application', dependencies: [],
      keywords: [], maintainers: [],
    }
    this.charts.set(name, chart)
    return chart
  }

  getChart(name: string): HelmChart | undefined {
    return this.charts.get(name)
  }

  getCharts(): HelmChart[] {
    return Array.from(this.charts.values())
  }

  addDependency(chartName: string, dep: HelmDependency): boolean {
    const chart = this.charts.get(chartName)
    if (!chart) return false
    chart.dependencies.push(dep)
    return true
  }

  removeChart(name: string): boolean {
    return this.charts.delete(name)
  }

  // ── Values Generation ──────────────────────────────────────

  generateDefaultValues(): HelmValues {
    return {
      replicaCount: 2,
      image: { repository: 'twinmcp/app', tag: 'latest', pullPolicy: 'IfNotPresent' },
      service: { type: 'ClusterIP', port: 3000 },
      ingress: { enabled: true, className: 'nginx', hosts: [{ host: 'twinmcp.local', paths: [{ path: '/', pathType: 'Prefix' }] }], tls: [] },
      resources: { limits: { cpu: '500m', memory: '512Mi' }, requests: { cpu: '250m', memory: '256Mi' } },
      autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 10, targetCPU: 80, targetMemory: 80 },
      env: { NODE_ENV: 'production', PORT: '3000' },
      secrets: {},
      persistence: { enabled: false, size: '10Gi', storageClass: 'standard' },
      postgresql: { enabled: true, auth: { database: 'twinmcp', username: 'twinmcp' } },
      redis: { enabled: true, architecture: 'standalone' },
    }
  }

  // ── Environment Overrides ──────────────────────────────────

  setEnvironmentOverrides(env: string, overrides: Partial<HelmValues>): void {
    this.environmentOverrides.set(env, overrides)
  }

  getEnvironmentOverrides(env: string): Partial<HelmValues> | undefined {
    return this.environmentOverrides.get(env)
  }

  getEnvironments(): string[] {
    return Array.from(this.environmentOverrides.keys())
  }

  mergeValues(base: HelmValues, overrides: Partial<HelmValues>): HelmValues {
    return {
      ...base,
      ...overrides,
      image: { ...base.image, ...(overrides.image || {}) },
      service: { ...base.service, ...(overrides.service || {}) },
      resources: {
        limits: { ...base.resources.limits, ...(overrides.resources?.limits || {}) },
        requests: { ...base.resources.requests, ...(overrides.resources?.requests || {}) },
      },
      autoscaling: { ...base.autoscaling, ...(overrides.autoscaling || {}) },
      env: { ...base.env, ...(overrides.env || {}) },
      secrets: { ...base.secrets, ...(overrides.secrets || {}) },
    }
  }

  getValuesForEnvironment(env: string): HelmValues {
    const base = this.generateDefaultValues()
    const overrides = this.environmentOverrides.get(env)
    return overrides ? this.mergeValues(base, overrides) : base
  }

  // ── Template Generation ────────────────────────────────────

  generateTemplates(chartName: string, values: HelmValues): HelmTemplate[] {
    const chart = this.charts.get(chartName)
    if (!chart) return []

    return [
      this.generateDeploymentTemplate(chart, values),
      this.generateServiceTemplate(chart, values),
      this.generateIngressTemplate(chart, values),
      this.generateConfigMapTemplate(chart, values),
      this.generateHPATemplate(chart, values),
    ]
  }

  private generateDeploymentTemplate(chart: HelmChart, values: HelmValues): HelmTemplate {
    const envVars = Object.entries(values.env).map(([k, v]) => `        - name: ${k}\n          value: "${v}"`).join('\n')
    return {
      name: 'deployment.yaml', kind: 'Deployment',
      content: `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${chart.name}\n  labels:\n    app: ${chart.name}\nspec:\n  replicas: ${values.replicaCount}\n  selector:\n    matchLabels:\n      app: ${chart.name}\n  template:\n    metadata:\n      labels:\n        app: ${chart.name}\n    spec:\n      containers:\n      - name: ${chart.name}\n        image: ${values.image.repository}:${values.image.tag}\n        imagePullPolicy: ${values.image.pullPolicy}\n        ports:\n        - containerPort: ${values.service.port}\n        env:\n${envVars}\n        resources:\n          limits:\n            cpu: ${values.resources.limits.cpu}\n            memory: ${values.resources.limits.memory}\n          requests:\n            cpu: ${values.resources.requests.cpu}\n            memory: ${values.resources.requests.memory}`,
    }
  }

  private generateServiceTemplate(chart: HelmChart, values: HelmValues): HelmTemplate {
    return {
      name: 'service.yaml', kind: 'Service',
      content: `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${chart.name}\nspec:\n  type: ${values.service.type}\n  ports:\n  - port: ${values.service.port}\n    targetPort: ${values.service.port}\n  selector:\n    app: ${chart.name}`,
    }
  }

  private generateIngressTemplate(chart: HelmChart, values: HelmValues): HelmTemplate {
    const hosts = values.ingress.hosts.map(h => `  - host: ${h.host}\n    http:\n      paths:\n${h.paths.map(p => `      - path: ${p.path}\n        pathType: ${p.pathType}\n        backend:\n          service:\n            name: ${chart.name}\n            port:\n              number: ${values.service.port}`).join('\n')}`).join('\n')
    return {
      name: 'ingress.yaml', kind: 'Ingress',
      content: `apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: ${chart.name}\n  annotations:\n    kubernetes.io/ingress.class: ${values.ingress.className}\nspec:\n  rules:\n${hosts}`,
    }
  }

  private generateConfigMapTemplate(chart: HelmChart, values: HelmValues): HelmTemplate {
    const data = Object.entries(values.env).map(([k, v]) => `  ${k}: "${v}"`).join('\n')
    return {
      name: 'configmap.yaml', kind: 'ConfigMap',
      content: `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${chart.name}-config\ndata:\n${data}`,
    }
  }

  private generateHPATemplate(chart: HelmChart, values: HelmValues): HelmTemplate {
    return {
      name: 'hpa.yaml', kind: 'HorizontalPodAutoscaler',
      content: `apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: ${chart.name}\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: ${chart.name}\n  minReplicas: ${values.autoscaling.minReplicas}\n  maxReplicas: ${values.autoscaling.maxReplicas}\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: ${values.autoscaling.targetCPU}`,
    }
  }

  // ── Chart.yaml Generation ──────────────────────────────────

  generateChartYaml(chartName: string): string | null {
    const chart = this.charts.get(chartName)
    if (!chart) return null
    const deps = chart.dependencies.length > 0
      ? `dependencies:\n${chart.dependencies.map(d => `  - name: ${d.name}\n    version: ${d.version}\n    repository: ${d.repository}${d.condition ? `\n    condition: ${d.condition}` : ''}`).join('\n')}`
      : ''
    return `apiVersion: v2\nname: ${chart.name}\ndescription: ${chart.description}\ntype: ${chart.type}\nversion: ${chart.version}\nappVersion: "${chart.appVersion}"\n${deps}`
  }

  // ── Release Management ─────────────────────────────────────

  install(chartName: string, namespace: string, environment: string, valueOverrides?: Partial<HelmValues>): HelmRelease | null {
    const chart = this.charts.get(chartName)
    if (!chart) return null

    const values = this.getValuesForEnvironment(environment)
    const merged = valueOverrides ? this.mergeValues(values, valueOverrides) : values

    const release: HelmRelease = {
      id: `rel-${++this.idCounter}`,
      chartName, chartVersion: chart.version,
      namespace, environment,
      status: 'deployed', revision: 1,
      deployedAt: new Date().toISOString(),
      values: merged, notes: `${chart.name} deployed to ${namespace}`,
    }
    this.releases.set(release.id, release)
    return release
  }

  upgrade(releaseId: string, valueOverrides?: Partial<HelmValues>): boolean {
    const release = this.releases.get(releaseId)
    if (!release) return false
    release.revision++
    release.deployedAt = new Date().toISOString()
    release.status = 'deployed'
    if (valueOverrides) {
      release.values = this.mergeValues(release.values as HelmValues, valueOverrides)
    }
    return true
  }

  uninstall(releaseId: string): boolean {
    const release = this.releases.get(releaseId)
    if (!release) return false
    release.status = 'uninstalled'
    return true
  }

  getRelease(id: string): HelmRelease | undefined {
    return this.releases.get(id)
  }

  getReleases(): HelmRelease[] {
    return Array.from(this.releases.values())
  }

  getReleasesByEnvironment(env: string): HelmRelease[] {
    return this.getReleases().filter(r => r.environment === env)
  }
}

export const helmChartsService = new HelmChartsService()
