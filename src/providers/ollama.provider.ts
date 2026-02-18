/**
 * Ollama Local Provider.
 *
 * Supports local LLM models via Ollama API:
 *   - Model listing and management
 *   - Chat completions (streaming + non-streaming)
 *   - Embeddings generation
 *   - Model pull/load
 *   - Health checks
 */

import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';
import crypto from 'crypto';

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modifiedAt: string
}

export class OllamaProvider {
  private baseURL: string
  private timeout: number

  constructor(private config: ProviderConfig) {
    this.baseURL = config.baseURL || 'http://localhost:11434'
    this.timeout = config.timeout || 120000
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now()

    try {
      const ollamaRequest = this.convertToOllamaRequest(request)
      const response = await this.makeRequest('/api/chat', { ...ollamaRequest, stream: false })

      return this.convertFromOllamaResponse(response, request, Date.now() - startTime)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const ollamaRequest = this.convertToOllamaRequest(request)
    const response = await this.makeStreamRequest('/api/chat', { ...ollamaRequest, stream: true })

    return this.convertFromOllamaStream(response, request)
  }

  /** List available local models. */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.makeRequest('/api/tags', null, 'GET')
      return (response.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        digest: m.digest,
        modifiedAt: m.modified_at,
      }))
    } catch {
      return []
    }
  }

  /** Pull a model from the Ollama registry. */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      await this.makeRequest('/api/pull', { name: modelName })
      return true
    } catch {
      return false
    }
  }

  /** Generate embeddings using a local model. */
  async generateEmbedding(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    const response = await this.makeRequest('/api/embeddings', { model, prompt: text })
    return response.embedding || []
  }

  /** Health check — is Ollama running? */
  async healthCheck(): Promise<{ healthy: boolean; version?: string; models?: number }> {
    try {
      const models = await this.listModels()
      return { healthy: true, models: models.length }
    } catch {
      return { healthy: false }
    }
  }

  // ── Conversion ─────────────────────────────────────────────

  private convertToOllamaRequest(request: LLMRequest): any {
    return {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content :
          msg.content.map(c => c.text || '').join(''),
      })),
      options: {
        temperature: request.options.temperature,
        top_p: request.options.topP,
        num_predict: request.options.maxTokens,
        stop: request.options.stop,
      },
    }
  }

  private convertFromOllamaResponse(response: any, request: LLMRequest, latency: number): LLMResponse {
    const content = response.message?.content || ''
    const promptTokens = response.prompt_eval_count || 0
    const completionTokens = response.eval_count || 0

    return {
      id: crypto.randomUUID(),
      requestId: request.id,
      provider: 'ollama',
      model: response.model || request.model,
      content,
      finishReason: response.done ? 'stop' : 'length',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: 0, // Local models are free
      latency,
      metadata: { cacheHit: false },
      createdAt: new Date(),
    }
  }

  private async *convertFromOllamaStream(
    response: Response,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let accumulated = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(l => l.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            const delta = data.message?.content || ''
            accumulated += delta

            yield {
              id: crypto.randomUUID(),
              requestId: request.id,
              content: accumulated,
              delta,
              finishReason: data.done ? 'stop' : undefined,
              createdAt: new Date(),
            }

            if (data.done) return
          } catch { /* skip malformed lines */ }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ── HTTP ───────────────────────────────────────────────────

  private async makeRequest(endpoint: string, data: any, method: string = 'POST'): Promise<any> {
    const url = `${this.baseURL}${endpoint}`
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  private async makeStreamRequest(endpoint: string, data: any): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }
    return response
  }

  private handleError(error: any): Error {
    if (error.cause?.code === 'ECONNREFUSED') {
      return new Error('Ollama is not running. Start it with: ollama serve')
    }
    return new Error(`Ollama error: ${error.message}`)
  }
}
