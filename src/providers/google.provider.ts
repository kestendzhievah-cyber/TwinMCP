import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';
import crypto from 'crypto';

export class GoogleProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(private config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1';
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error('Google API key is not configured. Set GOOGLE_API_KEY environment variable.');
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.ensureApiKey();
    try {
      const googleRequest = this.convertToGoogleRequest(request);
      
      const response = await this.makeRequest(`/models/${request.model}:generateContent`, googleRequest);
      
      return this.convertFromGoogleResponse(response, request);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    this.ensureApiKey();
    const googleRequest = this.convertToGoogleRequest(request);

    const url = `${this.baseURL}/models/${request.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const httpResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleRequest),
    });

    if (!httpResponse.ok) {
      throw new Error(`Google API error: ${httpResponse.status} ${httpResponse.statusText}`);
    }

    if (!httpResponse.body) {
      throw new Error('Google API returned no body for streaming request');
    }

    return this.convertFromGoogleSSEStream(httpResponse.body, request);
  }

  private convertToGoogleRequest(request: LLMRequest): any {
    // Conversion des messages au format Google
    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{
        text: typeof msg.content === 'string' ? msg.content : 
          (msg.content || []).map(c => c.text || '').join('')
      }]
    }));

    return {
      contents,
      generationConfig: {
        temperature: request.options.temperature,
        maxOutputTokens: request.options.maxTokens,
        topP: request.options.topP,
        stopSequences: request.options.stop
      }
    };
  }

  private convertFromGoogleResponse(response: any, request: LLMRequest): LLMResponse {
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    return {
      id: response.id || crypto.randomUUID(),
      requestId: request.id,
      provider: 'google',
      model: request.model,
      content,
      finishReason: this.mapFinishReason(candidate?.finishReason),
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      },
      cost: 0, // Calculé dans le service principal
      latency: 0, // Calculé dans le service principal
      metadata: {},
      createdAt: new Date()
    };
  }

  private async *convertFromGoogleSSEStream(
    body: ReadableStream<Uint8Array>,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const candidate = chunk.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text || '';

            if (content) {
              accumulatedContent += content;
              yield {
                id: crypto.randomUUID(),
                requestId: request.id,
                content: accumulatedContent,
                delta: content,
                finishReason: candidate?.finishReason ? this.mapFinishReason(candidate.finishReason) : undefined,
                usage: chunk.usageMetadata ? {
                  promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                  completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: chunk.usageMetadata.totalTokenCount || 0,
                } : undefined,
                createdAt: new Date(),
              };
            }

            if (candidate?.finishReason) {
              return;
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    const url = `${this.baseURL}${endpoint}?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
    const mapping: Record<string, LLMResponse['finishReason']> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter'
    };
    
    return mapping[reason] || 'stop';
  }

  private handleError(error: any): Error {
    if (error.status === 429) {
      return new Error('Rate limit exceeded');
    } else if (error.status === 403) {
      return new Error('Invalid API key or insufficient permissions');
    } else if (error.status === 400) {
      return new Error('Invalid request');
    }
    
    return new Error(`Google API error: ${error.message}`);
  }
}
