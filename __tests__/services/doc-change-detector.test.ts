import { DocChangeDetectorService } from '../../src/services/crawling/doc-change-detector.service'

describe('DocChangeDetectorService', () => {
  let service: DocChangeDetectorService

  beforeEach(() => {
    service = new DocChangeDetectorService()
  })

  describe('Snapshot management', () => {
    it('takes a snapshot', () => {
      const snap = service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nWorld')
      expect(snap.id).toBeDefined()
      expect(snap.version).toBe(1)
      expect(snap.sections.length).toBeGreaterThan(0)
    })

    it('increments version on each snapshot', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', 'v1')
      const snap2 = service.takeSnapshot('src1', 'https://docs.example.com', 'v2')
      expect(snap2.version).toBe(2)
    })

    it('gets latest snapshot', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', 'v1')
      service.takeSnapshot('src1', 'https://docs.example.com', 'v2')
      expect(service.getLatestSnapshot('src1')?.version).toBe(2)
    })

    it('returns undefined for unknown source', () => {
      expect(service.getLatestSnapshot('unknown')).toBeUndefined()
    })

    it('lists all snapshots for a source', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', 'v1')
      service.takeSnapshot('src1', 'https://docs.example.com', 'v2')
      expect(service.getSnapshots('src1').length).toBe(2)
    })

    it('tracks total snapshot count', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', 'v1')
      service.takeSnapshot('src2', 'https://other.com', 'v1')
      expect(service.totalSnapshots).toBe(2)
    })
  })

  describe('Change detection', () => {
    it('detects no change when content is identical', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nWorld')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nWorld')
      expect(service.detectChanges('src1')).toBeNull()
    })

    it('detects content modification', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nOriginal content here')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nModified content here with more text')

      const change = service.detectChanges('src1')
      expect(change).not.toBeNull()
      expect(change!.changeType).toBe('modified')
      expect(change!.sections.length).toBeGreaterThan(0)
    })

    it('detects added sections', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello world')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello world\n\n# New Section\n\nNew content here')

      const change = service.detectChanges('src1')
      expect(change).not.toBeNull()
      const added = change!.sections.filter(s => s.changeType === 'added')
      expect(added.length).toBeGreaterThan(0)
    })

    it('detects removed sections', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello\n\n# Old Section\n\nOld content')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello')

      const change = service.detectChanges('src1')
      expect(change).not.toBeNull()
      const removed = change!.sections.filter(s => s.changeType === 'removed')
      expect(removed.length).toBeGreaterThan(0)
    })

    it('returns null with fewer than 2 snapshots', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', 'content')
      expect(service.detectChanges('src1')).toBeNull()
    })

    it('returns null for unknown source', () => {
      expect(service.detectChanges('unknown')).toBeNull()
    })
  })

  describe('checkForChanges', () => {
    it('creates first snapshot without detecting change', () => {
      const change = service.checkForChanges('src1', 'https://docs.example.com', '# Hello\n\nWorld')
      expect(change).toBeNull()
      expect(service.totalSnapshots).toBe(1)
    })

    it('detects change on subsequent check', () => {
      service.checkForChanges('src1', 'https://docs.example.com', '# Hello\n\nOriginal')
      const change = service.checkForChanges('src1', 'https://docs.example.com', '# Hello\n\nModified content')
      expect(change).not.toBeNull()
      expect(service.totalSnapshots).toBe(2)
    })

    it('returns null when content unchanged', () => {
      service.checkForChanges('src1', 'https://docs.example.com', '# Hello\n\nSame')
      const change = service.checkForChanges('src1', 'https://docs.example.com', '# Hello\n\nSame')
      expect(change).toBeNull()
      expect(service.totalSnapshots).toBe(1) // no new snapshot
    })
  })

  describe('Severity classification', () => {
    it('classifies major changes (sections added/removed)', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# A\n\nContent A')
      service.takeSnapshot('src1', 'https://docs.example.com', '# A\n\nContent A\n\n# B\n\nContent B')

      const change = service.detectChanges('src1')
      expect(change!.severity).toBe('major')
    })

    it('classifies minor changes (moderate content change)', () => {
      const base = '# Intro\n\n' + 'word '.repeat(100)
      const modified = '# Intro\n\n' + 'word '.repeat(100) + 'extra '.repeat(20)

      service.takeSnapshot('src1', 'https://docs.example.com', base)
      service.takeSnapshot('src1', 'https://docs.example.com', modified)

      const change = service.detectChanges('src1')
      expect(change).not.toBeNull()
      expect(['minor', 'patch']).toContain(change!.severity)
    })
  })

  describe('Notifications', () => {
    it('triggers notification callbacks on change', () => {
      const notifications: any[] = []
      service.onChange(change => notifications.push(change))

      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nOriginal')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Hello\n\nChanged content')
      service.detectChanges('src1')

      expect(notifications.length).toBe(1)
    })
  })

  describe('Change history', () => {
    it('stores detected changes', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# A\n\nV1')
      service.takeSnapshot('src1', 'https://docs.example.com', '# A\n\nV2')
      service.detectChanges('src1')

      expect(service.getChanges().length).toBe(1)
      expect(service.getChanges('src1').length).toBe(1)
      expect(service.changeCount).toBe(1)
    })
  })

  describe('Summary generation', () => {
    it('generates a human-readable summary', () => {
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello')
      service.takeSnapshot('src1', 'https://docs.example.com', '# Intro\n\nHello\n\n# New\n\nNew section')

      const change = service.detectChanges('src1')
      expect(change!.summary).toContain('added')
    })
  })
})
