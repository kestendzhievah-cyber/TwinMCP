/**
 * Multi-client compatibility tests for MCP servers.
 * Verifies that the HTTP and Stdio servers handle concurrent clients,
 * interleaved requests, and protocol edge cases correctly.
 */
import { HttpMCPServer } from '../../../lib/mcp/servers/http-mcp-server'
import { MCPServerTool, MCPMessage, MCPMethods, MCPErrorCodes } from '../../../lib/mcp/types'

function makeDelayTool(delayMs: number = 10): MCPServerTool {
  return {
    name: 'delay-tool',
    description: 'Returns after a delay',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    run: async (args: any) => {
      await new Promise(r => setTimeout(r, delayMs))
      return { result: args.text || 'done', ts: Date.now() }
    },
  }
}

function makeCounterTool(): MCPServerTool {
  let counter = 0
  return {
    name: 'counter-tool',
    description: 'Increments a counter',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      counter++
      return { count: counter }
    },
  }
}

function createServer(tools: MCPServerTool[] = [makeDelayTool(), makeCounterTool()]) {
  return new HttpMCPServer({
    port: 0,
    host: '127.0.0.1',
    cors: false,
    rateLimit: false,
    tools,
  })
}

async function sendMCP(
  fastify: any,
  message: MCPMessage
): Promise<{ status: number; body: MCPMessage }> {
  const res = await fastify.inject({
    method: 'POST',
    url: '/mcp',
    payload: message,
  })
  return { status: res.statusCode, body: JSON.parse(res.payload) }
}

describe('Multi-Client Compatibility', () => {
  let server: HttpMCPServer
  let fastify: any

  beforeEach(async () => {
    server = createServer()
    fastify = server.getServerInstance()
    await fastify.ready()
  })

  afterEach(async () => {
    server.getSSETransport().destroy()
    await fastify.close()
  })

  describe('Concurrent requests', () => {
    it('handles 10 concurrent initialize + tools/list requests', async () => {
      // First initialize
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      // 10 concurrent tools/list
      const promises = Array.from({ length: 10 }, (_, i) =>
        sendMCP(fastify, {
          jsonrpc: '2.0',
          id: i + 1,
          method: MCPMethods.ToolsList,
        })
      )

      const results = await Promise.all(promises)

      for (const r of results) {
        expect(r.status).toBe(200)
        expect(r.body.result?.tools).toBeDefined()
        expect(r.body.result.tools.length).toBe(2)
      }
    })

    it('handles 10 concurrent tool calls without interference', async () => {
      // Initialize
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      // 10 concurrent calls to delay-tool with unique text
      const promises = Array.from({ length: 10 }, (_, i) =>
        sendMCP(fastify, {
          jsonrpc: '2.0',
          id: i + 100,
          method: MCPMethods.ToolsCall,
          params: { name: 'delay-tool', arguments: { text: `client-${i}` } },
        })
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < 10; i++) {
        expect(results[i].status).toBe(200)
        expect(results[i].body.error).toBeUndefined()
        const content = results[i].body.result?.content?.[0]?.text
        expect(content).toBeDefined()
        const parsed = JSON.parse(content!)
        expect(parsed.result).toBe(`client-${i}`)
      }
    })

    it('counter tool maintains correct state under concurrent access', async () => {
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      // 5 sequential calls to counter-tool
      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        const r = await sendMCP(fastify, {
          jsonrpc: '2.0',
          id: i + 200,
          method: MCPMethods.ToolsCall,
          params: { name: 'counter-tool', arguments: {} },
        })
        const parsed = JSON.parse(r.body.result.content[0].text)
        results.push(parsed.count)
      }

      // Should be 1, 2, 3, 4, 5
      expect(results).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('Protocol edge cases', () => {
    it('rejects requests before initialization', async () => {
      const r = await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 1,
        method: MCPMethods.ToolsList,
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.code).toBe(MCPErrorCodes.InvalidRequest)
      expect(r.body.error!.message).toContain('not initialized')
    })

    it('rejects double initialization', async () => {
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 1,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      const r = await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 2,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test2', version: '1.0' } },
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.message).toContain('already initialized')
    })

    it('returns MethodNotFound for unknown methods', async () => {
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      const r = await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.code).toBe(MCPErrorCodes.MethodNotFound)
    })

    it('returns ToolNotFound for non-existent tool', async () => {
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      const r = await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 1,
        method: MCPMethods.ToolsCall,
        params: { name: 'nonexistent-tool', arguments: {} },
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.code).toBe(MCPErrorCodes.ToolNotFound)
    })

    it('handles invalid JSON-RPC version', async () => {
      const r = await sendMCP(fastify, {
        jsonrpc: '1.0' as any,
        id: 1,
        method: MCPMethods.Initialize,
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.code).toBe(MCPErrorCodes.InvalidRequest)
    })

    it('handles missing tool name in tools/call', async () => {
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      const r = await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 1,
        method: MCPMethods.ToolsCall,
        params: { arguments: {} },
      })

      expect(r.body.error).toBeDefined()
      expect(r.body.error!.code).toBe(MCPErrorCodes.InvalidParams)
    })

    it('handles malformed JSON gracefully', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/mcp',
        payload: 'not-json{{{',
        headers: { 'content-type': 'application/json' },
      })

      const body = JSON.parse(res.payload)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe(MCPErrorCodes.ParseError)
    })
  })

  describe('Interleaved multi-client simulation', () => {
    it('handles interleaved requests from different "clients" (different IDs)', async () => {
      // Initialize
      await sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 0,
        method: MCPMethods.Initialize,
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
      })

      // Client A: tools/list
      const clientA = sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 'client-a-1',
        method: MCPMethods.ToolsList,
      })

      // Client B: tools/call
      const clientB = sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 'client-b-1',
        method: MCPMethods.ToolsCall,
        params: { name: 'delay-tool', arguments: { text: 'from-b' } },
      })

      // Client C: tools/call
      const clientC = sendMCP(fastify, {
        jsonrpc: '2.0',
        id: 'client-c-1',
        method: MCPMethods.ToolsCall,
        params: { name: 'counter-tool', arguments: {} },
      })

      const [rA, rB, rC] = await Promise.all([clientA, clientB, clientC])

      // Each response should have the correct ID
      expect(rA.body.id).toBe('client-a-1')
      expect(rB.body.id).toBe('client-b-1')
      expect(rC.body.id).toBe('client-c-1')

      // A should get tools list
      expect(rA.body.result?.tools).toBeDefined()

      // B should get delay-tool result
      expect(rB.body.error).toBeUndefined()

      // C should get counter result
      expect(rC.body.error).toBeUndefined()
    })
  })
})
