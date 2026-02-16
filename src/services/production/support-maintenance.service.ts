/**
 * Support & Maintenance Service.
 *
 * Support ticket system, knowledge base, and status page:
 *   - Ticket CRUD with priority and assignment
 *   - Ticket lifecycle (open → in_progress → resolved → closed)
 *   - Knowledge base articles with search
 *   - Status page with component health
 *   - Incident management
 *   - SLA tracking
 */

export interface SupportTicket {
  id: string
  title: string
  description: string
  userId: string
  assigneeId?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  closedAt?: string
  messages: TicketMessage[]
  sla: { responseTimeMinutes: number; resolutionTimeMinutes: number; breached: boolean }
}

export interface TicketMessage {
  id: string
  authorId: string
  authorType: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  attachments: string[]
}

export interface KBArticle {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  author: string
  status: 'draft' | 'published' | 'archived'
  views: number
  helpful: number
  notHelpful: number
  createdAt: string
  updatedAt: string
}

export interface StatusComponent {
  id: string
  name: string
  description: string
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance'
  updatedAt: string
  group?: string
}

export interface Incident {
  id: string
  title: string
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  severity: 'minor' | 'major' | 'critical'
  affectedComponents: string[]
  updates: Array<{ timestamp: string; status: string; message: string }>
  createdAt: string
  resolvedAt?: string
}

export interface SLAConfig {
  priority: string
  responseTimeMinutes: number
  resolutionTimeMinutes: number
}

export class SupportMaintenanceService {
  private tickets: Map<string, SupportTicket> = new Map()
  private articles: Map<string, KBArticle> = new Map()
  private components: Map<string, StatusComponent> = new Map()
  private incidents: Map<string, Incident> = new Map()
  private slaConfigs: SLAConfig[] = [
    { priority: 'urgent', responseTimeMinutes: 15, resolutionTimeMinutes: 120 },
    { priority: 'high', responseTimeMinutes: 60, resolutionTimeMinutes: 480 },
    { priority: 'medium', responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
    { priority: 'low', responseTimeMinutes: 1440, resolutionTimeMinutes: 4320 },
  ]
  private idCounter = 0

  // ── Ticket Management ──────────────────────────────────────

  createTicket(title: string, description: string, userId: string, priority: SupportTicket['priority'] = 'medium', category: string = 'general'): SupportTicket {
    const slaConfig = this.slaConfigs.find(s => s.priority === priority) || this.slaConfigs[2]
    const ticket: SupportTicket = {
      id: `ticket-${++this.idCounter}`, title, description, userId,
      priority, status: 'open', category, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      messages: [], sla: { responseTimeMinutes: slaConfig.responseTimeMinutes, resolutionTimeMinutes: slaConfig.resolutionTimeMinutes, breached: false },
    }
    this.tickets.set(ticket.id, ticket)
    return ticket
  }

  getTicket(id: string): SupportTicket | undefined { return this.tickets.get(id) }

  getTickets(filters?: { status?: string; priority?: string; userId?: string; assigneeId?: string }): SupportTicket[] {
    let results = Array.from(this.tickets.values())
    if (filters?.status) results = results.filter(t => t.status === filters.status)
    if (filters?.priority) results = results.filter(t => t.priority === filters.priority)
    if (filters?.userId) results = results.filter(t => t.userId === filters.userId)
    if (filters?.assigneeId) results = results.filter(t => t.assigneeId === filters.assigneeId)
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  assignTicket(ticketId: string, assigneeId: string): boolean {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) return false
    ticket.assigneeId = assigneeId
    ticket.status = 'in_progress'
    ticket.updatedAt = new Date().toISOString()
    return true
  }

  updateTicketStatus(ticketId: string, status: SupportTicket['status']): boolean {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) return false
    ticket.status = status
    ticket.updatedAt = new Date().toISOString()
    if (status === 'resolved') ticket.resolvedAt = new Date().toISOString()
    if (status === 'closed') ticket.closedAt = new Date().toISOString()
    return true
  }

