import { prisma } from '@/lib/prisma'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ENCRYPTION_KEY = process.env.EXTERNAL_MCP_ENCRYPTION_KEY || randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'

// ─── Encryption helpers ──────────────────────────────────────────

function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

function decrypt(encryptedText: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ─── Types ───────────────────────────────────────────────────────

export type AuthType = 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC'

export interface CreateExternalMcpServerInput {
  name: string
  baseUrl: string
  authType: AuthType
  secret?: string
}

export interface ExternalMcpServerDTO {
  id: string
  name: string
  baseUrl: string
  authType: AuthType
  status: string
  errorMessage: string | null
  lastCheckedAt: string | null
  lastLatencyMs: number | null
  toolsDiscovered: any
  createdAt: string
  updatedAt: string
}

// ─── Service ─────────────────────────────────────────────────────

const FREE_DAILY_LIMIT = parseInt(process.env.EXTERNAL_MCP_FREE_DAILY_LIMIT || '200', 10)
const PROXY_TIMEOUT_MS = parseInt(process.env.EXTERNAL_MCP_PROXY_TIMEOUT_MS || '30000', 10)

export class ExternalMcpService {

  // ── CRUD ─────────────────────────────────────────────────────

  async list(ownerId: string): Promise<ExternalMcpServerDTO[]> {
    const servers = await prisma.externalMcpServer.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    })
    return servers.map(this.toDTO)
  }

  async getById(id: string, ownerId: string) {
    return prisma.externalMcpServer.findFirst({ where: { id, ownerId } })
  }

  async create(ownerId: string, input: CreateExternalMcpServerInput): Promise<ExternalMcpServerDTO> {
    // Validate URL
    try {
      const url = new URL(input.baseUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP/HTTPS protocols are allowed')
      }
    } catch (e: any) {
      if (e.message.includes('protocol')) throw e
      throw new Error('Invalid URL format')
    }

    const encryptedSecret = input.secret ? encrypt(input.secret) : null

    const server = await prisma.externalMcpServer.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl.replace(/\/+$/, ''), // strip trailing slash
        authType: input.authType,
        encryptedSecret,
        ownerId,
      },
    })

    return this.toDTO(server)
  }

  async update(id: string, ownerId: string, input: Partial<CreateExternalMcpServerInput>): Promise<ExternalMcpServerDTO> {
    const existing = await prisma.externalMcpServer.findFirst({ where: { id, ownerId } })
    if (!existing) throw new Error('Server not found')

    const data: any = {}
    if (input.name !== undefined) data.name = input.name
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl.replace(/\/+$/, '')
    if (input.authType !== undefined) data.authType = input.authType
    if (input.secret !== undefined) data.encryptedSecret = input.secret ? encrypt(input.secret) : null

    const server = await prisma.externalMcpServer.update({ where: { id }, data })
    return this.toDTO(server)
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const existing = await prisma.externalMcpServer.findFirst({ where: { id, ownerId } })
    if (!existing) throw new Error('Server not found')
    await prisma.externalMcpServer.delete({ where: { id } })
  }

  // ── Health check ─────────────────────────────────────────────

  async healthCheck(id: string, ownerId: string): Promise<{ status: string; latencyMs: number; tools?: any[]; error?: string }> {
    const server = await prisma.externalMcpServer.findFirst({ where: { id, ownerId } })
    if (!server) throw new Error('Server not found')

    const start = Date.now()
    try {
      const headers = this.buildAuthHeaders(server)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

      const res = await fetch(`${server.baseUrl}/.well-known/mcp`, {
        headers,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const latencyMs = Date.now() - start

      if (!res.ok) {
        await prisma.externalMcpServer.update({
          where: { id },
          data: { status: 'DOWN', errorMessage: `HTTP ${res.status}`, lastCheckedAt: new Date(), lastLatencyMs: latencyMs },
        })
        return { status: 'DOWN', latencyMs, error: `HTTP ${res.status}` }
      }

      // Try to discover tools
      let tools: any[] = []
      try {
        const toolsRes = await fetch(`${server.baseUrl}/tools/list`, { headers })
        if (toolsRes.ok) {
          const data = await toolsRes.json()
          tools = Array.isArray(data) ? data : data.tools || []
        }
      } catch { /* tools discovery is optional */ }

      await prisma.externalMcpServer.update({
        where: { id },
        data: {
          status: 'HEALTHY',
          errorMessage: null,
          lastCheckedAt: new Date(),
          lastLatencyMs: latencyMs,
          toolsDiscovered: tools.length > 0 ? tools : undefined,
        },
      })

      return { status: 'HEALTHY', latencyMs, tools }
    } catch (error: any) {
      const latencyMs = Date.now() - start
      const errorMsg = error.name === 'AbortError' ? 'Timeout' : error.message

      await prisma.externalMcpServer.update({
        where: { id },
        data: { status: 'DOWN', errorMessage: errorMsg, lastCheckedAt: new Date(), lastLatencyMs: latencyMs },
      })

      return { status: 'DOWN', latencyMs, error: errorMsg }
    }
  }

  // ── Proxy ────────────────────────────────────────────────────

  async proxy(
    serverId: string,
    ownerId: string,
    userId: string,
    path: string,
    method: string,
    body?: any
  ): Promise<{ status: number; data: any; latencyMs: number }> {
    const server = await prisma.externalMcpServer.findFirst({ where: { id: serverId, ownerId } })
    if (!server) throw new Error('Server not found')

    // Check daily usage limit for free users
    await this.checkUsageLimit(userId)

    const start = Date.now()
    const headers = this.buildAuthHeaders(server)
    headers['Content-Type'] = 'application/json'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

    try {
      const res = await fetch(`${server.baseUrl}/${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const latencyMs = Date.now() - start
      const data = await res.json().catch(() => ({}))

      // Log usage
      await prisma.externalMcpUsageLog.create({
        data: {
          serverId,
          userId,
          toolName: path,
          statusCode: res.status,
          latencyMs,
          tokensIn: body ? Math.ceil(JSON.stringify(body).length / 4) : 0,
          tokensOut: Math.ceil(JSON.stringify(data).length / 4),
          success: res.ok,
        },
      })

      return { status: res.status, data, latencyMs }
    } catch (error: any) {
      clearTimeout(timeout)
      const latencyMs = Date.now() - start

      await prisma.externalMcpUsageLog.create({
        data: {
          serverId,
          userId,
          toolName: path,
          latencyMs,
          success: false,
        },
      })

      throw error
    }
  }

  // ── Usage ────────────────────────────────────────────────────

  async getUsage(userId: string, serverId?: string, days: number = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const where: any = { userId, createdAt: { gte: since } }
    if (serverId) where.serverId = serverId

    const logs = await prisma.externalMcpUsageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const totalRequests = logs.length
    const successCount = logs.filter((l: { success: boolean }) => l.success).length
    const avgLatency = totalRequests > 0 ? Math.round(logs.reduce((s: number, l: { latencyMs: number | null }) => s + (l.latencyMs || 0), 0) / totalRequests) : 0

    return { totalRequests, successCount, avgLatency, logs: logs.slice(0, 100) }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private buildAuthHeaders(server: { authType: string; encryptedSecret: string | null }): Record<string, string> {
    const headers: Record<string, string> = { 'User-Agent': 'TwinMCP-Proxy/1.0' }

    if (server.authType === 'NONE' || !server.encryptedSecret) return headers

    const secret = decrypt(server.encryptedSecret)

    switch (server.authType) {
      case 'API_KEY':
        headers['X-API-Key'] = secret
        break
      case 'BEARER':
        headers['Authorization'] = `Bearer ${secret}`
        break
      case 'BASIC':
        headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`
        break
    }

    return headers
  }

  private async checkUsageLimit(userId: string): Promise<void> {
    // Check if user is on free plan
    try {
      const userLimits = await import('@/lib/user-limits')
      const result = await userLimits.canMakeRequest(userId)
      if (!result.allowed) {
        const err: any = new Error(`Limite quotidienne atteinte (${result.currentCount}/${result.limit})`)
        err.statusCode = 429
        err.quota = { limit: result.limit, current: result.currentCount, suggestedUpgrade: result.suggestedUpgrade }
        throw err
      }
    } catch (e: any) {
      if (e.statusCode === 429) throw e
      // If user-limits module fails, allow by default
      console.warn('Could not check usage limits:', e.message)
    }
  }

  private toDTO(server: any): ExternalMcpServerDTO {
    return {
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      authType: server.authType,
      status: server.status,
      errorMessage: server.errorMessage,
      lastCheckedAt: server.lastCheckedAt?.toISOString() || null,
      lastLatencyMs: server.lastLatencyMs,
      toolsDiscovered: server.toolsDiscovered,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    }
  }
}

export const externalMcpService = new ExternalMcpService()
