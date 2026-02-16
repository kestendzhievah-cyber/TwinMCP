import { PromptVersioningService } from '../../src/services/llm/prompt-versioning.service'

describe('PromptVersioningService', () => {
  let service: PromptVersioningService

  beforeEach(() => {
    service = new PromptVersioningService()
  })

  describe('Template management', () => {
    it('creates and retrieves templates', () => {
      const t = service.createTemplate('t1', 'Chat Prompt', 'Main chat template')
      expect(t.id).toBe('t1')
      expect(t.currentVersion).toBe('0.0.0')
      expect(service.getTemplates().length).toBe(1)
    })

    it('gets template by ID', () => {
      service.createTemplate('t1', 'Test')
      expect(service.getTemplate('t1')?.name).toBe('Test')
    })

    it('removes template and its versions', () => {
      service.createTemplate('t1', 'Test')
      service.createVersion('t1', 'Hello {{name}}', ['name'], 'patch')
      expect(service.removeTemplate('t1')).toBe(true)
      expect(service.getTemplates().length).toBe(0)
    })
  })

  describe('Version management', () => {
    beforeEach(() => {
      service.createTemplate('t1', 'Chat Prompt')
    })

    it('creates a patch version', () => {
      const v = service.createVersion('t1', 'Hello {{name}}', ['name'], 'patch', 'Initial version')
      expect(v).not.toBeNull()
      expect(v!.version).toBe('0.0.1')
      expect(v!.status).toBe('draft')
    })

    it('creates minor and major versions', () => {
      service.createVersion('t1', 'v1', ['name'], 'patch')
      const minor = service.createVersion('t1', 'v2', ['name', 'context'], 'minor')
      expect(minor!.version).toBe('0.1.0')

      const major = service.createVersion('t1', 'v3', ['name', 'context', 'history'], 'major')
      expect(major!.version).toBe('1.0.0')
    })

    it('returns null for unknown template', () => {
      expect(service.createVersion('unknown', 'content', [], 'patch')).toBeNull()
    })

    it('gets a specific version', () => {
      service.createVersion('t1', 'Hello {{name}}', ['name'], 'patch')
      const v = service.getVersion('t1', '0.0.1')
      expect(v?.content).toBe('Hello {{name}}')
    })

    it('lists all versions', () => {
      service.createVersion('t1', 'v1', [], 'patch')
      service.createVersion('t1', 'v2', [], 'patch')
      service.createVersion('t1', 'v3', [], 'minor')
      expect(service.getVersions('t1').length).toBe(3)
    })
  })

  describe('Publish workflow', () => {
    beforeEach(() => {
      service.createTemplate('t1', 'Chat Prompt')
      service.createVersion('t1', 'Draft v1', ['name'], 'patch')
    })

    it('publishes a version', () => {
      expect(service.publishVersion('t1', '0.0.1')).toBe(true)
      const v = service.getVersion('t1', '0.0.1')
      expect(v!.status).toBe('published')
      expect(v!.publishedAt).toBeDefined()
      expect(service.getTemplate('t1')!.currentVersion).toBe('0.0.1')
    })

    it('archives previous version on publish', () => {
      service.publishVersion('t1', '0.0.1')
      service.createVersion('t1', 'Draft v2', ['name'], 'patch')
      service.publishVersion('t1', '0.0.2')

      expect(service.getVersion('t1', '0.0.1')!.status).toBe('archived')
      expect(service.getVersion('t1', '0.0.2')!.status).toBe('published')
    })

    it('gets current published version', () => {
      service.publishVersion('t1', '0.0.1')
      const current = service.getCurrentVersion('t1')
      expect(current?.version).toBe('0.0.1')
    })

    it('returns undefined when no version published', () => {
      expect(service.getCurrentVersion('t1')).toBeUndefined()
    })
  })

  describe('Rollback', () => {
    beforeEach(() => {
      service.createTemplate('t1', 'Chat Prompt')
      service.createVersion('t1', 'v1 content', ['name'], 'patch')
      service.publishVersion('t1', '0.0.1')
      service.createVersion('t1', 'v2 content', ['name', 'context'], 'minor')
      service.publishVersion('t1', '0.1.0')
    })

    it('rolls back to a previous version', () => {
      expect(service.rollback('t1', '0.0.1')).toBe(true)
      expect(service.getTemplate('t1')!.currentVersion).toBe('0.0.1')
      expect(service.getVersion('t1', '0.0.1')!.status).toBe('rollback')
      expect(service.getVersion('t1', '0.1.0')!.status).toBe('archived')
    })

    it('returns false for unknown version', () => {
      expect(service.rollback('t1', '9.9.9')).toBe(false)
    })
  })

  describe('Diff', () => {
    beforeEach(() => {
      service.createTemplate('t1', 'Chat Prompt')
      service.createVersion('t1', 'Hello {{name}}\nWelcome!', ['name'], 'patch')
      service.createVersion('t1', 'Hello {{name}}\nWelcome to {{app}}!\nEnjoy.', ['name', 'app'], 'minor')
    })

    it('computes diff between versions', () => {
      const d = service.diff('t1', '0.0.1', '0.1.0')
      expect(d).not.toBeNull()
      expect(d!.addedLines).toBeGreaterThan(0)
      expect(d!.changedVariables.added).toContain('app')
    })

    it('detects removed variables', () => {
      service.createVersion('t1', 'Hello!\nSimple.', [], 'major')
      const d = service.diff('t1', '0.1.0', '1.0.0')
      expect(d!.changedVariables.removed).toContain('name')
      expect(d!.changedVariables.removed).toContain('app')
    })

    it('returns null for unknown versions', () => {
      expect(service.diff('t1', '0.0.1', '9.9.9')).toBeNull()
    })

    it('shows no changes for identical content', () => {
      service.createVersion('t1', 'Hello {{name}}\nWelcome to {{app}}!\nEnjoy.', ['name', 'app'], 'patch')
      const d = service.diff('t1', '0.1.0', '0.1.1')
      expect(d!.addedLines).toBe(0)
      expect(d!.removedLines).toBe(0)
      expect(d!.contentDiff).toBe('No changes')
    })
  })

  describe('Metrics', () => {
    beforeEach(() => {
      service.createTemplate('t1', 'Chat Prompt')
      service.createVersion('t1', 'v1', [], 'patch')
      service.publishVersion('t1', '0.0.1')
    })

    it('records and aggregates metrics', () => {
      service.recordMetrics('t1', '0.0.1', 0.9, 200, 0.01)
      service.recordMetrics('t1', '0.0.1', 0.8, 300, 0.02)

      const v = service.getVersion('t1', '0.0.1')!
      expect(v.metrics!.usageCount).toBe(2)
      expect(v.metrics!.avgQuality).toBeCloseTo(0.85)
      expect(v.metrics!.avgLatency).toBeCloseTo(250)
      expect(v.metrics!.avgCost).toBeCloseTo(0.015)
    })

    it('tracks error rate', () => {
      service.recordMetrics('t1', '0.0.1', 0.9, 200, 0.01, false)
      service.recordMetrics('t1', '0.0.1', 0.0, 500, 0.01, true)

      expect(service.getVersion('t1', '0.0.1')!.metrics!.errorRate).toBeCloseTo(0.5)
    })

    it('compares metrics between versions', () => {
      service.createVersion('t1', 'v2', [], 'patch')
      service.recordMetrics('t1', '0.0.1', 0.9, 200, 0.01)
      service.recordMetrics('t1', '0.0.2', 0.95, 150, 0.008)

      const comparison = service.compareMetrics('t1', '0.0.1', '0.0.2')
      expect(comparison.a).not.toBeNull()
      expect(comparison.b).not.toBeNull()
      expect(comparison.b!.avgQuality).toBeGreaterThan(comparison.a!.avgQuality)
    })
  })
})
