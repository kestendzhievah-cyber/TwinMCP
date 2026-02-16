/**
 * Executive Summary Service.
 *
 * Generates high-level business summaries from analytics data:
 *   - KPI aggregation
 *   - Period-over-period comparison
 *   - Trend detection (up/down/stable)
 *   - Natural language insights
 *   - Exportable summary reports
 */

export interface KPI {
  name: string
  value: number
  previousValue: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  status: 'good' | 'warning' | 'critical' | 'neutral'
}

export interface ExecutiveSummary {
  id: string
  title: string
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  generatedAt: string
  kpis: KPI[]
  highlights: string[]
  concerns: string[]
  recommendations: string[]
  sections: SummarySection[]
}

export interface SummarySection {
  title: string
  metrics: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable' }>
  narrative: string
}

export interface MetricInput {
  name: string
  current: number
  previous: number
  unit: string
  higherIsBetter: boolean
}

export class ExecutiveSummaryService {
  private summaries: Map<string, ExecutiveSummary> = new Map()
  private idCounter = 0

  // ── Generation ─────────────────────────────────────────────

  generate(title: string, period: { from: string; to: string }, previousPeriod: { from: string; to: string }, metrics: MetricInput[], sections?: SummarySection[]): ExecutiveSummary {
    const kpis = metrics.map(m => this.computeKPI(m))
    const highlights = this.generateHighlights(kpis)
    const concerns = this.generateConcerns(kpis)
    const recommendations = this.generateRecommendations(kpis)

    const summary: ExecutiveSummary = {
      id: `summary-${++this.idCounter}`,
      title, period, previousPeriod,
      generatedAt: new Date().toISOString(),
      kpis, highlights, concerns, recommendations,
      sections: sections || [],
    }

    this.summaries.set(summary.id, summary)
    return summary
  }

  getSummary(id: string): ExecutiveSummary | undefined {
    return this.summaries.get(id)
  }

  getSummaries(): ExecutiveSummary[] {
    return Array.from(this.summaries.values()).sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )
  }

  removeSummary(id: string): boolean {
    return this.summaries.delete(id)
  }

  // ── KPI Computation ────────────────────────────────────────

  computeKPI(input: MetricInput): KPI {
    const change = input.previous !== 0
      ? ((input.current - input.previous) / input.previous) * 100
      : input.current > 0 ? 100 : 0

    const trend: 'up' | 'down' | 'stable' =
      Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down'

    let status: KPI['status'] = 'neutral'
    if (input.higherIsBetter) {
      if (change > 10) status = 'good'
      else if (change < -10) status = 'critical'
      else if (change < -5) status = 'warning'
    } else {
      if (change < -10) status = 'good'
      else if (change > 10) status = 'critical'
      else if (change > 5) status = 'warning'
    }

    return {
      name: input.name,
      value: input.current,
      previousValue: input.previous,
      unit: input.unit,
      trend,
      changePercent: Math.round(change * 100) / 100,
      status,
    }
  }

  // ── Insight Generation ─────────────────────────────────────

  generateHighlights(kpis: KPI[]): string[] {
    const highlights: string[] = []
    for (const kpi of kpis) {
      if (kpi.status === 'good') {
        highlights.push(`${kpi.name} improved by ${Math.abs(kpi.changePercent)}% to ${kpi.value} ${kpi.unit}`)
      }
    }
    if (highlights.length === 0) {
      const stable = kpis.filter(k => k.trend === 'stable')
      if (stable.length > 0) {
        highlights.push(`${stable.length} metric(s) remained stable this period`)
      }
    }
    return highlights
  }

  generateConcerns(kpis: KPI[]): string[] {
    const concerns: string[] = []
    for (const kpi of kpis) {
      if (kpi.status === 'critical') {
        concerns.push(`${kpi.name} declined by ${Math.abs(kpi.changePercent)}% — requires immediate attention`)
      } else if (kpi.status === 'warning') {
        concerns.push(`${kpi.name} showing a ${Math.abs(kpi.changePercent)}% negative trend`)
      }
    }
    return concerns
  }

  generateRecommendations(kpis: KPI[]): string[] {
    const recs: string[] = []
    const critical = kpis.filter(k => k.status === 'critical')
    const warning = kpis.filter(k => k.status === 'warning')

    if (critical.length > 0) {
      recs.push(`Investigate root cause for ${critical.map(k => k.name).join(', ')}`)
    }
    if (warning.length > 0) {
      recs.push(`Monitor ${warning.map(k => k.name).join(', ')} closely over the next period`)
    }
    if (critical.length === 0 && warning.length === 0) {
      recs.push('All metrics are healthy — continue current strategy')
    }
    return recs
  }

  // ── Narrative ──────────────────────────────────────────────

  /** Generate a natural language narrative from KPIs. */
  generateNarrative(kpis: KPI[]): string {
    if (kpis.length === 0) return 'No metrics available for this period.'

    const good = kpis.filter(k => k.status === 'good')
    const bad = kpis.filter(k => k.status === 'critical' || k.status === 'warning')
    const parts: string[] = []

    if (good.length > 0) {
      parts.push(`Strong performance in ${good.map(k => k.name).join(', ')}.`)
    }
    if (bad.length > 0) {
      parts.push(`Areas of concern: ${bad.map(k => `${k.name} (${k.changePercent > 0 ? '+' : ''}${k.changePercent}%)`).join(', ')}.`)
    }
    if (good.length === 0 && bad.length === 0) {
      parts.push('Overall metrics remained stable with no significant changes.')
    }

    return parts.join(' ')
  }

  // ── Export ─────────────────────────────────────────────────

  exportAsText(summaryId: string): string | null {
    const s = this.summaries.get(summaryId)
    if (!s) return null

    const lines: string[] = [
      `# ${s.title}`,
      `Period: ${s.period.from} to ${s.period.to}`,
      `Generated: ${s.generatedAt}`,
      '',
      '## Key Metrics',
      ...s.kpis.map(k => `- ${k.name}: ${k.value} ${k.unit} (${k.trend === 'up' ? '↑' : k.trend === 'down' ? '↓' : '→'} ${k.changePercent}%)`),
      '',
      '## Highlights',
      ...s.highlights.map(h => `- ${h}`),
      '',
      '## Concerns',
      ...(s.concerns.length > 0 ? s.concerns.map(c => `- ${c}`) : ['- None']),
      '',
      '## Recommendations',
      ...s.recommendations.map(r => `- ${r}`),
    ]

    return lines.join('\n')
  }
}

export const executiveSummaryService = new ExecutiveSummaryService()
