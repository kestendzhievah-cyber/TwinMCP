import { RealtimeCollaborationService } from '../../src/services/chat/realtime-collaboration.service'

describe('RealtimeCollaborationService', () => {
  let service: RealtimeCollaborationService

  beforeEach(() => {
    service = new RealtimeCollaborationService()
  })

  describe('Presence', () => {
    it('joins a conversation', () => {
      const p = service.join('conv-1', 'user-1', 'Alice')
      expect(p.status).toBe('online')
      expect(p.name).toBe('Alice')
    })

    it('lists participants', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.join('conv-1', 'user-2', 'Bob')
      expect(service.getParticipants('conv-1').length).toBe(2)
    })

    it('leaves a conversation', () => {
      service.join('conv-1', 'user-1', 'Alice')
      expect(service.leave('conv-1', 'user-1')).toBe(true)
      expect(service.getParticipants('conv-1').length).toBe(0)
    })

    it('counts online users', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.join('conv-1', 'user-2', 'Bob')
      service.setStatus('conv-1', 'user-2', 'offline')
      expect(service.getOnlineCount('conv-1')).toBe(1)
    })

    it('sets typing status', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.setStatus('conv-1', 'user-1', 'typing')
      expect(service.getParticipants('conv-1')[0].status).toBe('typing')
    })

    it('updates cursor position', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.updateCursor('conv-1', 'user-1', 5, 42)
      const p = service.getParticipants('conv-1')[0]
      expect(p.cursor).toEqual({ messageIndex: 5, position: 42 })
    })

    it('returns false for unknown participant', () => {
      expect(service.setStatus('conv-1', 'unknown', 'typing')).toBe(false)
      expect(service.updateCursor('conv-1', 'unknown', 0, 0)).toBe(false)
    })
  })

  describe('Comments', () => {
    it('adds a comment', () => {
      const c = service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'Great point!')
      expect(c.content).toBe('Great point!')
      expect(c.resolved).toBe(false)
    })

    it('lists comments for conversation', () => {
      service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'Comment 1')
      service.addComment('conv-1', 'msg-2', 'user-1', 'Alice', 'Comment 2')
      service.addComment('conv-2', 'msg-3', 'user-1', 'Alice', 'Other conv')
      expect(service.getComments('conv-1').length).toBe(2)
    })

    it('lists comments for a message', () => {
      service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'C1')
      service.addComment('conv-1', 'msg-1', 'user-2', 'Bob', 'C2')
      expect(service.getMessageComments('msg-1').length).toBe(2)
    })

    it('replies to a comment', () => {
      const c = service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'Question?')
      const reply = service.replyToComment(c.id, 'user-2', 'Bob', 'Answer!')
      expect(reply).not.toBeNull()
      expect(reply!.content).toBe('Answer!')
      expect(service.getComments('conv-1')[0].replies.length).toBe(1)
    })

    it('resolves and unresolves comments', () => {
      const c = service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'TODO')
      expect(service.resolveComment(c.id)).toBe(true)
      expect(service.getComments('conv-1')[0].resolved).toBe(true)
      expect(service.unresolveComment(c.id)).toBe(true)
      expect(service.getComments('conv-1')[0].resolved).toBe(false)
    })

    it('removes a comment', () => {
      const c = service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'Delete me')
      expect(service.removeComment(c.id)).toBe(true)
      expect(service.totalComments).toBe(0)
    })
  })

  describe('Annotations', () => {
    it('adds an annotation', () => {
      const a = service.addAnnotation('conv-1', 'msg-1', 'user-1', 'highlight', 0, 50, undefined, '#ffff00')
      expect(a.type).toBe('highlight')
      expect(a.startOffset).toBe(0)
      expect(a.endOffset).toBe(50)
    })

    it('lists annotations for conversation', () => {
      service.addAnnotation('conv-1', 'msg-1', 'user-1', 'highlight', 0, 10)
      service.addAnnotation('conv-1', 'msg-2', 'user-1', 'note', 5, 20, 'Important')
      expect(service.getAnnotations('conv-1').length).toBe(2)
    })

    it('lists annotations for a message', () => {
      service.addAnnotation('conv-1', 'msg-1', 'user-1', 'highlight', 0, 10)
      service.addAnnotation('conv-1', 'msg-1', 'user-2', 'bookmark', 0, 0)
      expect(service.getMessageAnnotations('msg-1').length).toBe(2)
    })

    it('removes an annotation', () => {
      const a = service.addAnnotation('conv-1', 'msg-1', 'user-1', 'note', 0, 10)
      expect(service.removeAnnotation(a.id)).toBe(true)
      expect(service.totalAnnotations).toBe(0)
    })

    it('supports all annotation types', () => {
      const types: Array<'highlight' | 'note' | 'bookmark' | 'question' | 'important'> = ['highlight', 'note', 'bookmark', 'question', 'important']
      for (const type of types) {
        service.addAnnotation('conv-1', 'msg-1', 'user-1', type, 0, 10)
      }
      expect(service.totalAnnotations).toBe(5)
    })
  })

  describe('Activity feed', () => {
    it('records join/leave activities', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.leave('conv-1', 'user-1')
      const activities = service.getActivities('conv-1')
      expect(activities.length).toBe(2)
      expect(activities[0].type).toBe('join')
      expect(activities[1].type).toBe('leave')
    })

    it('records comment activities', () => {
      service.addComment('conv-1', 'msg-1', 'user-1', 'Alice', 'Hi')
      const activities = service.getActivities('conv-1')
      expect(activities.some(a => a.type === 'comment')).toBe(true)
    })

    it('records typing activities', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.setStatus('conv-1', 'user-1', 'typing')
      expect(service.getActivities('conv-1').some(a => a.type === 'typing')).toBe(true)
    })

    it('limits activity feed', () => {
      for (let i = 0; i < 60; i++) {
        service.join('conv-1', `user-${i}`, `User ${i}`)
      }
      expect(service.getActivities('conv-1', 10).length).toBe(10)
    })

    it('gets all activities', () => {
      service.join('conv-1', 'user-1', 'Alice')
      service.join('conv-2', 'user-2', 'Bob')
      expect(service.getAllActivities().length).toBe(2)
    })
  })
})
