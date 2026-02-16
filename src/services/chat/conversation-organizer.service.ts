/**
 * Conversation Organizer Service.
 *
 * Manages folders and tags for conversation organization:
 *   - Folder hierarchy (nested folders)
 *   - Tag management with colors
 *   - Conversation assignment to folders/tags
 *   - Bulk operations
 *   - Smart auto-tagging
 */

export interface ConversationFolder {
  id: string
  name: string
  parentId?: string
  icon?: string
  color?: string
  sortOrder: number
  conversationIds: string[]
  createdAt: string
}

export interface ConversationTag {
  id: string
  name: string
  color: string
  conversationIds: string[]
  createdAt: string
}

export interface OrganizationStats {
  totalFolders: number
  totalTags: number
  unorganized: number
  byFolder: Record<string, number>
  byTag: Record<string, number>
}

export class ConversationOrganizerService {
  private folders: Map<string, ConversationFolder> = new Map()
  private tags: Map<string, ConversationTag> = new Map()
  private idCounter = 0

  // ── Folder Management ──────────────────────────────────────

  createFolder(name: string, parentId?: string, icon?: string, color?: string): ConversationFolder {
    const folder: ConversationFolder = {
      id: `folder-${++this.idCounter}`,
      name, parentId, icon, color,
      sortOrder: this.folders.size,
      conversationIds: [],
      createdAt: new Date().toISOString(),
    }
    this.folders.set(folder.id, folder)
    return folder
  }

  getFolder(id: string): ConversationFolder | undefined {
    return this.folders.get(id)
  }

