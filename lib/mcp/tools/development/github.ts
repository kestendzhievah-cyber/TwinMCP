import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'
import { logger } from '@/lib/logger'

const githubRepoSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  action: z.enum(['issues', 'pulls', 'commits', 'releases', 'create_issue', 'create_pr']),
  data: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    assignee: z.string().optional(),
    labels: z.array(z.string()).optional(),
    branch: z.string().optional(),
    base: z.string().optional(),
    head: z.string().optional()
  }).optional(),
  limit: z.number().min(1).max(100).default(20),
  state: z.enum(['open', 'closed', 'all']).default('open')
})

export class GitHubTool implements MCPTool {
  id = 'github'
  name = 'GitHub Repository'
  version = '1.0.0'
  category: 'development' = 'development'

  description = 'Interact with GitHub repositories - read issues, PRs, commits and create new items'
  author = 'MCP Team'
  tags = ['github', 'git', 'repository', 'development', 'issues', 'pull-requests']

  requiredConfig = ['github_token']
  optionalConfig = ['default_owner', 'default_repo']

  inputSchema = githubRepoSchema

  capabilities = {
    async: false,
    batch: true,
    streaming: false,
    webhook: true
  }

  rateLimit = {
    requests: 500,
    period: '1h',
    strategy: 'sliding' as const
  }

  cache = {
    enabled: true,
    ttl: 600, // 10 minutes
    key: (args: any) => `github:${args.owner}:${args.repo}:${args.action}:${args.state}`,
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
        throw new Error('Rate limit exceeded for GitHub tool')
      }

      // Vérifier le cache (sauf pour les actions de création)
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = args.action.startsWith('create_') ? null : await cache.get(cacheKey)

      if (cachedResult) {
        logger.debug(`GitHub cache hit for ${args.owner}/${args.repo}/${args.action}`)
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

      // Exécuter l'action GitHub
      const result = await this.executeGitHubAction(args, config)

      // Mettre en cache (sauf pour les actions de création)
      if (!args.action.startsWith('create_')) {
        await cache.set(cacheKey, result, this.cache!.ttl)
      }

      // Tracker les métriques
      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: args.action.startsWith('create_') ? 0.001 : 0.0005
      })

      const execResult: ExecutionResult = {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: args.action.startsWith('create_') ? 0.001 : 0.0005
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
        errorType: error.name || 'GitHubError',
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

  private async executeGitHubAction(args: any, config: any): Promise<any> {
    const token = config.github_token || process.env.GITHUB_TOKEN
    if (token) {
      return this.callGitHubAPI(args, token)
    }

    // Simulation mode
    return {
      action: args.action,
      repository: `${args.owner}/${args.repo}`,
      data: [],
      _simulation: true,
      _note: 'Set GITHUB_TOKEN env var for real GitHub API integration'
    }
  }

  private async callGitHubAPI(args: any, token: string): Promise<any> {
    const baseUrl = 'https://api.github.com'
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TwinMCP-GitHubTool'
    }

    let url: string
    let method = 'GET'
    let body: string | undefined

    switch (args.action) {
      case 'issues':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/issues?state=${args.state || 'open'}&per_page=${args.limit || 10}`
        break
      case 'pulls':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/pulls?state=${args.state || 'open'}&per_page=${args.limit || 10}`
        break
      case 'commits':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/commits?per_page=${args.limit || 10}`
        break
      case 'releases':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/releases?per_page=${args.limit || 10}`
        break
      case 'create_issue':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/issues`
        method = 'POST'
        body = JSON.stringify({
          title: args.data?.title || 'New Issue',
          body: args.data?.body || '',
          labels: args.data?.labels || [],
          assignees: args.data?.assignee ? [args.data.assignee] : []
        })
        break
      case 'create_pr':
        url = `${baseUrl}/repos/${args.owner}/${args.repo}/pulls`
        method = 'POST'
        body = JSON.stringify({
          title: args.data?.title || 'New Pull Request',
          body: args.data?.body || '',
          head: args.data?.head || 'feature-branch',
          base: args.data?.base || 'main'
        })
        break
      default:
        throw new Error(`Unsupported GitHub action: ${args.action}`)
    }

    const response = await fetch(url, { method, headers, body })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`GitHub API error (${response.status}): ${err.message || response.statusText}`)
    }
    const data = await response.json()
    return {
      data,
      repository: `${args.owner}/${args.repo}`,
      action: args.action,
      _simulation: false
    }
  }

  async beforeExecute(args: any): Promise<any> {
    logger.debug(`GitHub action: ${args.action} on ${args.owner}/${args.repo}`)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      const action = result.data?.metadata?.created ? 'created' : 'retrieved'
      logger.debug(`GitHub ${action}: ${result.data?.total_count || 1} items`)
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    logger.error(`GitHub error: ${error.message}`)
  }
}
