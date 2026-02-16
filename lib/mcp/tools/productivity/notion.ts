import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'

const notionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(2000, 'Title too long'),
  content: z.string().optional(),
  parentId: z.string().optional(),
  databaseId: z.string().optional(),
  properties: z.record(z.any()).optional(),
  children: z.array(z.object({
    type: z.string(),
    content: z.string().optional(),
    children: z.any().optional()
  })).optional(),
  icon: z.object({
    type: z.enum(['emoji', 'external', 'file']),
    emoji: z.string().optional(),
    url: z.string().optional()
  }).optional(),
  cover: z.object({
    type: z.enum(['external', 'file']),
    url: z.string().optional()
  }).optional()
})

export class NotionTool implements MCPTool {
  id = 'notion'
  name = 'Create Notion Page'
  version = '1.0.0'
  category: 'productivity' = 'productivity'

  description = 'Create pages and databases in Notion with rich content and properties'
  author = 'MCP Team'
  tags = ['notion', 'pages', 'databases', 'productivity', 'notes']

  requiredConfig = ['notion_api_token']
  optionalConfig = ['default_workspace_id', 'default_database_id']

  inputSchema = notionCreateSchema

  capabilities = {
    async: false,
    batch: true,
    streaming: false,
    webhook: false
  }

  rateLimit = {
    requests: 50,
    period: '1h',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 1800, // 30 minutes
    key: (args: any) => `notion:${args.parentId || 'root'}:${args.title}`,
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
      // Execute before hook
      await this.beforeExecute(args)

      // Validation des arguments
      const validation = await this.validate(args)
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      // Vérifier les rate limits
      const userLimit = await rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id, config.rateLimit || {})
      if (!userLimit) {
        throw new Error('Rate limit exceeded for Notion tool')
      }

      // Création de page Notion (write operation — no cache)
      const result = await this.createNotionPage(args, config)

      // Tracker les métriques
      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: 0.001
      })

      const execResult: ExecutionResult = {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0.001
        }
      }

      // Execute after hook
      return await this.afterExecute(execResult)

    } catch (error: any) {
      const executionTime = Date.now() - startTime

      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime,
        cacheHit: false,
        success: false,
        errorType: error.name || 'NotionError',
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

  private async createNotionPage(args: any, config: any): Promise<any> {
    const token = config.notion_api_token || process.env.NOTION_API_TOKEN
    if (token) {
      // Real Notion API call
      const body: any = {
        parent: args.parentId
          ? { page_id: args.parentId }
          : args.databaseId
            ? { database_id: args.databaseId }
            : { page_id: args.parentId },
        properties: {
          title: { title: [{ text: { content: args.title } }] },
          ...args.properties
        }
      }
      if (args.children) body.children = args.children
      if (args.icon) body.icon = args.icon
      if (args.cover) body.cover = args.cover

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(`Notion API error: ${err.message || response.statusText}`)
      }
      const data = await response.json()
      return { ...data, _simulation: false }
    }

    // Simulation mode
    const now = new Date()
    return {
      id: `page_${now.getTime()}`,
      title: args.title,
      url: `https://notion.so/simulated`,
      created_time: now.toISOString(),
      _simulation: true,
      _note: 'Set NOTION_API_TOKEN env var for real Notion integration'
    }
  }

  async beforeExecute(args: any): Promise<any> {
    console.log(`📝 Creating Notion page: ${args.title}`)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      console.log(`✅ Notion page created: ${result.data?.url}`)
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    console.error(`❌ Notion error: ${error.message}`)
  }
}