  getFolders(): ConversationFolder[] {
    return Array.from(this.folders.values()).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  getRootFolders(): ConversationFolder[] {
    return this.getFolders().filter(f => !f.parentId)
  }

  getSubfolders(parentId: string): ConversationFolder[] {
    return this.getFolders().filter(f => f.parentId === parentId)
  }

  renameFolder(id: string, name: string): boolean {
    const folder = this.folders.get(id)
    if (!folder) return false
    folder.name = name
    return true
  }

  removeFolder(id: string): boolean {
    // Move subfolders to parent
    const folder = this.folders.get(id)
    if (!folder) return false
    for (const sub of this.getSubfolders(id)) {
      sub.parentId = folder.parentId
    }
    return this.folders.delete(id)
  }

  moveFolder(id: string, newParentId?: string): boolean {
    const folder = this.folders.get(id)
    if (!folder) return false
    if (newParentId === id) return false // can't be own parent
    folder.parentId = newParentId
    return true
  }

  /** Get folder tree (nested structure). */
  getFolderTree(): Array<ConversationFolder & { children: ConversationFolder[] }> {
    const roots = this.getRootFolders()
    return roots.map(f => ({
      ...f,
      children: this.getSubfolders(f.id),
    }))
  }

  // ── Tag Management ─────────────────────────────────────────

  createTag(name: string, color: string = '#6b7280'): ConversationTag {
    const tag: ConversationTag = {
      id: `tag-${++this.idCounter}`,
      name, color,
      conversationIds: [],
      createdAt: new Date().toISOString(),
    }
    this.tags.set(tag.id, tag)
    return tag
  }

  getTag(id: string): ConversationTag | undefined {
    return this.tags.get(id)
  }

  getTags(): ConversationTag[] {
    return Array.from(this.tags.values())
  }

  renameTag(id: string, name: string): boolean {
    const tag = this.tags.get(id)
    if (!tag) return false
    tag.name = name
    return true
  }

  removeTag(id: string): boolean {
    return this.tags.delete(id)
  }

  setTagColor(id: string, color: string): boolean {
    const tag = this.tags.get(id)
    if (!tag) return false
    tag.color = color
    return true
  }

  // ── Assignment ─────────────────────────────────────────────

  addToFolder(conversationId: string, folderId: string): boolean {
    const folder = this.folders.get(folderId)
    if (!folder) return false
    if (!folder.conversationIds.includes(conversationId)) {
      folder.conversationIds.push(conversationId)
    }
    return true
  }

  removeFromFolder(conversationId: string, folderId: string): boolean {
    const folder = this.folders.get(folderId)
    if (!folder) return false
    folder.conversationIds = folder.conversationIds.filter(id => id !== conversationId)
    return true
  }

  moveToFolder(conversationId: string, fromFolderId: string, toFolderId: string): boolean {
    this.removeFromFolder(conversationId, fromFolderId)
    return this.addToFolder(conversationId, toFolderId)
  }

  addTag(conversationId: string, tagId: string): boolean {
    const tag = this.tags.get(tagId)
    if (!tag) return false
    if (!tag.conversationIds.includes(conversationId)) {
      tag.conversationIds.push(conversationId)
    }
    return true
  }

  removeTagFromConversation(conversationId: string, tagId: string): boolean {
    const tag = this.tags.get(tagId)
    if (!tag) return false
    tag.conversationIds = tag.conversationIds.filter(id => id !== conversationId)
    return true
  }

  /** Get all tags for a conversation. */
  getConversationTags(conversationId: string): ConversationTag[] {
    return this.getTags().filter(t => t.conversationIds.includes(conversationId))
  }

  /** Get the folder a conversation is in. */
  getConversationFolder(conversationId: string): ConversationFolder | undefined {
    return this.getFolders().find(f => f.conversationIds.includes(conversationId))
  }

  // ── Bulk Operations ────────────────────────────────────────

  bulkAddToFolder(conversationIds: string[], folderId: string): number {
    let count = 0
    for (const id of conversationIds) {
      if (this.addToFolder(id, folderId)) count++
    }
    return count
  }

  bulkAddTag(conversationIds: string[], tagId: string): number {
    let count = 0
    for (const id of conversationIds) {
      if (this.addTag(id, tagId)) count++
    }
    return count
  }

  // ── Auto-Tagging ───────────────────────────────────────────

  /** Suggest tags based on conversation content. */
  suggestTags(content: string): string[] {
    const suggestions: string[] = []
    const lower = content.toLowerCase()

    const patterns: Record<string, string[]> = {
      'code': ['function', 'class', 'import', 'const', 'let', 'var', 'def ', 'return'],
      'api': ['api', 'endpoint', 'rest', 'graphql', 'fetch', 'request', 'response'],
      'database': ['sql', 'query', 'database', 'table', 'schema', 'prisma', 'mongodb'],
      'frontend': ['react', 'vue', 'angular', 'css', 'html', 'component', 'ui'],
      'backend': ['server', 'express', 'fastify', 'node', 'middleware', 'route'],
      'devops': ['docker', 'kubernetes', 'deploy', 'ci/cd', 'pipeline', 'nginx'],
      'testing': ['test', 'jest', 'mocha', 'assert', 'expect', 'mock'],
      'debug': ['error', 'bug', 'fix', 'debug', 'issue', 'problem', 'crash'],
    }

    for (const [tag, keywords] of Object.entries(patterns)) {
      if (keywords.some(k => lower.includes(k))) {
        suggestions.push(tag)
      }
    }

    return suggestions
  }

  // ── Stats ──────────────────────────────────────────────────

  getStats(allConversationIds: string[]): OrganizationStats {
    const organized = new Set<string>()
    const byFolder: Record<string, number> = {}
    const byTag: Record<string, number> = {}

    for (const folder of this.folders.values()) {
      byFolder[folder.name] = folder.conversationIds.length
      folder.conversationIds.forEach(id => organized.add(id))
    }
    for (const tag of this.tags.values()) {
      byTag[tag.name] = tag.conversationIds.length
      tag.conversationIds.forEach(id => organized.add(id))
    }

    return {
      totalFolders: this.folders.size,
      totalTags: this.tags.size,
      unorganized: allConversationIds.filter(id => !organized.has(id)).length,
      byFolder,
      byTag,
    }
  }
}

export const conversationOrganizerService = new ConversationOrganizerService()
