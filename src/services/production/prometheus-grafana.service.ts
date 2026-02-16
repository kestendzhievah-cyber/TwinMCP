/**
 * Prometheus & Grafana Integration Service.
 *
 * Metrics export and dashboard management:
 *   - Prometheus metrics registry (counter, gauge, histogram, summary)
 *   - /metrics endpoint generation in OpenMetrics format
 *   - Grafana dashboard provisioning (JSON model)
 *   - Panel management (graph, stat, table, gauge, heatmap)
 *   - Alert rule management for Grafana
 *   - Default dashboards (system, application, business)
 */

export interface PrometheusMetric {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  help: string
  labels: string[]
  value: number
  buckets?: number[]
  observations?: number[]
  labelValues?: Record<string, number>
}

export interface GrafanaDashboard {
  id: string
  uid: string
  title: string
  description: string
  tags: string[]
  panels: GrafanaPanel[]
  variables: Array<{ name: string; type: string; query: string }>
  refresh: string
  timeRange: { from: string; to: string }
  version: number
}

export interface GrafanaPanel {
  id: number
  title: string
  type: 'graph' | 'stat' | 'table' | 'gauge' | 'heatmap' | 'timeseries' | 'barchart'
  gridPos: { x: number; y: number; w: number; h: number }
  targets: Array<{ expr: string; legendFormat: string }>
  thresholds?: Array<{ value: number; color: string }>
}

export interface GrafanaAlertRule {
  id: string
  name: string
  dashboardUid: string
  panelId: number
  condition: { metric: string; operator: 'gt' | 'lt' | 'eq'; threshold: number; forDuration: string }
  notifications: string[]
  enabled: boolean
  state: 'ok' | 'pending' | 'alerting' | 'no_data'
}

export class PrometheusGrafanaService {
  private metrics: Map<string, PrometheusMetric> = new Map()
  private dashboards: Map<string, GrafanaDashboard> = new Map()
  private alertRules: Map<string, GrafanaAlertRule> = new Map()
  private idCounter = 0
  private panelCounter = 0

  // ── Prometheus Metrics ─────────────────────────────────────

  registerCounter(name: string, help: string, labels: string[] = []): PrometheusMetric {
    const metric: PrometheusMetric = { name, type: 'counter', help, labels, value: 0, labelValues: {} }
    this.metrics.set(name, metric)
    return metric
  }

  registerGauge(name: string, help: string, labels: string[] = []): PrometheusMetric {
    const metric: PrometheusMetric = { name, type: 'gauge', help, labels, value: 0, labelValues: {} }
    this.metrics.set(name, metric)
    return metric
  }

  registerHistogram(name: string, help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): PrometheusMetric {
    const metric: PrometheusMetric = { name, type: 'histogram', help, labels: [], value: 0, buckets, observations: [] }
    this.metrics.set(name, metric)
    return metric
  }

