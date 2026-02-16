import { SSETransport } from '../../../lib/mcp/servers/sse-transport'
import { HttpMCPServer } from '../../../lib/mcp/servers/http-mcp-server'
import { MCPServerTool } from '../../../lib/mcp/types'

function makeEchoTool(): MCPServerTool {
  return {
    name: 'echo',
    description: 'Echo tool',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    run: async (args: any) => ({ echo: args.text || 'hello' }),
  }
}

function createServer() {
  return new HttpMCPServer({
    port: 0,
    host: '127.0.0.1',
    cors: false,
    rateLimit: false,
    tools: [makeEchoTool()],
  })
}

describe('SSETransport', () => {
  let server: HttpMCPServer
  let fastify: ReturnType<HttpMCPServer['getServerInstance']>

  beforeEach(async () => {
    server = createServer()
    fastify = server.getServerInstance()
    await fastify.ready()
  })

  afterEach(async () => {
    server.getSSETransport().destroy()
    await fastify.close()
  })

  it('SSE routes are registered on the server', async () => {
    // Verify the routes exist by checking the POST endpoint (which returns immediately)
    const res = await fastify.inject({
      method: 'POST',
      url: '/mcp/sse/message',
      payload: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    })
    // Should get 400 (no sessionId) rather than 404 (route not found)
    expect(res.statusCode).toBe(400)
  })

  it('POST /mcp/sse/message without sessionId returns 400', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/mcp/sse/message',
      payload: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error.message).toContain('sessionId')
  })

  it('POST /mcp/sse/message with invalid sessionId returns 400', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/mcp/sse/message?sessionId=nonexistent',
      payload: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    })

    expect(res.statusCode).toBe(400)
  })

  it('getSessionCount starts at 0', () => {
    expect(server.getSSETransport().getSessionCount()).toBe(0)
  })

  it('getSessionIds returns empty array initially', () => {
    expect(server.getSSETransport().getSessionIds()).toEqual([])
  })

  it('destroy cleans up all sessions', () => {
    const transport = server.getSSETransport()
    transport.destroy()
    expect(transport.getSessionCount()).toBe(0)
  })
})

describe('SSETransport — unit', () => {
  it('respects maxSessions option', () => {
    const transport = new SSETransport({ maxSessions: 2 })
    // Just verify it constructs without error
    expect(transport.getSessionCount()).toBe(0)
    transport.destroy()
  })

  it('closeSession returns false for unknown session', () => {
    const transport = new SSETransport()
    expect(transport.closeSession('unknown')).toBe(false)
    transport.destroy()
  })

  it('sendToSession returns false for unknown session', () => {
    const transport = new SSETransport()
    expect(transport.sendToSession('unknown', 'test', 'data')).toBe(false)
    transport.destroy()
  })
})
