import { DataExportService } from '../../src/services/analytics/data-export.service'

describe('DataExportService', () => {
  let service: DataExportService
  const sampleData = [
    { name: 'Alice', age: 30, city: 'Paris' },
    { name: 'Bob', age: 25, city: 'London' },
    { name: 'Charlie', age: 35, city: 'Paris' },
  ]

  beforeEach(() => {
    service = new DataExportService()
  })

  describe('CSV export', () => {
    it('exports to CSV with headers', () => {
      const job = service.export('test', sampleData, { format: 'csv' })
      expect(job.status).toBe('completed')
      expect(job.result).toContain('name,age,city')
      expect(job.result).toContain('Alice,30,Paris')
      expect(job.rowCount).toBe(3)
    })

    it('exports without headers', () => {
      const job = service.export('test', sampleData, { format: 'csv', includeHeaders: false })
      expect(job.result!.split('\n')[0]).not.toContain('name')
    })

    it('selects specific columns', () => {
      const job = service.export('test', sampleData, { format: 'csv', columns: ['name', 'city'] })
      expect(job.result).toContain('name,city')
      expect(job.result).not.toContain('age')
    })

    it('escapes commas in values', () => {
      const data = [{ text: 'Hello, world', num: 1 }]
      const job = service.export('test', data, { format: 'csv' })
      expect(job.result).toContain('"Hello, world"')
    })
  })

  describe('TSV export', () => {
    it('exports to TSV', () => {
      const job = service.export('test', sampleData, { format: 'tsv' })
      expect(job.status).toBe('completed')
      expect(job.result).toContain('name\tage\tcity')
    })
  })

  describe('JSON export', () => {
    it('exports to JSON', () => {
      const job = service.export('test', sampleData, { format: 'json' })
      const parsed = JSON.parse(job.result!)
      expect(parsed.length).toBe(3)
      expect(parsed[0].name).toBe('Alice')
    })

    it('filters columns in JSON', () => {
      const job = service.export('test', sampleData, { format: 'json', columns: ['name'] })
      const parsed = JSON.parse(job.result!)
      expect(Object.keys(parsed[0])).toEqual(['name'])
    })
  })

  describe('Markdown export', () => {
    it('exports to Markdown table', () => {
      const job = service.export('test', sampleData, { format: 'markdown' })
      expect(job.result).toContain('| name | age | city |')
      expect(job.result).toContain('| --- | --- | --- |')
      expect(job.result).toContain('| Alice | 30 | Paris |')
    })
  })

  describe('Filtering and sorting', () => {
    it('filters data', () => {
      const job = service.export('test', sampleData, { format: 'json', filters: { city: 'Paris' } })
      const parsed = JSON.parse(job.result!)
      expect(parsed.length).toBe(2)
    })

    it('sorts ascending', () => {
      const job = service.export('test', sampleData, { format: 'json', sortBy: 'age', sortOrder: 'asc' })
      const parsed = JSON.parse(job.result!)
      expect(parsed[0].name).toBe('Bob')
    })

    it('sorts descending', () => {
      const job = service.export('test', sampleData, { format: 'json', sortBy: 'age', sortOrder: 'desc' })
      const parsed = JSON.parse(job.result!)
      expect(parsed[0].name).toBe('Charlie')
    })

    it('limits results', () => {
      const job = service.export('test', sampleData, { format: 'json', limit: 2 })
      const parsed = JSON.parse(job.result!)
      expect(parsed.length).toBe(2)
    })
  })

  describe('Job management', () => {
    it('retrieves jobs', () => {
      service.export('a', sampleData, { format: 'csv' })
      service.export('b', sampleData, { format: 'json' })
      expect(service.getJobs().length).toBe(2)
    })

    it('gets job by ID', () => {
      const job = service.export('test', sampleData, { format: 'csv' })
      expect(service.getJob(job.id)?.name).toBe('test')
    })

    it('removes a job', () => {
      const job = service.export('test', sampleData, { format: 'csv' })
      expect(service.removeJob(job.id)).toBe(true)
      expect(service.jobCount).toBe(0)
    })
  })

  describe('Scheduled exports', () => {
    it('creates a schedule', () => {
      const s = service.createSchedule('Daily report', { format: 'csv' }, 'daily')
      expect(s.enabled).toBe(true)
      expect(s.schedule).toBe('daily')
    })

    it('lists schedules', () => {
      service.createSchedule('A', { format: 'csv' }, 'daily')
      service.createSchedule('B', { format: 'json' }, 'weekly')
      expect(service.getSchedules().length).toBe(2)
    })

    it('enables/disables schedule', () => {
      const s = service.createSchedule('Test', { format: 'csv' }, 'daily')
      service.enableSchedule(s.id, false)
      expect(service.getSchedule(s.id)!.enabled).toBe(false)
    })

    it('marks schedule as run', () => {
      const s = service.createSchedule('Test', { format: 'csv' }, 'daily')
      expect(service.markScheduleRun(s.id)).toBe(true)
      expect(service.getSchedule(s.id)!.lastRun).toBeDefined()
    })

    it('removes a schedule', () => {
      const s = service.createSchedule('Test', { format: 'csv' }, 'daily')
      expect(service.removeSchedule(s.id)).toBe(true)
    })
  })
})
