import { StreamResilienceService } from '../../src/services/llm/stream-resilience.service'

describe('StreamResilienceService', () => {
  let service: StreamResilienceService

  beforeEach(() => {
    service = new StreamResilienceService({
      maxReconnectAttempts: 3,
      initialReconnectDelayMs: 10,
      maxReconnectDelayMs: 100,
      backpressureThreshold: 5,
      bufferMaxSize: 10,
      healthCheckIntervalMs: 1000,
      chunkTimeoutMs: 5000,
    })
  })

  function makeChunk(index: number): { id: string; content: string; index: number; timestamp: string } {
    return { id: `c-${index}`, content: `chunk-${index}`, index, timestamp: new Date().toISOString() }
  }

  describe('Stream management', () => {
    it('creates a stream', () => {
      const state = service.createStream('s1')
      expect(state.id).toBe('s1')
      expect(state.status).toBe('connected')
    })

    it('auto-generates ID', () => {
      const state = service.createStream()
      expect(state.id).toBeDefined()
    })

    it('gets a stream', () => {
      service.createStream('s1')
      expect(service.getStream('s1')).toBeDefined()
    })

    it('lists streams', () => {
      service.createStream('s1')
      service.createStream('s2')
      expect(service.getStreams().length).toBe(2)
    })

    it('closes a stream', () => {
      service.createStream('s1')
      expect(service.closeStream('s1')).toBe(true)
      expect(service.getStream('s1')!.status).toBe('disconnected')
    })

    it('removes a stream', () => {
      service.createStream('s1')
      expect(service.removeStream('s1')).toBe(true)
      expect(service.getStream('s1')).toBeUndefined()
    })
  })

  describe('Chunk processing', () => {
    it('receives chunks', () => {
      service.createStream('s1')
      const result = service.receiveChunk('s1', makeChunk(0))
      expect(result.accepted).toBe(true)
      expect(result.backpressure).toBe(false)
      expect(service.getBufferSize('s1')).toBe(1)
    })

    it('rejects chunks for disconnected streams', () => {
      service.createStream('s1')
      service.closeStream('s1')
      const result = service.receiveChunk('s1', makeChunk(0))
      expect(result.accepted).toBe(false)
    })

    it('rejects chunks for unknown streams', () => {
      const result = service.receiveChunk('unknown', makeChunk(0))
      expect(result.accepted).toBe(false)
    })

    it('consumes chunks from buffer', () => {
      service.createStream('s1')
      service.receiveChunk('s1', makeChunk(0))
      service.receiveChunk('s1', makeChunk(1))
      service.receiveChunk('s1', makeChunk(2))

      const chunks = service.consumeChunks('s1', 2)
      expect(chunks.length).toBe(2)
      expect(service.getBufferSize('s1')).toBe(1)
    })

    it('consumes all chunks when no count specified', () => {
      service.createStream('s1')
      service.receiveChunk('s1', makeChunk(0))
      service.receiveChunk('s1', makeChunk(1))

      const chunks = service.consumeChunks('s1')
      expect(chunks.length).toBe(2)
      expect(service.getBufferSize('s1')).toBe(0)
    })

    it('tracks total received and sent', () => {
      service.createStream('s1')
      service.receiveChunk('s1', makeChunk(0))
      service.receiveChunk('s1', makeChunk(1))
      service.consumeChunks('s1', 1)

      const state = service.getStream('s1')!
      expect(state.totalChunksReceived).toBe(2)
      expect(state.totalChunksSent).toBe(1)
    })
  })

  describe('Backpressure', () => {
    it('triggers backpressure when buffer exceeds threshold', () => {
      service.createStream('s1')
      for (let i = 0; i < 5; i++) {
        service.receiveChunk('s1', makeChunk(i))
      }
      const result = service.receiveChunk('s1', makeChunk(5))
      expect(result.backpressure).toBe(true)
      expect(service.getStream('s1')!.status).toBe('backpressured')
    })

    it('releases backpressure after consuming', () => {
      service.createStream('s1')
      for (let i = 0; i < 6; i++) {
        service.receiveChunk('s1', makeChunk(i))
      }
      expect(service.getStream('s1')!.status).toBe('backpressured')

      service.consumeChunks('s1', 5)
      expect(service.getStream('s1')!.status).toBe('connected')
    })

    it('rejects chunks when buffer is full', () => {
      service.createStream('s1')
      for (let i = 0; i < 10; i++) {
        service.receiveChunk('s1', makeChunk(i))
      }
      const result = service.receiveChunk('s1', makeChunk(10))
      expect(result.accepted).toBe(false)
    })
  })

  describe('Reconnection', () => {
    it('reconnects successfully', async () => {
      service.createStream('s1')
      service.receiveChunk('s1', makeChunk(0))

      const producer = async function* (fromIndex: number) {
        yield makeChunk(fromIndex)
      }

      const result = await service.reconnect('s1', producer)
      expect(result).toBe(true)
      expect(service.getStream('s1')!.status).toBe('connected')
    })

    it('fails after max attempts', async () => {
      service.createStream('s1')

      const producer = async function* (_fromIndex: number) {
        throw new Error('Connection refused')
        yield makeChunk(0) // unreachable
      }

      const result = await service.reconnect('s1', producer)
      expect(result).toBe(false)
      expect(service.getStream('s1')!.status).toBe('disconnected')
      expect(service.getStream('s1')!.errors.length).toBe(3)
    })

    it('computes exponential backoff delay', () => {
      expect(service.getReconnectDelay(1)).toBe(10)
      expect(service.getReconnectDelay(2)).toBe(20)
      expect(service.getReconnectDelay(3)).toBe(40)
    })

    it('caps delay at max', () => {
      expect(service.getReconnectDelay(20)).toBeLessThanOrEqual(100)
    })

    it('checks reconnect eligibility', () => {
      service.createStream('s1')
      expect(service.canReconnect('s1')).toBe(true)

      service.completeStream('s1')
      expect(service.canReconnect('s1')).toBe(false)
    })
  })

  describe('Health monitoring', () => {
    it('reports healthy stream', () => {
      service.createStream('s1')
      service.receiveChunk('s1', makeChunk(0))
      expect(service.checkHealth('s1').healthy).toBe(true)
    })

    it('reports unhealthy for disconnected', () => {
      service.createStream('s1')
      service.closeStream('s1')
      expect(service.checkHealth('s1').healthy).toBe(false)
    })

    it('reports unhealthy for backpressured', () => {
      service.createStream('s1')
      for (let i = 0; i < 6; i++) service.receiveChunk('s1', makeChunk(i))
      expect(service.checkHealth('s1').healthy).toBe(false)
    })

    it('returns unhealthy for unknown stream', () => {
      expect(service.checkHealth('unknown').healthy).toBe(false)
    })
  })

  describe('Stream completion', () => {
    it('marks stream as completed', () => {
      service.createStream('s1')
      expect(service.completeStream('s1')).toBe(true)
      expect(service.getStream('s1')!.status).toBe('completed')
    })
  })
})
