import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'

const slackSendSchema = z.object({
  channel: z.string().min(1, 'Channel is required'),
  text: z.string().min(1, 'Message text is required').max(4000, 'Message too long'),
  thread_ts: z.string().optional(),
  blocks: z.array(z.object({
    type: z.string(),
    text: z.object({
      type: z.literal('plain_text').or(z.literal('mrkdwn')),
      text: z.string()
    }).optional(),
    elements: z.any().optional()
  })).optional(),
  attachments: z.array(z.object({
    color: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    fields: z.array(z.object({
      title: z.string(),
      value: z.string(),
      short: z.boolean().optional()
    })).optional()
  })).optional(),
  username: z.string().optional(),
  icon_emoji: z.string().optional(),
  icon_url: z.string().url().optional()
})

export class SlackTool implements MCPTool {
  id = 'slack'
  name = 'Send Slack Message'
  version = '1.0.0'
  category: 'communication' = 'communication'

  description = 'Send messages to Slack channels with rich formatting and attachments'
  author = 'MCP Team'
  tags = ['slack', 'messaging', 'communication', 'chat', 'notification']

  requiredConfig = ['slack_bot_token', 'slack_channel']
  optionalConfig = ['default_username', 'default_icon']

  inputSchema = slackSendSchema

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
    ttl: 60, // 1 minute
    key: (args: any) => `slack:${args.channel}:${args.text.slice(0, 50)}`,
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
        throw new Error('Rate limit exceeded for Slack tool')
      }

      // Vérifier le cache
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = await cache.get(cacheKey)

      if (cachedResult) {
        console.log(`💬 Slack cache hit for channel ${args.channel}`)
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

      // Simulation de l'envoi Slack
      const result = await this.sendSlackMessage(args, config)

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
        estimatedCost: 0.0001 // Coût très bas pour Slack
      })

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0.0001
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
        errorType: error.name || 'SlackError',
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

  private async sendSlackMessage(args: any, config: any): Promise<any> {
    const token = config.slack_bot_token || process.env.SLACK_BOT_TOKEN
    if (token) {
      // Real Slack Web API call
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: args.channel,
          text: args.text,
          thread_ts: args.thread_ts,
          blocks: args.blocks,
          attachments: args.attachments,
          username: args.username,
          icon_emoji: args.icon_emoji,
          icon_url: args.icon_url
        })
      })
      const data = await response.json()
      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`)
      }
      return { ...data, _simulation: false }
    }

    // Simulation mode — no real API call
    const timestamp = Date.now() / 1000
    const ts = args.thread_ts || timestamp.toString()

    return {
      ok: true,
      channel: args.channel,
      ts: ts.toString(),
      message: {
        type: 'message',
        text: args.text,
        ts: ts.toString(),
        username: args.username || config.default_username || 'MCP Bot',
      },
      _simulation: true,
      _note: 'Set SLACK_BOT_TOKEN env var for real Slack API integration'
    }
  }

  async beforeExecute(args: any): Promise<any> {
    console.log(`💬 Sending Slack message to ${args.channel}`)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      console.log(`✅ Slack message sent to ${result.data?.channel}: ${result.data?.ts}`)
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    console.error(`❌ Slack error: ${error.message}`)
  }
}
