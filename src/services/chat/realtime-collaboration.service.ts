/**
 * Real-time Collaboration Service.
 *
 * Enables real-time collaboration features in conversations:
 *   - Presence tracking (who's online/typing)
 *   - Cursor/selection sync
 *   - Comments and annotations on messages
 *   - Collaborative editing
 *   - Activity feed
 */

export interface Participant {
  userId: string
  name: string
  avatar?: string
  status: 'online' | 'away' | 'typing' | 'offline'
  lastSeen: string
  cursor?: { messageIndex: number; position: number }
}

export interface Comment {
  id: string
  conversationId: string
  messageId: string
  authorId: string
  authorName: string
  content: string
  resolved: boolean
  replies: CommentReply[]
  createdAt: string
  updatedAt: string
}

export interface CommentReply {
  id: string
  commentId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface Annotation {
  id: string
  conversationId: string
  messageId: string
  authorId: string
  type: 'highlight' | 'note' | 'bookmark' | 'question' | 'important'
  content?: string
  startOffset: number
  endOffset: number
  color?: string
  createdAt: string
}

export interface ActivityEvent {
  id: string
  conversationId: string
  userId: string
  userName: string
  type: 'join' | 'leave' | 'message' | 'comment' | 'annotation' | 'edit' | 'typing'
  data?: Record<string, any>
  timestamp: string
}

export class RealtimeCollaborationService {
  private participants: Map<string, Map<string, Participant>> = new Map() // convId → userId → Participant
  private comments: Map<string, Comment> = new Map()
  private annotations: Map<string, Annotation> = new Map()
  private activities: ActivityEvent[] = []
  private idCounter = 0

  // ── Presence ───────────────────────────────────────────────

  join(conversationId: string, userId: string, name: string, avatar?: string): Participant {
    if (!this.participants.has(conversationId)) {
      this.participants.set(conversationId, new Map())
    }
    const participant: Participant = {
      userId, name, avatar,
      status: 'online',
      lastSeen: new Date().toISOString(),
    }
    this.participants.get(conversationId)!.set(userId, participant)
    this.addActivity(conversationId, userId, name, 'join')
    return participant
  }

  leave(conversationId: string, userId: string): boolean {
    const conv = this.participants.get(conversationId)
    if (!conv) return false
    const p = conv.get(userId)
    if (!p) return false
    this.addActivity(conversationId, userId, p.name, 'leave')
    return conv.delete(userId)
  }

  getParticipants(conversationId: string): Participant[] {
    const conv = this.participants.get(conversationId)
    if (!conv) return []
    return Array.from(conv.values())
  }

  getOnlineCount(conversationId: string): number {
    return this.getParticipants(conversationId).filter(p => p.status !== 'offline').length
  }

  setStatus(conversationId: string, userId: string, status: Participant['status']): boolean {
    const p = this.participants.get(conversationId)?.get(userId)
    if (!p) return false
    p.status = status
    p.lastSeen = new Date().toISOString()
    if (status === 'typing') {
      this.addActivity(conversationId, userId, p.name, 'typing')
    }
    return true
  }

  updateCursor(conversationId: string, userId: string, messageIndex: number, position: number): boolean {
    const p = this.participants.get(conversationId)?.get(userId)
    if (!p) return false
    p.cursor = { messageIndex, position }
    p.lastSeen = new Date().toISOString()
    return true
  }

  // ── Comments ───────────────────────────────────────────────

  addComment(conversationId: string, messageId: string, authorId: string, authorName: string, content: string): Comment {
    const comment: Comment = {
      id: `comment-${++this.idCounter}`,
      conversationId, messageId, authorId, authorName, content,
      resolved: false,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.comments.set(comment.id, comment)
    this.addActivity(conversationId, authorId, authorName, 'comment', { messageId, commentId: comment.id })
    return comment
  }

  getComments(conversationId: string): Comment[] {
    return Array.from(this.comments.values()).filter(c => c.conversationId === conversationId)
  }

  getMessageComments(messageId: string): Comment[] {
    return Array.from(this.comments.values()).filter(c => c.messageId === messageId)
  }

  replyToComment(commentId: string, authorId: string, authorName: string, content: string): CommentReply | null {
    const comment = this.comments.get(commentId)
    if (!comment) return null
    const reply: CommentReply = {
      id: `reply-${++this.idCounter}`,
      commentId, authorId, authorName, content,
      createdAt: new Date().toISOString(),
    }
    comment.replies.push(reply)
    comment.updatedAt = new Date().toISOString()
    return reply
  }

  resolveComment(commentId: string): boolean {
    const comment = this.comments.get(commentId)
    if (!comment) return false
    comment.resolved = true
    comment.updatedAt = new Date().toISOString()
    return true
  }

  unresolveComment(commentId: string): boolean {
    const comment = this.comments.get(commentId)
    if (!comment) return false
    comment.resolved = false
    comment.updatedAt = new Date().toISOString()
    return true
  }

  removeComment(commentId: string): boolean {
    return this.comments.delete(commentId)
  }

  // ── Annotations ────────────────────────────────────────────

  addAnnotation(conversationId: string, messageId: string, authorId: string, type: Annotation['type'], startOffset: number, endOffset: number, content?: string, color?: string): Annotation {
    const annotation: Annotation = {
      id: `ann-${++this.idCounter}`,
      conversationId, messageId, authorId, type,
      content, startOffset, endOffset, color,
      createdAt: new Date().toISOString(),
    }
    this.annotations.set(annotation.id, annotation)
    this.addActivity(conversationId, authorId, authorId, 'annotation', { messageId, type })
    return annotation
  }

  getAnnotations(conversationId: string): Annotation[] {
    return Array.from(this.annotations.values()).filter(a => a.conversationId === conversationId)
  }

  getMessageAnnotations(messageId: string): Annotation[] {
    return Array.from(this.annotations.values()).filter(a => a.messageId === messageId)
  }

  removeAnnotation(annotationId: string): boolean {
    return this.annotations.delete(annotationId)
  }

  // ── Activity Feed ──────────────────────────────────────────

  getActivities(conversationId: string, limit: number = 50): ActivityEvent[] {
    return this.activities
      .filter(a => a.conversationId === conversationId)
      .slice(-limit)
  }

  getAllActivities(): ActivityEvent[] {
    return [...this.activities]
  }

  get totalComments(): number { return this.comments.size }
  get totalAnnotations(): number { return this.annotations.size }

  // ── Internal ───────────────────────────────────────────────

  private addActivity(conversationId: string, userId: string, userName: string, type: ActivityEvent['type'], data?: Record<string, any>): void {
    this.activities.push({
      id: `act-${++this.idCounter}`,
      conversationId, userId, userName, type, data,
      timestamp: new Date().toISOString(),
    })
  }
}

export const realtimeCollaborationService = new RealtimeCollaborationService()
