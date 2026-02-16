/**
 * SSE (Server-Sent Events) transport for MCP streaming.
 *
 * Provides two endpoints on the HTTP MCP server:
 *   GET  /mcp/sse          — SSE stream (client connects here to receive events)
 *   POST /mcp/sse/message  — Client sends JSON-RPC messages here; responses
 *                            are pushed back through the SSE stream.
 *
 * Each SSE connection gets a unique session ID. The POST endpoint requires
 * the session ID as a query parameter (?sessionId=xxx).
 *
 * Event types sent over SSE:
 *   "endpoint"  — first event, tells the client where to POST messages
 *   "message"   — JSON-RPC response/notification
 *   "ping"      — keep-alive (every 30 s)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import { MCPMessage, MCPErrorCodes } from '../types'

export interface SSESession {
  id: string
  reply: FastifyReply
  createdAt: number
  lastActivity: number
}

export interface SSETransportOptions {
  /** Path prefix for SSE routes (default: '/mcp/sse') */
  basePath?: string
  /** Keep-alive interval in ms (default: 30 000) */
  pingInterval?: number
  /** Session timeout in ms (default: 300 000 = 5 min) */
  sessionTimeout?: number
  /** Max concurrent SSE sessions (default: 100) */
  maxSessions?: number
}

const DEFAULTS: Required<SSETransportOptions> = {
  basePath: '/mcp/sse',
  pingInterval: 30_000,
  sessionTimeout: 300_000,
  maxSessions: 100,
}

export class SSETransport {
  private sessions: Map<string, SSESession> = new Map()
  private opts: Required<SSETransportOptions>
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private messageHandler: ((message: MCPMessage, sessionId: string) => Promise<MCPMessage>) | null = null

  constructor(options: SSETransportOptions = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  /**
   * Register SSE routes on a Fastify instance.
   * @param server  Fastify server
   * @param handler Function that processes an incoming JSON-RPC message and returns a response
   */
  register(
    server: FastifyInstance,
    handler: (message: MCPMessage, sessionId: string) => Promise<MCPMessage>
  ): void {
    this.messageHandler = handler
    const base = this.opts.basePath

    // ── GET /mcp/sse — SSE stream ──────────────────────────────
    server.get(base, async (request: FastifyRequest, reply: FastifyReply) => {
      if (this.sessions.size >= this.opts.maxSessions) {
        return reply.code(503).send({ error: 'Too many SSE connections' })
      }

      const sessionId = crypto.randomUUID()

      // SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering
      })

      const session: SSESession = {
        id: sessionId,
        reply,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      }
      this.sessions.set(sessionId, session)

      // Send the endpoint event so the client knows where to POST
      const messageUrl = `${base}/message?sessionId=${sessionId}`
      this.sendSSE(reply, 'endpoint', messageUrl)

      // Handle client disconnect
      request.raw.on('close', () => {
        this.sessions.delete(sessionId)
      })

      // Keep the connection open — Fastify will not auto-end because we wrote to raw
    })

    // ── POST /mcp/sse/message — receive JSON-RPC messages ──────
    server.post(`${base}/message`, async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = (request.query as any)?.sessionId as string | undefined

      if (!sessionId || !this.sessions.has(sessionId)) {
        return reply.code(400).send({
          jsonrpc: '2.0' as const,
          id: null,
          error: {
            code: MCPErrorCodes.InvalidRequest,
            message: 'Invalid or missing sessionId',
          },
        })
      }

      const session = this.sessions.get(sessionId)!
      session.lastActivity = Date.now()

      const message = request.body as MCPMessage

      if (!message || message.jsonrpc !== '2.0') {
        return reply.code(400).send({
          jsonrpc: '2.0' as const,
          id: null,
          error: {
            code: MCPErrorCodes.InvalidRequest,
            message: 'Invalid JSON-RPC message',
          },
        })
      }

      // Acknowledge receipt immediately
      reply.code(202).send({ accepted: true })

      // Process and push response through SSE
      try {
        const response = await this.messageHandler!(message, sessionId)
        this.sendSSE(session.reply, 'message', JSON.stringify(response))
      } catch (error) {
        const errorResponse: MCPMessage = {
          jsonrpc: '2.0' as const,
          id: message.id,
          error: {
            code: MCPErrorCodes.InternalError,
            message: 'Internal server error',
            data: error instanceof Error ? error.message : String(error),
          },
        }
        this.sendSSE(session.reply, 'message', JSON.stringify(errorResponse))
      }
    })

    // Start keep-alive pings and session cleanup
    this.startTimers()
  }

  /** Send an SSE event to a specific session. */
  sendToSession(sessionId: string, event: string, data: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    this.sendSSE(session.reply, event, data)
    return true
  }

  /** Broadcast an SSE event to all connected sessions. */
  broadcast(event: string, data: string): void {
    for (const session of this.sessions.values()) {
      this.sendSSE(session.reply, event, data)
    }
  }

  /** Get the number of active SSE sessions. */
  getSessionCount(): number {
    return this.sessions.size
  }

  /** Get all active session IDs. */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  /** Close a specific session. */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    try {
      session.reply.raw.end()
    } catch {
      // Already closed
    }
    this.sessions.delete(sessionId)
    return true
  }

  /** Shut down all sessions and timers. */
  destroy(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId)
    }
  }

  private sendSSE(reply: FastifyReply, event: string, data: string): void {
    try {
      const lines = data.split('\n')
      let payload = `event: ${event}\n`
      for (const line of lines) {
        payload += `data: ${line}\n`
      }
      payload += '\n'
      reply.raw.write(payload)
    } catch {
      // Connection may have been closed
    }
  }

  private startTimers(): void {
    // Keep-alive pings
    this.pingTimer = setInterval(() => {
      const now = Date.now()
      for (const session of this.sessions.values()) {
        this.sendSSE(session.reply, 'ping', String(now))
      }
    }, this.opts.pingInterval)
    if (this.pingTimer.unref) this.pingTimer.unref()

    // Session cleanup (remove timed-out sessions)
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity > this.opts.sessionTimeout) {
          this.closeSession(id)
        }
      }
    }, 60_000)
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }
}
