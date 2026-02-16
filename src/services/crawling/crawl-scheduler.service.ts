/**
 * Crawl Scheduler Service.
 *
 * Manages scheduled crawling tasks with:
 *   - Cron-like scheduling (interval-based)
 *   - Priority queue for crawl jobs
 *   - Concurrency control
 *   - Retry with exponential backoff
 *   - Job history and stats
 */

export type CrawlFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'
export type JobStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'paused'
export type JobPriority = 'critical' | 'high' | 'normal' | 'low'

export interface ScheduledJob {
  id: string
  sourceId: string
  name: string
  frequency: CrawlFrequency
  /** Custom interval in ms (used when frequency = 'custom'). */
  customIntervalMs?: number
  priority: JobPriority
  status: JobStatus
  maxRetries: number
  retryCount: number
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
  metadata?: Record<string, any>
}

export interface JobExecution {
  jobId: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failure'
  duration: number
  documentsFound: number
  errors: string[]
}

export type CrawlExecutorFn = (sourceId: string) => Promise<{ documents: number; errors: string[] }>

const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

export class CrawlSchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map()
  private history: JobExecution[] = []
  private executor: CrawlExecutorFn | null = null
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private maxConcurrent: number = 3
  private runningCount: number = 0
  private idCounter = 0

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent
  }

  /** Set the crawl executor function. */
  setExecutor(fn: CrawlExecutorFn): void {
    this.executor = fn
  }

  /** Set max concurrent jobs. */
  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n
  }

  // ── Job Management ─────────────────────────────────────────

  /** Schedule a new crawl job. */
  schedule(job: Omit<ScheduledJob, 'status' | 'retryCount' | 'createdAt' | 'nextRunAt'>): ScheduledJob {
    const intervalMs = job.frequency === 'custom'
      ? (job.customIntervalMs || FREQUENCY_MS.daily)
      : FREQUENCY_MS[job.frequency]

    const scheduled: ScheduledJob = {
      ...job,
      status: 'scheduled',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
    }

    this.jobs.set(scheduled.id, scheduled)
    return scheduled
  }

  /** Get a job. */
  getJob(id: string): ScheduledJob | undefined {
    return this.jobs.get(id)
  }

  /** List all jobs. */
  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values())
  }

  /** Get jobs sorted by priority (highest first). */
  getJobsByPriority(): ScheduledJob[] {
    return this.getJobs().sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority])
  }

  /** Pause a job. */
  pauseJob(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job || job.status === 'running') return false
    job.status = 'paused'
    const timer = this.timers.get(id)
    if (timer) { clearTimeout(timer); this.timers.delete(id) }
    return true
  }

  /** Resume a paused job. */
  resumeJob(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job || job.status !== 'paused') return false
    job.status = 'scheduled'
    return true
  }

  /** Remove a job. */
  removeJob(id: string): boolean {
    const timer = this.timers.get(id)
    if (timer) { clearTimeout(timer); this.timers.delete(id) }
    return this.jobs.delete(id)
  }

  // ── Execution ──────────────────────────────────────────────

  /** Run a specific job immediately. */
  async runJob(id: string): Promise<JobExecution> {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`Job not found: ${id}`)
    if (!this.executor) throw new Error('No executor configured')

    job.status = 'running'
    this.runningCount++
    const startTime = Date.now()

    const execution: JobExecution = {
      jobId: id,
      startedAt: new Date().toISOString(),
      status: 'success',
      duration: 0,
      documentsFound: 0,
      errors: [],
    }

    try {
      const result = await this.executor(job.sourceId)
      execution.documentsFound = result.documents
      execution.errors = result.errors
      execution.status = result.errors.length === 0 ? 'success' : 'success' // partial success

      job.status = 'completed'
      job.retryCount = 0
      job.lastRunAt = new Date().toISOString()

      // Schedule next run
      this.scheduleNextRun(job)
    } catch (err) {
      execution.status = 'failure'
      execution.errors.push(err instanceof Error ? err.message : String(err))

      job.retryCount++
      if (job.retryCount < job.maxRetries) {
        job.status = 'scheduled'
        // Exponential backoff for retry
        const backoff = Math.min(1000 * Math.pow(2, job.retryCount), 60000)
        job.nextRunAt = new Date(Date.now() + backoff).toISOString()
      } else {
        job.status = 'failed'
      }
    } finally {
      this.runningCount--
      execution.duration = Date.now() - startTime
      execution.completedAt = new Date().toISOString()
      this.history.push(execution)
    }

    return execution
  }

  /** Run all due jobs respecting concurrency and priority. */
  async runDueJobs(): Promise<JobExecution[]> {
    const now = Date.now()
    const dueJobs = this.getJobsByPriority().filter(j =>
      j.status === 'scheduled' && j.nextRunAt && new Date(j.nextRunAt).getTime() <= now
    )

    const executions: JobExecution[] = []
    for (const job of dueJobs) {
      if (this.runningCount >= this.maxConcurrent) break
      executions.push(await this.runJob(job.id))
    }

    return executions
  }

  /** Get the pending queue (scheduled jobs sorted by priority then nextRunAt). */
  getQueue(): ScheduledJob[] {
    return this.getJobs()
      .filter(j => j.status === 'scheduled')
      .sort((a, b) => {
        const pDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
        if (pDiff !== 0) return pDiff
        return (new Date(a.nextRunAt || 0).getTime()) - (new Date(b.nextRunAt || 0).getTime())
      })
  }

  // ── History & Stats ────────────────────────────────────────

  /** Get execution history. */
  getHistory(jobId?: string): JobExecution[] {
    if (jobId) return this.history.filter(h => h.jobId === jobId)
    return [...this.history]
  }

  /** Get stats summary. */
  getStats(): {
    totalJobs: number
    scheduled: number
    running: number
    completed: number
    failed: number
    paused: number
    totalExecutions: number
    successRate: number
    avgDuration: number
  } {
    const jobs = this.getJobs()
    const execs = this.history

    return {
      totalJobs: jobs.length,
      scheduled: jobs.filter(j => j.status === 'scheduled').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      paused: jobs.filter(j => j.status === 'paused').length,
      totalExecutions: execs.length,
      successRate: execs.length > 0
        ? execs.filter(e => e.status === 'success').length / execs.length
        : 0,
      avgDuration: execs.length > 0
        ? execs.reduce((s, e) => s + e.duration, 0) / execs.length
        : 0,
    }
  }

  /** Get running job count. */
  get activeCount(): number {
    return this.runningCount
  }

  /** Destroy all timers. */
  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  // ── Internal ───────────────────────────────────────────────

  private scheduleNextRun(job: ScheduledJob): void {
    const intervalMs = job.frequency === 'custom'
      ? (job.customIntervalMs || FREQUENCY_MS.daily)
      : FREQUENCY_MS[job.frequency]

    job.nextRunAt = new Date(Date.now() + intervalMs).toISOString()
    job.status = 'scheduled'
  }
}

export const crawlSchedulerService = new CrawlSchedulerService()
