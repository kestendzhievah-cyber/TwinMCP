/**
 * Data Export Service.
 *
 * Exports analytics data in multiple formats:
 *   - CSV, JSON, Markdown export
 *   - Configurable columns and filters
 *   - Scheduled exports
 *   - Export history tracking
 */

export interface ExportConfig {
  format: 'csv' | 'json' | 'markdown' | 'tsv'
  columns?: string[]
  filters?: Record<string, any>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  includeHeaders?: boolean
  dateFormat?: string
}

export interface ExportJob {
  id: string
  name: string
  config: ExportConfig
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  result?: string
  rowCount?: number
  error?: string
}

export interface ScheduledExport {
  id: string
  name: string
  config: ExportConfig
  schedule: 'daily' | 'weekly' | 'monthly'
  enabled: boolean
  lastRun?: string
  nextRun: string
}

export class DataExportService {
  private jobs: Map<string, ExportJob> = new Map()
  private schedules: Map<string, ScheduledExport> = new Map()
  private idCounter = 0

  // ── Export Execution ───────────────────────────────────────

  /** Export data rows to the specified format. */
  export(name: string, data: Record<string, any>[], config: ExportConfig): ExportJob {
    const job: ExportJob = {
      id: `export-${++this.idCounter}`,
      name, config,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }

    try {
      let rows = [...data]

      // Apply filters
      if (config.filters) {
        for (const [key, value] of Object.entries(config.filters)) {
          rows = rows.filter(r => r[key] === value)
        }
      }

      // Sort
      if (config.sortBy) {
        const order = config.sortOrder === 'desc' ? -1 : 1
        rows.sort((a, b) => {
          if (a[config.sortBy!] < b[config.sortBy!]) return -1 * order
          if (a[config.sortBy!] > b[config.sortBy!]) return 1 * order
          return 0
        })
      }

      // Limit
      if (config.limit) rows = rows.slice(0, config.limit)

      // Select columns
      const columns = config.columns || (rows.length > 0 ? Object.keys(rows[0]) : [])

      // Format
      let result: string
      switch (config.format) {
        case 'csv': result = this.toCsv(rows, columns, config.includeHeaders !== false); break
        case 'tsv': result = this.toTsv(rows, columns, config.includeHeaders !== false); break
        case 'json': result = this.toJson(rows, columns); break
        case 'markdown': result = this.toMarkdown(rows, columns); break
        default: result = this.toCsv(rows, columns)
      }

      job.status = 'completed'
      job.completedAt = new Date().toISOString()
      job.result = result
      job.rowCount = rows.length
    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
    }

    this.jobs.set(job.id, job)
    return job
  }

  // ── Job Management ─────────────────────────────────────────

  getJob(id: string): ExportJob | undefined {
    return this.jobs.get(id)
  }

  getJobs(): ExportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  removeJob(id: string): boolean {
    return this.jobs.delete(id)
  }

  get jobCount(): number { return this.jobs.size }

  // ── Scheduled Exports ──────────────────────────────────────

  createSchedule(name: string, config: ExportConfig, schedule: 'daily' | 'weekly' | 'monthly'): ScheduledExport {
    const s: ScheduledExport = {
      id: `sched-${++this.idCounter}`,
      name, config, schedule, enabled: true,
      nextRun: this.computeNextRun(schedule),
    }
    this.schedules.set(s.id, s)
    return s
  }

  getSchedules(): ScheduledExport[] {
    return Array.from(this.schedules.values())
  }

  getSchedule(id: string): ScheduledExport | undefined {
    return this.schedules.get(id)
  }

  enableSchedule(id: string, enabled: boolean): boolean {
    const s = this.schedules.get(id)
    if (!s) return false
    s.enabled = enabled
    return true
  }

  removeSchedule(id: string): boolean {
    return this.schedules.delete(id)
  }

  /** Mark a scheduled export as run and compute next run. */
  markScheduleRun(id: string): boolean {
    const s = this.schedules.get(id)
    if (!s) return false
    s.lastRun = new Date().toISOString()
    s.nextRun = this.computeNextRun(s.schedule)
    return true
  }

  /** Get schedules that are due to run. */
  getDueSchedules(): ScheduledExport[] {
    const now = new Date().toISOString()
    return this.getSchedules().filter(s => s.enabled && s.nextRun <= now)
  }

  // ── Format Helpers ─────────────────────────────────────────

  private toCsv(rows: Record<string, any>[], columns: string[], headers: boolean = true): string {
    const lines: string[] = []
    if (headers) lines.push(columns.join(','))
    for (const row of rows) {
      lines.push(columns.map(c => this.escapeCsv(String(row[c] ?? ''))).join(','))
    }
    return lines.join('\n')
  }

  private toTsv(rows: Record<string, any>[], columns: string[], headers: boolean = true): string {
    const lines: string[] = []
    if (headers) lines.push(columns.join('\t'))
    for (const row of rows) {
      lines.push(columns.map(c => String(row[c] ?? '')).join('\t'))
    }
    return lines.join('\n')
  }

  private toJson(rows: Record<string, any>[], columns: string[]): string {
    const filtered = rows.map(row => {
      const obj: Record<string, any> = {}
      for (const c of columns) obj[c] = row[c]
      return obj
    })
    return JSON.stringify(filtered, null, 2)
  }

  private toMarkdown(rows: Record<string, any>[], columns: string[]): string {
    const lines: string[] = []
    lines.push('| ' + columns.join(' | ') + ' |')
    lines.push('| ' + columns.map(() => '---').join(' | ') + ' |')
    for (const row of rows) {
      lines.push('| ' + columns.map(c => String(row[c] ?? '')).join(' | ') + ' |')
    }
    return lines.join('\n')
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  private computeNextRun(schedule: string): string {
    const now = new Date()
    if (schedule === 'daily') now.setDate(now.getDate() + 1)
    else if (schedule === 'weekly') now.setDate(now.getDate() + 7)
    else now.setMonth(now.getMonth() + 1)
    now.setHours(6, 0, 0, 0)
    return now.toISOString()
  }
}

export const dataExportService = new DataExportService()