  registerSummary(name: string, help: string): PrometheusMetric {
    const metric: PrometheusMetric = { name, type: 'summary', help, labels: [], value: 0, observations: [] }
    this.metrics.set(name, metric)
    return metric
  }

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): boolean {
    const metric = this.metrics.get(name)
    if (!metric || metric.type !== 'counter') return false
    metric.value += value
    if (labels) {
      const key = Object.values(labels).join(',')
      metric.labelValues![key] = (metric.labelValues![key] || 0) + value
    }
    return true
  }

  setGauge(name: string, value: number): boolean {
    const metric = this.metrics.get(name)
    if (!metric || metric.type !== 'gauge') return false
    metric.value = value
    return true
  }

  observeHistogram(name: string, value: number): boolean {
    const metric = this.metrics.get(name)
    if (!metric || metric.type !== 'histogram') return false
    metric.observations!.push(value)
    metric.value = metric.observations!.length
    return true
  }

  observeSummary(name: string, value: number): boolean {
    const metric = this.metrics.get(name)
    if (!metric || metric.type !== 'summary') return false
    metric.observations!.push(value)
    metric.value = metric.observations!.length
    return true
  }

  getMetric(name: string): PrometheusMetric | undefined { return this.metrics.get(name) }
  getMetrics(): PrometheusMetric[] { return Array.from(this.metrics.values()) }

  /** Generate Prometheus /metrics endpoint output in OpenMetrics text format. */
  generateMetricsOutput(): string {
    const lines: string[] = []
    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`)
      lines.push(`# TYPE ${metric.name} ${metric.type}`)

      if (metric.type === 'histogram' && metric.observations) {
        const sorted = [...metric.observations].sort((a, b) => a - b)
        const sum = sorted.reduce((s, v) => s + v, 0)
        for (const bucket of metric.buckets || []) {
          const count = sorted.filter(v => v <= bucket).length
          lines.push(`${metric.name}_bucket{le="${bucket}"} ${count}`)
        }
        lines.push(`${metric.name}_bucket{le="+Inf"} ${sorted.length}`)
        lines.push(`${metric.name}_sum ${sum}`)
        lines.push(`${metric.name}_count ${sorted.length}`)
      } else if (metric.type === 'summary' && metric.observations) {
        const sorted = [...metric.observations].sort((a, b) => a - b)
        const sum = sorted.reduce((s, v) => s + v, 0)
        const quantiles = [0.5, 0.9, 0.99]
        for (const q of quantiles) {
          const idx = Math.ceil(q * sorted.length) - 1
          lines.push(`${metric.name}{quantile="${q}"} ${sorted[Math.max(0, idx)] || 0}`)
        }
        lines.push(`${metric.name}_sum ${sum}`)
        lines.push(`${metric.name}_count ${sorted.length}`)
      } else {
        lines.push(`${metric.name} ${metric.value}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  // ── Grafana Dashboards ─────────────────────────────────────

  createDashboard(title: string, description: string = '', tags: string[] = []): GrafanaDashboard {
    const uid = `dash-${++this.idCounter}`
    const dashboard: GrafanaDashboard = {
      id: uid, uid, title, description, tags, panels: [],
      variables: [], refresh: '30s', timeRange: { from: 'now-1h', to: 'now' }, version: 1,
    }
    this.dashboards.set(uid, dashboard)
    return dashboard
  }

  addPanel(dashboardUid: string, title: string, type: GrafanaPanel['type'], targets: GrafanaPanel['targets'], gridPos?: Partial<GrafanaPanel['gridPos']>): GrafanaPanel | null {
    const dashboard = this.dashboards.get(dashboardUid)
    if (!dashboard) return null
    const panel: GrafanaPanel = {
      id: ++this.panelCounter, title, type, targets,
      gridPos: { x: gridPos?.x || 0, y: gridPos?.y || (dashboard.panels.length * 8), w: gridPos?.w || 12, h: gridPos?.h || 8 },
    }
    dashboard.panels.push(panel)
    return panel
  }

  getDashboard(uid: string): GrafanaDashboard | undefined { return this.dashboards.get(uid) }
  getDashboards(): GrafanaDashboard[] { return Array.from(this.dashboards.values()) }
  removeDashboard(uid: string): boolean { return this.dashboards.delete(uid) }

  /** Generate a complete Grafana dashboard JSON model. */
  exportDashboardJSON(uid: string): object | null {
    const dashboard = this.dashboards.get(uid)
    if (!dashboard) return null
    return {
      dashboard: {
        id: null, uid: dashboard.uid, title: dashboard.title,
        description: dashboard.description, tags: dashboard.tags,
        timezone: 'browser', refresh: dashboard.refresh,
        time: dashboard.timeRange,
        panels: dashboard.panels.map(p => ({
          id: p.id, title: p.title, type: p.type, gridPos: p.gridPos,
          targets: p.targets.map(t => ({ expr: t.expr, legendFormat: t.legendFormat, refId: 'A' })),
          ...(p.thresholds ? { fieldConfig: { defaults: { thresholds: { steps: p.thresholds.map(t => ({ value: t.value, color: t.color })) } } } } : {}),
        })),
        templating: { list: dashboard.variables },
        schemaVersion: 39, version: dashboard.version,
      },
      overwrite: true,
    }
  }

  // ── Default Dashboards ─────────────────────────────────────

  createSystemDashboard(): GrafanaDashboard {
    const d = this.createDashboard('TwinMCP - System Metrics', 'System-level monitoring', ['system'])
    this.addPanel(d.uid, 'CPU Usage', 'timeseries', [{ expr: 'process_cpu_seconds_total', legendFormat: 'CPU' }])
    this.addPanel(d.uid, 'Memory Usage', 'gauge', [{ expr: 'process_resident_memory_bytes', legendFormat: 'Memory' }])
    this.addPanel(d.uid, 'Open File Descriptors', 'stat', [{ expr: 'process_open_fds', legendFormat: 'FDs' }])
    return d
  }

  createApplicationDashboard(): GrafanaDashboard {
    const d = this.createDashboard('TwinMCP - Application Metrics', 'Application-level monitoring', ['app'])
    this.addPanel(d.uid, 'Request Rate', 'timeseries', [{ expr: 'rate(http_requests_total[5m])', legendFormat: '{{method}} {{path}}' }])
    this.addPanel(d.uid, 'Response Time (p95)', 'timeseries', [{ expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))', legendFormat: 'p95' }])
    this.addPanel(d.uid, 'Error Rate', 'stat', [{ expr: 'rate(http_requests_total{status=~"5.."}[5m])', legendFormat: 'Errors' }])
    this.addPanel(d.uid, 'Active Connections', 'gauge', [{ expr: 'http_active_connections', legendFormat: 'Connections' }])
    return d
  }

  createBusinessDashboard(): GrafanaDashboard {
    const d = this.createDashboard('TwinMCP - Business Metrics', 'Business KPIs', ['business'])
    this.addPanel(d.uid, 'MRR', 'stat', [{ expr: 'billing_mrr_total', legendFormat: 'MRR' }])
    this.addPanel(d.uid, 'Active Users', 'timeseries', [{ expr: 'active_users_total', legendFormat: 'Users' }])
    this.addPanel(d.uid, 'API Calls', 'barchart', [{ expr: 'sum(rate(mcp_tool_calls_total[1h])) by (tool)', legendFormat: '{{tool}}' }])
    return d
  }

  // ── Alert Rules ────────────────────────────────────────────

  addAlertRule(name: string, dashboardUid: string, panelId: number, condition: GrafanaAlertRule['condition'], notifications: string[] = []): GrafanaAlertRule {
    const rule: GrafanaAlertRule = {
      id: `alert-${++this.idCounter}`, name, dashboardUid, panelId,
      condition, notifications, enabled: true, state: 'ok',
    }
    this.alertRules.set(rule.id, rule)
    return rule
  }

  evaluateAlertRule(ruleId: string, currentValue: number): 'ok' | 'alerting' {
    const rule = this.alertRules.get(ruleId)
    if (!rule || !rule.enabled) return 'ok'
    let alerting = false
    if (rule.condition.operator === 'gt') alerting = currentValue > rule.condition.threshold
    else if (rule.condition.operator === 'lt') alerting = currentValue < rule.condition.threshold
    else if (rule.condition.operator === 'eq') alerting = currentValue === rule.condition.threshold
    rule.state = alerting ? 'alerting' : 'ok'
    return rule.state
  }

  getAlertRules(): GrafanaAlertRule[] { return Array.from(this.alertRules.values()) }
  removeAlertRule(id: string): boolean { return this.alertRules.delete(id) }
}

export const prometheusGrafanaService = new PrometheusGrafanaService()
