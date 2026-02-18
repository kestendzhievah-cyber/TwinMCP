import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';
import crypto from 'crypto';

export class GoogleProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(private config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1';
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const googleRequest = this.convertToGoogleRequest(request);
      
      const response = await this.makeRequest(`/models/${request.model}:generateContent`, googleRequest);
      
      return this.convertFromGoogleResponse(response, request);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const googleRequest = this.convertToGoogleRequest(request);
    
    const response = await this.makeRequest(`/models/${request.model}:streamGenerateContent`, googleRequest);
    
    return this.convertFromGoogleStream(response, request);
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

  private async *convertFromGoogleStream(
    response: any,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    let accumulatedContent = '';

    for await (const chunk of response) {
      const candidate = chunk.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || '';
      
      if (content) {
        accumulatedContent += content;
        
        yield {
          id: chunk.id || crypto.randomUUID(),
          requestId: request.id,
          content: accumulatedContent,
          delta: content,
          finishReason: candidate?.finishReason ? this.mapFinishReason(candidate.finishReason) : undefined,
          createdAt: new Date()
        };
      }

      if (candidate?.finishReason) {
        break;
      }
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
