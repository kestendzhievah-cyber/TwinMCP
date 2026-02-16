/**
 * Stream Resilience Service.
 *
 * Adds reconnection and backpressure handling to LLM streams:
 *   - Automatic reconnection with exponential backoff
 *   - Backpressure detection and flow control
 *   - Chunk buffering during reconnection
 *   - Stream health monitoring
 *   - Graceful degradation
 */

export interface StreamResilenceConfig {
  maxReconnectAttempts: number
  initialReconnectDelayMs: number
  maxReconnectDelayMs: number
  backpressureThreshold: number  // buffer size before applying backpressure
  bufferMaxSize: number
  healthCheckIntervalMs: number
  chunkTimeoutMs: number
}

export interface StreamState {
  id: string
  status: 'connected' | 'reconnecting' | 'backpressured' | 'disconnected' | 'completed'
  reconnectAttempts: number
  bufferedChunks: number
  totalChunksReceived: number
  totalChunksSent: number
  lastChunkAt?: string
  startedAt: string
  errors: string[]
}

export interface StreamChunk {
  id: string
  content: string
  index: number
  timestamp: string
}

export type StreamProducerFn = (fromIndex: number) => AsyncIterable<StreamChunk>
export type ChunkConsumerFn = (chunk: StreamChunk) => Promise<void>

const DEFAULT_CONFIG: StreamResilenceConfig = {
  maxReconnectAttempts: 5,
  initialReconnectDelayMs: 500,
  maxReconnectDelayMs: 30000,
  backpressureThreshold: 50,
  bufferMaxSize: 200,
  healthCheckIntervalMs: 5000,
  chunkTimeoutMs: 30000,
}

export class StreamResilienceService {
  private streams: Map<string, StreamState> = new Map()
  private buffers: Map<string, StreamChunk[]> = new Map()
  private config: StreamResilenceConfig
  private idCounter = 0

  constructor(config: Partial<StreamResilenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Get config. */
  getConfig(): StreamResilenceConfig {
    return { ...this.config }
  }

  // ── Stream Management ──────────────────────────────────────

  /** Create a new resilient stream. */
  createStream(id?: string): StreamState {
    const streamId = id || `stream-${++this.idCounter}`
    const state: StreamState = {
      id: streamId,
      status: 'connected',
      reconnectAttempts: 0,
      bufferedChunks: 0,
      totalChunksReceived: 0,
      totalChunksSent: 0,
      startedAt: new Date().toISOString(),
      errors: [],
    }
    this.streams.set(streamId, state)
    this.buffers.set(streamId, [])
    return state
  }

  /** Get stream state. */
  getStream(id: string): StreamState | undefined {
    return this.streams.get(id)
  }

  /** List all streams. */
  getStreams(): StreamState[] {
    return Array.from(this.streams.values())
  }

  /** Close a stream. */
  closeStream(id: string): boolean {
    const state = this.streams.get(id)
    if (!state) return false
    state.status = 'disconnected'
    this.buffers.delete(id)
    return true
  }

  /** Remove a stream. */
  removeStream(id: string): boolean {
    this.buffers.delete(id)
    return this.streams.delete(id)
  }

  // ── Chunk Processing ───────────────────────────────────────

  /** Receive a chunk into the stream buffer. */
  receiveChunk(streamId: string, chunk: StreamChunk): { accepted: boolean; backpressure: boolean } {
    const state = this.streams.get(streamId)
    if (!state || state.status === 'disconnected' || state.status === 'completed') {
      return { accepted: false, backpressure: false }
    }

    const buffer = this.buffers.get(streamId)!
    state.totalChunksReceived++
    state.lastChunkAt = chunk.timestamp

    // Check buffer overflow
    if (buffer.length >= this.config.bufferMaxSize) {
      state.errors.push(`Buffer overflow at chunk ${chunk.index}`)
      return { accepted: false, backpressure: true }
    }

    buffer.push(chunk)
    state.bufferedChunks = buffer.length

    // Check backpressure threshold
    const backpressure = buffer.length >= this.config.backpressureThreshold
    if (backpressure && state.status === 'connected') {
      state.status = 'backpressured'
    }

    return { accepted: true, backpressure }
  }

  /** Consume chunks from the buffer. */
  consumeChunks(streamId: string, count?: number): StreamChunk[] {
    const state = this.streams.get(streamId)
    if (!state) return []

    const buffer = this.buffers.get(streamId)!
    const toConsume = count ? Math.min(count, buffer.length) : buffer.length
    const chunks = buffer.splice(0, toConsume)

    state.totalChunksSent += chunks.length
    state.bufferedChunks = buffer.length

    // Release backpressure if below threshold
    if (state.status === 'backpressured' && buffer.length < this.config.backpressureThreshold * 0.5) {
      state.status = 'connected'
    }

    return chunks
  }

  /** Get buffer size for a stream. */
  getBufferSize(streamId: string): number {
    return this.buffers.get(streamId)?.length || 0
  }

  // ── Reconnection ───────────────────────────────────────────

  /** Simulate a disconnection and attempt reconnection. */
  async reconnect(streamId: string, producer: StreamProducerFn): Promise<boolean> {
    const state = this.streams.get(streamId)
    if (!state) return false

    state.status = 'reconnecting'

    for (let attempt = 1; attempt <= this.config.maxReconnectAttempts; attempt++) {
      state.reconnectAttempts = attempt

      const delay = Math.min(
        this.config.initialReconnectDelayMs * Math.pow(2, attempt - 1),
        this.config.maxReconnectDelayMs
      )

      await this.delay(delay)

      try {
        // Try to reconnect from last received chunk
        const fromIndex = state.totalChunksReceived
        const stream = producer(fromIndex)

        // Read first chunk to verify connection
        const iterator = stream[Symbol.asyncIterator]()
        const first = await iterator.next()

        if (!first.done && first.value) {
          this.receiveChunk(streamId, first.value)
          state.status = 'connected'
          state.reconnectAttempts = 0
          return true
        }
      } catch (err) {
        state.errors.push(`Reconnect attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    state.status = 'disconnected'
    return false
  }

  /** Get reconnect delay for a given attempt (exponential backoff). */
  getReconnectDelay(attempt: number): number {
    return Math.min(
      this.config.initialReconnectDelayMs * Math.pow(2, attempt - 1),
      this.config.maxReconnectDelayMs
    )
  }

  /** Check if a stream can still reconnect. */
  canReconnect(streamId: string): boolean {
    const state = this.streams.get(streamId)
    if (!state) return false
    return state.reconnectAttempts < this.config.maxReconnectAttempts && state.status !== 'completed'
  }

  // ── Health Monitoring ──────────────────────────────────────

  /** Check stream health. */
  checkHealth(streamId: string): { healthy: boolean; reason?: string } {
    const state = this.streams.get(streamId)
    if (!state) return { healthy: false, reason: 'Stream not found' }
    if (state.status === 'disconnected') return { healthy: false, reason: 'Stream disconnected' }
    if (state.status === 'backpressured') return { healthy: false, reason: 'Backpressure active' }

    if (state.lastChunkAt) {
      const elapsed = Date.now() - new Date(state.lastChunkAt).getTime()
      if (elapsed > this.config.chunkTimeoutMs) {
        return { healthy: false, reason: `No chunks received for ${elapsed}ms` }
      }
    }

    return { healthy: true }
  }

  /** Mark stream as completed. */
  completeStream(streamId: string): boolean {
    const state = this.streams.get(streamId)
    if (!state) return false
    state.status = 'completed'
    return true
  }

  // ── Helpers ────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const streamResilienceService = new StreamResilienceService()
