import { CrawlSchedulerService } from '../../src/services/crawling/crawl-scheduler.service'

describe('CrawlSchedulerService', () => {
  let service: CrawlSchedulerService

  beforeEach(() => {
    service = new CrawlSchedulerService(3)
  })

  afterEach(() => {
    service.destroy()
  })

  describe('Job management', () => {
    it('schedules a job', () => {
      const job = service.schedule({
        id: 'j1', sourceId: 'src1', name: 'Daily React Docs',
        frequency: 'daily', priority: 'normal', maxRetries: 3,
      })
      expect(job.status).toBe('scheduled')
      expect(job.nextRunAt).toBeDefined()
      expect(service.getJobs().length).toBe(1)
    })

    it('gets a job by ID', () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      expect(service.getJob('j1')?.name).toBe('Test')
    })

    it('removes a job', () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      expect(service.removeJob('j1')).toBe(true)
      expect(service.getJobs().length).toBe(0)
    })

    it('pauses and resumes a job', () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      expect(service.pauseJob('j1')).toBe(true)
      expect(service.getJob('j1')!.status).toBe('paused')

      expect(service.resumeJob('j1')).toBe(true)
      expect(service.getJob('j1')!.status).toBe('scheduled')
    })

    it('cannot pause a running job', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      service.setExecutor(async () => {
        // Simulate long-running job
        await new Promise(r => setTimeout(r, 100))
        return { documents: 1, errors: [] }
      })
      const promise = service.runJob('j1')
      expect(service.pauseJob('j1')).toBe(false) // running
      await promise
    })

    it('cannot resume a non-paused job', () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      expect(service.resumeJob('j1')).toBe(false)
    })
  })

  describe('Priority ordering', () => {
    it('sorts jobs by priority', () => {
      service.schedule({ id: 'j1', sourceId: 's1', name: 'Low', frequency: 'daily', priority: 'low', maxRetries: 1 })
      service.schedule({ id: 'j2', sourceId: 's2', name: 'Critical', frequency: 'daily', priority: 'critical', maxRetries: 1 })
      service.schedule({ id: 'j3', sourceId: 's3', name: 'High', frequency: 'daily', priority: 'high', maxRetries: 1 })

      const sorted = service.getJobsByPriority()
      expect(sorted[0].priority).toBe('critical')
      expect(sorted[1].priority).toBe('high')
      expect(sorted[2].priority).toBe('low')
    })
  })

  describe('Execution', () => {
    it('runs a job successfully', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      service.setExecutor(async () => ({ documents: 5, errors: [] }))

      const exec = await service.runJob('j1')
      expect(exec.status).toBe('success')
      expect(exec.documentsFound).toBe(5)
      expect(exec.duration).toBeGreaterThanOrEqual(0)
      expect(service.getJob('j1')!.status).toBe('scheduled') // rescheduled
    })

    it('handles job failure with retry', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      service.setExecutor(async () => { throw new Error('Network error') })

      const exec = await service.runJob('j1')
      expect(exec.status).toBe('failure')
      expect(service.getJob('j1')!.retryCount).toBe(1)
      expect(service.getJob('j1')!.status).toBe('scheduled') // will retry
    })

    it('marks job as failed after max retries', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 2 })
      service.setExecutor(async () => { throw new Error('fail') })

      await service.runJob('j1')
      await service.runJob('j1')
      expect(service.getJob('j1')!.status).toBe('failed')
    })

    it('throws for unknown job', async () => {
      await expect(service.runJob('unknown')).rejects.toThrow('Job not found')
    })

    it('throws without executor', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 1 })
      await expect(service.runJob('j1')).rejects.toThrow('No executor')
    })
  })

  describe('Queue', () => {
    it('returns pending queue sorted by priority', () => {
      service.schedule({ id: 'j1', sourceId: 's1', name: 'Low', frequency: 'daily', priority: 'low', maxRetries: 1 })
      service.schedule({ id: 'j2', sourceId: 's2', name: 'High', frequency: 'daily', priority: 'high', maxRetries: 1 })

      const queue = service.getQueue()
      expect(queue[0].priority).toBe('high')
    })
  })

  describe('History & Stats', () => {
    it('records execution history', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      service.setExecutor(async () => ({ documents: 3, errors: [] }))

      await service.runJob('j1')
      await service.runJob('j1')

      expect(service.getHistory().length).toBe(2)
      expect(service.getHistory('j1').length).toBe(2)
    })

    it('computes stats', async () => {
      service.schedule({ id: 'j1', sourceId: 'src1', name: 'Test', frequency: 'daily', priority: 'normal', maxRetries: 3 })
      service.setExecutor(async () => ({ documents: 3, errors: [] }))
      await service.runJob('j1')

      const stats = service.getStats()
      expect(stats.totalJobs).toBe(1)
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successRate).toBe(1)
      expect(stats.avgDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Custom frequency', () => {
    it('supports custom interval', () => {
      const job = service.schedule({
        id: 'j1', sourceId: 'src1', name: 'Custom',
        frequency: 'custom', customIntervalMs: 5000,
        priority: 'normal', maxRetries: 1,
      })
      expect(job.frequency).toBe('custom')
      expect(job.customIntervalMs).toBe(5000)
    })
  })
})
