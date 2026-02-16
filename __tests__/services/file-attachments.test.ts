import { FileAttachmentsService } from '../../src/services/chat/file-attachments.service'

describe('FileAttachmentsService', () => {
  let service: FileAttachmentsService

  beforeEach(() => {
    service = new FileAttachmentsService()
  })

  describe('Config', () => {
    it('gets and sets config', () => {
      expect(service.getConfig().maxFileSize).toBe(10 * 1024 * 1024)
      service.setConfig({ maxFileSize: 5 * 1024 * 1024 })
      expect(service.getConfig().maxFileSize).toBe(5 * 1024 * 1024)
    })
  })

  describe('Upload', () => {
    it('uploads a valid file', () => {
      const result = service.upload(
        { name: 'photo.jpg', mimeType: 'image/jpeg', size: 1024, url: '/uploads/photo.jpg' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(true)
      expect(result.attachment?.category).toBe('image')
      expect(result.attachment?.name).toBe('photo.jpg')
    })

    it('rejects oversized files', () => {
      const result = service.upload(
        { name: 'huge.zip', mimeType: 'application/zip', size: 20 * 1024 * 1024, url: '/uploads/huge.zip' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('rejects disallowed MIME types', () => {
      const result = service.upload(
        { name: 'app.exe', mimeType: 'application/x-executable', size: 1024, url: '/uploads/app.exe' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('rejects disallowed extensions', () => {
      const result = service.upload(
        { name: 'script.bat', mimeType: 'text/plain', size: 100, url: '/uploads/script.bat' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('extension not allowed')
    })

    it('enforces max files per message', () => {
      for (let i = 0; i < 5; i++) {
        service.upload(
          { name: `file${i}.txt`, mimeType: 'text/plain', size: 100, url: `/uploads/file${i}.txt` },
          'msg-1', 'conv-1', 'user-1'
        )
      }
      const result = service.upload(
        { name: 'file6.txt', mimeType: 'text/plain', size: 100, url: '/uploads/file6.txt' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('Max files')
    })

    it('enforces conversation total size', () => {
      service.setConfig({ maxTotalSize: 2000 })
      service.upload(
        { name: 'big.txt', mimeType: 'text/plain', size: 1500, url: '/uploads/big.txt' },
        'msg-1', 'conv-1', 'user-1'
      )
      const result = service.upload(
        { name: 'big2.txt', mimeType: 'text/plain', size: 1000, url: '/uploads/big2.txt' },
        'msg-2', 'conv-1', 'user-1'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('limit exceeded')
    })

    it('sanitizes filenames', () => {
      const result = service.upload(
        { name: 'my file (1).txt', mimeType: 'text/plain', size: 100, url: '/uploads/test.txt' },
        'msg-1', 'conv-1', 'user-1'
      )
      expect(result.attachment?.name).not.toContain(' ')
      expect(result.attachment?.originalName).toBe('my file (1).txt')
    })
  })

  describe('Retrieval', () => {
    beforeEach(() => {
      service.upload({ name: 'a.jpg', mimeType: 'image/jpeg', size: 1000, url: '/a.jpg' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'b.pdf', mimeType: 'application/pdf', size: 2000, url: '/b.pdf' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'c.ts', mimeType: 'application/typescript', size: 500, url: '/c.ts' }, 'msg-2', 'conv-1', 'user-1')
      service.upload({ name: 'd.png', mimeType: 'image/png', size: 3000, url: '/d.png' }, 'msg-3', 'conv-2', 'user-2')
    })

    it('gets by ID', () => {
      const all = service.getAll()
      expect(service.get(all[0].id)).toBeDefined()
    })

    it('gets message attachments', () => {
      expect(service.getMessageAttachments('msg-1').length).toBe(2)
    })

    it('gets conversation attachments', () => {
      expect(service.getConversationAttachments('conv-1').length).toBe(3)
    })

    it('counts total', () => {
      expect(service.totalCount).toBe(4)
    })
  })

  describe('Deletion', () => {
    it('removes by ID', () => {
      service.upload({ name: 'a.txt', mimeType: 'text/plain', size: 100, url: '/a.txt' }, 'msg-1', 'conv-1', 'user-1')
      const att = service.getAll()[0]
      expect(service.remove(att.id)).toBe(true)
      expect(service.totalCount).toBe(0)
    })

    it('removes all message attachments', () => {
      service.upload({ name: 'a.txt', mimeType: 'text/plain', size: 100, url: '/a.txt' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'b.txt', mimeType: 'text/plain', size: 100, url: '/b.txt' }, 'msg-1', 'conv-1', 'user-1')
      expect(service.removeMessageAttachments('msg-1')).toBe(2)
    })
  })

  describe('Search', () => {
    beforeEach(() => {
      service.upload({ name: 'react-guide.pdf', mimeType: 'application/pdf', size: 1000, url: '/r.pdf' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'photo.jpg', mimeType: 'image/jpeg', size: 2000, url: '/p.jpg' }, 'msg-2', 'conv-1', 'user-1')
      service.upload({ name: 'code.ts', mimeType: 'text/plain', size: 500, url: '/c.ts' }, 'msg-3', 'conv-2', 'user-1')
    })

    it('searches by name', () => {
      const results = service.search('react')
      expect(results.length).toBe(1)
    })

    it('searches within conversation', () => {
      const results = service.search('', 'conv-1')
      // empty string matches all via String.includes('')
      expect(results.length).toBe(2) // only 2 files in conv-1
    })

    it('searches by category', () => {
      const images = service.searchByCategory('image')
      expect(images.length).toBe(1)
    })
  })

  describe('Categorization', () => {
    it('categorizes images', () => {
      expect(service.categorize('image/jpeg')).toBe('image')
      expect(service.categorize('image/png')).toBe('image')
    })

    it('categorizes audio', () => {
      expect(service.categorize('audio/mpeg')).toBe('audio')
    })

    it('categorizes video', () => {
      expect(service.categorize('video/mp4')).toBe('video')
    })

    it('categorizes archives', () => {
      expect(service.categorize('application/zip')).toBe('archive')
    })

    it('categorizes code', () => {
      expect(service.categorize('text/plain')).toBe('code')
      expect(service.categorize('application/json')).toBe('code')
    })

    it('categorizes documents', () => {
      expect(service.categorize('application/pdf')).toBe('document')
    })
  })

  describe('Helpers', () => {
    it('checks previewable types', () => {
      expect(service.isPreviewable('image/jpeg')).toBe(true)
      expect(service.isPreviewable('application/pdf')).toBe(true)
      expect(service.isPreviewable('text/plain')).toBe(true)
      expect(service.isPreviewable('application/zip')).toBe(false)
    })

    it('formats file sizes', () => {
      expect(service.formatSize(500)).toBe('500 B')
      expect(service.formatSize(1536)).toBe('1.5 KB')
      expect(service.formatSize(2 * 1024 * 1024)).toBe('2.0 MB')
    })
  })

  describe('Stats', () => {
    it('computes stats', () => {
      service.upload({ name: 'a.jpg', mimeType: 'image/jpeg', size: 1000, url: '/a' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'b.pdf', mimeType: 'application/pdf', size: 2000, url: '/b' }, 'msg-1', 'conv-1', 'user-1')
      const stats = service.getStats()
      expect(stats.totalFiles).toBe(2)
      expect(stats.totalSize).toBe(3000)
      expect(stats.byCategory['image']).toBe(1)
      expect(stats.byCategory['document']).toBe(1)
    })

    it('computes stats per conversation', () => {
      service.upload({ name: 'a.jpg', mimeType: 'image/jpeg', size: 1000, url: '/a' }, 'msg-1', 'conv-1', 'user-1')
      service.upload({ name: 'b.jpg', mimeType: 'image/jpeg', size: 2000, url: '/b' }, 'msg-2', 'conv-2', 'user-1')
      const stats = service.getStats('conv-1')
      expect(stats.totalFiles).toBe(1)
    })
  })
})
