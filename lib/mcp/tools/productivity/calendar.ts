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
    const apiKey = config.google_calendar_api_key || process.env.GOOGLE_CALENDAR_API_KEY
    if (apiKey) {
      // Real Google Calendar API call
      const calendarId = encodeURIComponent(args.calendarId || 'primary')
      const params = new URLSearchParams({
        key: apiKey,
        timeMin: new Date(args.startDate).toISOString(),
        timeMax: new Date(args.endDate + 'T23:59:59').toISOString(),
        maxResults: String(args.maxResults || 50),
        singleEvents: String(args.singleEvents !== false),
        orderBy: args.orderBy || 'startTime'
      })
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(`Google Calendar API error: ${err.error?.message || response.statusText}`)
      }
      const data = await response.json()
      return { ...data, _simulation: false }
    }

    // Simulation mode
    return {
      events: [],
      totalCount: 0,
      startDate: args.startDate,
      endDate: args.endDate,
      calendarId: args.calendarId || 'primary',
      _simulation: true,
      _note: 'Set GOOGLE_CALENDAR_API_KEY env var for real Google Calendar integration'
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
