import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'

const calendarReadSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  calendarId: z.string().optional(),
  maxResults: z.number().min(1).max(100).default(50),
  singleEvents: z.boolean().default(true),
  orderBy: z.enum(['startTime', 'updated']).default('startTime')
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: "Start date must be before end date",
  path: ["endDate"]
})

export class CalendarTool implements MCPTool {
  id = 'calendar'
  name = 'Read Calendar'
  version = '1.0.0'
  category: 'productivity' = 'productivity'

  description = 'Read Google Calendar events with advanced filtering and caching'
  author = 'MCP Team'
  tags = ['calendar', 'google', 'events', 'productivity', 'schedule']

  requiredConfig = ['google_calendar_api_key']
  optionalConfig = ['default_calendar_id', 'timezone']

  inputSchema = calendarReadSchema

  capabilities = {
    async: false,
    batch: true,
    streaming: false,
    webhook: true
  }

  rateLimit = {
    requests: 200,
    period: '1h',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 600, // 10 minutes
    key: (args: any) => `calendar:${args.calendarId || 'primary'}:${args.startDate}:${args.endDate}`,
    strategy: 'memory' as const
  }

  async validate(args: any): Promise<ValidationResult> {
    try {
      const validated = await this.inputSchema.parseAsync(args)
      return { success: true, data: validated }
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: z.ZodIssue) => ({
          path: e.path.join('.'),
          message: e.message
        })) || [{ path: 'unknown', message: 'Validation failed' }]
      }
    }
  }

  async execute(args: any, config: any): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Validation des arguments
      const validation = await this.validate(args)
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      // Vérifier les rate limits
      const userLimit = await rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id)
      if (!userLimit) {
        throw new Error('Rate limit exceeded for calendar tool')
      }

      // Vérifier le cache
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = await cache.get(cacheKey)

      if (cachedResult) {
        console.log(`📅 Calendar cache hit for ${args.startDate} to ${args.endDate}`)
        getMetrics().track({
          toolId: this.id,
          userId: config.userId || 'anonymous',
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          cacheHit: true,
          success: true,
          apiCallsCount: 0,
          estimatedCost: 0
        })

        return {
          success: true,
          data: cachedResult,
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: true,
            apiCallsCount: 0,
            cost: 0
          }
        }
      }

      // Simulation de la lecture du calendrier
      const result = await this.readCalendarEvents(args, config)

      // Mettre en cache
      await cache.set(cacheKey, result, this.cache!.ttl)

      // Tracker les métriques
      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: 0.0005 // Coût estimé par requête calendar
      })

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0.0005
        }
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime

      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime,
        cacheHit: false,
        success: false,
        errorType: error.name || 'CalendarError',
        apiCallsCount: 1,
        estimatedCost: 0
      })

      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0
        }
      }
    }
  }

  private async readCalendarEvents(args: any, config: any): Promise<any> {
    // Simulation de la lecture des événements calendrier
    // Dans une vraie implémentation, utiliser Google Calendar API

    await new Promise(resolve => setTimeout(resolve, 150)) // Simulation réseau

    const startDate = new Date(args.startDate)
    const endDate = new Date(args.endDate)

    // Générer des événements simulés
    const events = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      // Générer 0-3 événements par jour
      const eventsPerDay = Math.floor(Math.random() * 4)

      for (let i = 0; i < eventsPerDay; i++) {
        const hour = 8 + Math.floor(Math.random() * 10) // 8h à 18h
        const minute = Math.floor(Math.random() * 4) * 15 // 0, 15, 30, 45 min
        const duration = 30 + Math.floor(Math.random() * 4) * 30 // 30min à 2h

        const eventStart = new Date(currentDate)
        eventStart.setHours(hour, minute, 0, 0)

        const eventEnd = new Date(eventStart)
        eventEnd.setMinutes(eventEnd.getMinutes() + duration)

        events.push({
          id: `event_${currentDate.toISOString().split('T')[0]}_${i}`,
          summary: `Meeting ${i + 1}`,
          description: `Scheduled meeting on ${currentDate.toLocaleDateString()}`,
          start: {
            dateTime: eventStart.toISOString(),
            timeZone: args.timezone || 'UTC'
          },
          end: {
            dateTime: eventEnd.toISOString(),
            timeZone: args.timezone || 'UTC'
          },
          status: 'confirmed',
          attendees: [
            { email: 'organizer@example.com', responseStatus: 'accepted' },
            { email: 'attendee@example.com', responseStatus: 'needsAction' }
          ],
          location: `Room ${Math.floor(Math.random() * 10) + 1}`,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        })
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return {
      events: events.slice(0, args.maxResults),
      totalCount: events.length,
      startDate: args.startDate,
      endDate: args.endDate,
      calendarId: args.calendarId || 'primary',
      maxResults: args.maxResults,
      nextSyncToken: `sync_${Date.now()}`,
      metadata: {
        queryTime: 150,
        apiCalls: 1,
        filtered: events.length > args.maxResults
      }
    }
  }

  async beforeExecute(args: any): Promise<any> {
    console.log(`📅 Fetching calendar events from ${args.startDate} to ${args.endDate}`)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      console.log(`✅ Retrieved ${result.data?.events?.length || 0} calendar events`)
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    console.error(`❌ Calendar error: ${error.message}`)
  }
}
