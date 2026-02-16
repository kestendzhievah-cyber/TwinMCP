/**
 * File Attachments Service.
 *
 * Manages file attachments in chat messages:
 *   - File upload with validation
 *   - MIME type detection
 *   - Size limits and quotas
 *   - Thumbnail generation metadata
 *   - File preview support
 *   - Attachment search
 */

export interface FileAttachment {
  id: string
  messageId: string
  conversationId: string
  name: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  category: 'image' | 'document' | 'code' | 'audio' | 'video' | 'archive' | 'other'
  metadata: Record<string, any>
  uploadedAt: string
  uploadedBy: string
}

export interface UploadConfig {
  maxFileSize: number          // bytes
  maxTotalSize: number         // bytes per conversation
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  maxFilesPerMessage: number
  generateThumbnails: boolean
}

export interface UploadResult {
  success: boolean
  attachment?: FileAttachment
  error?: string
}

export interface AttachmentStats {
  totalFiles: number
  totalSize: number
  byCategory: Record<string, number>
  byMimeType: Record<string, number>
}

const DEFAULT_CONFIG: UploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/json',
    'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
    'application/javascript', 'application/typescript',
    'application/zip', 'application/gzip',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm',
  ],
  allowedExtensions: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'pdf', 'json', 'txt', 'md', 'csv', 'html', 'css',
    'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'zip', 'gz', 'tar',
    'mp3', 'wav', 'ogg',
    'mp4', 'webm',
  ],
  maxFilesPerMessage: 5,
  generateThumbnails: true,
}

export class FileAttachmentsService {
  private attachments: Map<string, FileAttachment> = new Map()
  private config: UploadConfig
  private idCounter = 0

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getConfig(): UploadConfig { return { ...this.config } }
  setConfig(config: Partial<UploadConfig>): void { Object.assign(this.config, config) }

  // ── Upload ─────────────────────────────────────────────────

  /** Validate and register a file attachment. */
  upload(file: { name: string; mimeType: string; size: number; url: string }, messageId: string, conversationId: string, uploadedBy: string): UploadResult {
    // Validate size
    if (file.size > this.config.maxFileSize) {
      return { success: false, error: `File too large: ${file.size} bytes (max ${this.config.maxFileSize})` }
    }

    // Validate total size for conversation
    const convSize = this.getConversationTotalSize(conversationId)
    if (convSize + file.size > this.config.maxTotalSize) {
      return { success: false, error: `Conversation storage limit exceeded` }
    }

    // Validate MIME type
    if (!this.isAllowedMimeType(file.mimeType)) {
      return { success: false, error: `File type not allowed: ${file.mimeType}` }
    }

    // Validate extension
    const ext = this.getExtension(file.name)
    if (ext && !this.config.allowedExtensions.includes(ext)) {
      return { success: false, error: `File extension not allowed: .${ext}` }
    }

    // Validate files per message
    const msgFiles = this.getMessageAttachments(messageId)
    if (msgFiles.length >= this.config.maxFilesPerMessage) {
      return { success: false, error: `Max files per message reached (${this.config.maxFilesPerMessage})` }
    }

    const attachment: FileAttachment = {
      id: `att-${++this.idCounter}`,
      messageId, conversationId,
      name: this.sanitizeFilename(file.name),
      originalName: file.name,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      category: this.categorize(file.mimeType),
      metadata: {},
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    }

    this.attachments.set(attachment.id, attachment)
    return { success: true, attachment }
  }

  // ── Retrieval ──────────────────────────────────────────────

  get(id: string): FileAttachment | undefined {
    return this.attachments.get(id)
  }

  getMessageAttachments(messageId: string): FileAttachment[] {
    return Array.from(this.attachments.values()).filter(a => a.messageId === messageId)
  }

  getConversationAttachments(conversationId: string): FileAttachment[] {
    return Array.from(this.attachments.values()).filter(a => a.conversationId === conversationId)
  }

  getAll(): FileAttachment[] {
    return Array.from(this.attachments.values())
  }

  get totalCount(): number { return this.attachments.size }

  // ── Deletion ───────────────────────────────────────────────

  remove(id: string): boolean {
    return this.attachments.delete(id)
  }

  removeMessageAttachments(messageId: string): number {
    let count = 0
    for (const [id, att] of this.attachments) {
      if (att.messageId === messageId) {
        this.attachments.delete(id)
        count++
      }
    }
    return count
  }

  // ── Search ─────────────────────────────────────────────────

  search(query: string, conversationId?: string): FileAttachment[] {
    const lower = query.toLowerCase()
    return Array.from(this.attachments.values()).filter(a => {
      if (conversationId && a.conversationId !== conversationId) return false
      return a.name.toLowerCase().includes(lower) || a.originalName.toLowerCase().includes(lower) || a.mimeType.includes(lower)
    })
  }

  searchByCategory(category: FileAttachment['category'], conversationId?: string): FileAttachment[] {
    return Array.from(this.attachments.values()).filter(a => {
      if (conversationId && a.conversationId !== conversationId) return false
      return a.category === category
    })
  }

  // ── Stats ──────────────────────────────────────────────────

  getStats(conversationId?: string): AttachmentStats {
    const atts = conversationId
      ? this.getConversationAttachments(conversationId)
      : this.getAll()

    const byCategory: Record<string, number> = {}
    const byMimeType: Record<string, number> = {}
    let totalSize = 0

    for (const a of atts) {
      totalSize += a.size
      byCategory[a.category] = (byCategory[a.category] || 0) + 1
      byMimeType[a.mimeType] = (byMimeType[a.mimeType] || 0) + 1
    }

    return { totalFiles: atts.length, totalSize, byCategory, byMimeType }
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Detect file category from MIME type. */
  categorize(mimeType: string): FileAttachment['category'] {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('application/zip') || mimeType.includes('gzip') || mimeType.includes('tar')) return 'archive'
    if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType.includes('spreadsheet')) return 'document'
    if (mimeType.startsWith('text/') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json')) return 'code'
    return 'other'
  }

  /** Check if a file can be previewed inline. */
  isPreviewable(mimeType: string): boolean {
    return mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('javascript')
  }

  /** Format file size for display. */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  private isAllowedMimeType(mimeType: string): boolean {
    return this.config.allowedMimeTypes.includes(mimeType) ||
      this.config.allowedMimeTypes.some(t => {
        if (t.endsWith('/*')) return mimeType.startsWith(t.replace('/*', '/'))
        return false
      })
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  private getConversationTotalSize(conversationId: string): number {
    return this.getConversationAttachments(conversationId).reduce((s, a) => s + a.size, 0)
  }
}

export const fileAttachmentsService = new FileAttachmentsService()