  addTicketMessage(ticketId: string, authorId: string, authorType: TicketMessage['authorType'], content: string): boolean {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) return false
    ticket.messages.push({
      id: `msg-${++this.idCounter}`, authorId, authorType, content,
      timestamp: new Date().toISOString(), attachments: [],
    })
    ticket.updatedAt = new Date().toISOString()
    return true
  }

  getTicketStats(): { total: number; open: number; inProgress: number; resolved: number; avgResolutionMinutes: number } {
    const all = Array.from(this.tickets.values())
    const resolved = all.filter(t => t.resolvedAt)
    const resolutionTimes = resolved.map(t => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000)
    return {
      total: all.length,
      open: all.filter(t => t.status === 'open').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      resolved: resolved.length,
      avgResolutionMinutes: resolutionTimes.length > 0 ? Math.round(resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length) : 0,
    }
  }

  // ── Knowledge Base ─────────────────────────────────────────

  createArticle(title: string, content: string, category: string, author: string, tags: string[] = []): KBArticle {
    const article: KBArticle = {
      id: `kb-${++this.idCounter}`, title, content, category, tags, author,
      status: 'draft', views: 0, helpful: 0, notHelpful: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    this.articles.set(article.id, article)
    return article
  }

  getArticle(id: string): KBArticle | undefined { return this.articles.get(id) }

  getArticles(category?: string): KBArticle[] {
    let results = Array.from(this.articles.values()).filter(a => a.status === 'published')
    if (category) results = results.filter(a => a.category === category)
    return results
  }

  publishArticle(id: string): boolean {
    const article = this.articles.get(id)
    if (!article) return false
    article.status = 'published'
    article.updatedAt = new Date().toISOString()
    return true
  }

  searchArticles(query: string): KBArticle[] {
    const q = query.toLowerCase()
    return Array.from(this.articles.values())
      .filter(a => a.status === 'published' && (a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))))
  }

  recordArticleView(id: string): boolean {
    const article = this.articles.get(id)
    if (!article) return false
    article.views++
    return true
  }

  rateArticle(id: string, helpful: boolean): boolean {
    const article = this.articles.get(id)
    if (!article) return false
    if (helpful) article.helpful++; else article.notHelpful++
    return true
  }

  removeArticle(id: string): boolean { return this.articles.delete(id) }

  // ── Status Page ────────────────────────────────────────────

  addComponent(name: string, description: string, group?: string): StatusComponent {
    const component: StatusComponent = {
      id: `comp-${++this.idCounter}`, name, description,
      status: 'operational', updatedAt: new Date().toISOString(), group,
    }
    this.components.set(component.id, component)
    return component
  }

  getComponent(id: string): StatusComponent | undefined { return this.components.get(id) }
  getComponents(): StatusComponent[] { return Array.from(this.components.values()) }

  updateComponentStatus(id: string, status: StatusComponent['status']): boolean {
    const comp = this.components.get(id)
    if (!comp) return false
    comp.status = status
    comp.updatedAt = new Date().toISOString()
    return true
  }

  getOverallStatus(): 'operational' | 'degraded' | 'partial_outage' | 'major_outage' {
    const components = this.getComponents()
    if (components.length === 0) return 'operational'
    if (components.every(c => c.status === 'operational')) return 'operational'
    if (components.some(c => c.status === 'major_outage')) return 'major_outage'
    if (components.some(c => c.status === 'partial_outage')) return 'partial_outage'
    return 'degraded'
  }

  removeComponent(id: string): boolean { return this.components.delete(id) }

  // ── Incident Management ────────────────────────────────────

  createIncident(title: string, severity: Incident['severity'], affectedComponentIds: string[]): Incident {
    const incident: Incident = {
      id: `inc-${++this.idCounter}`, title, severity, status: 'investigating',
      affectedComponents: affectedComponentIds,
      updates: [{ timestamp: new Date().toISOString(), status: 'investigating', message: `Investigating: ${title}` }],
      createdAt: new Date().toISOString(),
    }
    // Update affected components
    for (const compId of affectedComponentIds) {
      this.updateComponentStatus(compId, severity === 'critical' ? 'major_outage' : 'partial_outage')
    }
    this.incidents.set(incident.id, incident)
    return incident
  }

  updateIncident(id: string, status: Incident['status'], message: string): boolean {
    const incident = this.incidents.get(id)
    if (!incident) return false
    incident.status = status
    incident.updates.push({ timestamp: new Date().toISOString(), status, message })
    if (status === 'resolved') {
      incident.resolvedAt = new Date().toISOString()
      for (const compId of incident.affectedComponents) {
        this.updateComponentStatus(compId, 'operational')
      }
    }
    return true
  }

  getIncident(id: string): Incident | undefined { return this.incidents.get(id) }
  getIncidents(): Incident[] { return Array.from(this.incidents.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }
  getActiveIncidents(): Incident[] { return this.getIncidents().filter(i => i.status !== 'resolved') }
  removeIncident(id: string): boolean { return this.incidents.delete(id) }
}

export const supportMaintenanceService = new SupportMaintenanceService()
