import { ConversationOrganizerService } from '../../src/services/chat/conversation-organizer.service'

describe('ConversationOrganizerService', () => {
  let service: ConversationOrganizerService

  beforeEach(() => {
    service = new ConversationOrganizerService()
  })

  describe('Folder management', () => {
    it('creates a folder', () => {
      const f = service.createFolder('Work', undefined, '📁', '#3b82f6')
      expect(f.name).toBe('Work')
      expect(f.icon).toBe('📁')
    })

    it('gets a folder by ID', () => {
      const f = service.createFolder('Work')
      expect(service.getFolder(f.id)?.name).toBe('Work')
    })

    it('lists all folders sorted', () => {
      service.createFolder('B')
      service.createFolder('A')
      expect(service.getFolders().length).toBe(2)
    })

    it('creates nested folders', () => {
      const parent = service.createFolder('Projects')
      const child = service.createFolder('Frontend', parent.id)
      expect(child.parentId).toBe(parent.id)
      expect(service.getSubfolders(parent.id).length).toBe(1)
    })

    it('gets root folders only', () => {
      const parent = service.createFolder('Root')
      service.createFolder('Child', parent.id)
      expect(service.getRootFolders().length).toBe(1)
    })

    it('renames a folder', () => {
      const f = service.createFolder('Old')
      expect(service.renameFolder(f.id, 'New')).toBe(true)
      expect(service.getFolder(f.id)!.name).toBe('New')
    })

    it('removes a folder and reparents children', () => {
      const parent = service.createFolder('Parent')
      const child = service.createFolder('Child', parent.id)
      service.removeFolder(parent.id)
      expect(service.getFolder(child.id)!.parentId).toBeUndefined()
    })

    it('moves a folder', () => {
      const a = service.createFolder('A')
      const b = service.createFolder('B')
      expect(service.moveFolder(b.id, a.id)).toBe(true)
      expect(service.getFolder(b.id)!.parentId).toBe(a.id)
    })

    it('prevents self-parenting', () => {
      const f = service.createFolder('Self')
      expect(service.moveFolder(f.id, f.id)).toBe(false)
    })

    it('builds folder tree', () => {
      const root = service.createFolder('Root')
      service.createFolder('Child1', root.id)
      service.createFolder('Child2', root.id)
      const tree = service.getFolderTree()
      expect(tree.length).toBe(1)
      expect(tree[0].children.length).toBe(2)
    })
  })

  describe('Tag management', () => {
    it('creates a tag', () => {
      const t = service.createTag('important', '#ef4444')
      expect(t.name).toBe('important')
      expect(t.color).toBe('#ef4444')
    })

    it('lists tags', () => {
      service.createTag('a')
      service.createTag('b')
      expect(service.getTags().length).toBe(2)
    })

    it('renames a tag', () => {
      const t = service.createTag('old')
      expect(service.renameTag(t.id, 'new')).toBe(true)
      expect(service.getTag(t.id)!.name).toBe('new')
    })

    it('removes a tag', () => {
      const t = service.createTag('temp')
      expect(service.removeTag(t.id)).toBe(true)
    })

    it('changes tag color', () => {
      const t = service.createTag('tag', '#000')
      service.setTagColor(t.id, '#fff')
      expect(service.getTag(t.id)!.color).toBe('#fff')
    })
  })

  describe('Assignment', () => {
    it('adds conversation to folder', () => {
      const f = service.createFolder('Work')
      expect(service.addToFolder('conv-1', f.id)).toBe(true)
      expect(service.getFolder(f.id)!.conversationIds).toContain('conv-1')
    })

    it('does not duplicate in folder', () => {
      const f = service.createFolder('Work')
      service.addToFolder('conv-1', f.id)
      service.addToFolder('conv-1', f.id)
      expect(service.getFolder(f.id)!.conversationIds.length).toBe(1)
    })

    it('removes from folder', () => {
      const f = service.createFolder('Work')
      service.addToFolder('conv-1', f.id)
      service.removeFromFolder('conv-1', f.id)
      expect(service.getFolder(f.id)!.conversationIds.length).toBe(0)
    })

    it('moves between folders', () => {
      const a = service.createFolder('A')
      const b = service.createFolder('B')
      service.addToFolder('conv-1', a.id)
      service.moveToFolder('conv-1', a.id, b.id)
      expect(service.getFolder(a.id)!.conversationIds.length).toBe(0)
      expect(service.getFolder(b.id)!.conversationIds).toContain('conv-1')
    })

    it('adds and removes tags', () => {
      const t = service.createTag('important')
      service.addTag('conv-1', t.id)
      expect(service.getConversationTags('conv-1').length).toBe(1)
      service.removeTagFromConversation('conv-1', t.id)
      expect(service.getConversationTags('conv-1').length).toBe(0)
    })

    it('gets conversation folder', () => {
      const f = service.createFolder('Work')
      service.addToFolder('conv-1', f.id)
      expect(service.getConversationFolder('conv-1')?.id).toBe(f.id)
    })
  })

  describe('Bulk operations', () => {
    it('bulk adds to folder', () => {
      const f = service.createFolder('Bulk')
      const count = service.bulkAddToFolder(['c1', 'c2', 'c3'], f.id)
      expect(count).toBe(3)
      expect(service.getFolder(f.id)!.conversationIds.length).toBe(3)
    })

    it('bulk adds tag', () => {
      const t = service.createTag('batch')
      const count = service.bulkAddTag(['c1', 'c2'], t.id)
      expect(count).toBe(2)
    })
  })

  describe('Auto-tagging', () => {
    it('suggests code tag', () => {
      expect(service.suggestTags('How to write a function in JavaScript')).toContain('code')
    })

    it('suggests api tag', () => {
      expect(service.suggestTags('REST API endpoint for fetching data')).toContain('api')
    })

    it('suggests multiple tags', () => {
      const tags = service.suggestTags('Deploy Docker container with database query')
      expect(tags).toContain('devops')
      expect(tags).toContain('database')
    })
  })

  describe('Stats', () => {
    it('computes organization stats', () => {
      const f = service.createFolder('Work')
      const t = service.createTag('important')
      service.addToFolder('c1', f.id)
      service.addTag('c2', t.id)

      const stats = service.getStats(['c1', 'c2', 'c3'])
      expect(stats.totalFolders).toBe(1)
      expect(stats.totalTags).toBe(1)
      expect(stats.unorganized).toBe(1)
    })
  })
})
