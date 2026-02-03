import OpenAI from 'openai';
import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';

export class OpenAIProvider {
  private client: OpenAI | null = null;

  constructor(private config: ProviderConfig) {
    // Client will be initialized lazily when needed
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.retries
      });
    }
    return this.client;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const openaiRequest = this.convertToOpenAIRequest(request);
      
      const response = await this.getClient().chat.completions.create(openaiRequest);
      
      return this.convertFromOpenAIResponse(response, request);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const openaiRequest = this.convertToOpenAIRequest(request, { stream: true });
    
    const stream = this.getClient().chat.completions.create(openaiRequest);
    
    return this.convertFromOpenAIStream(stream, request);
  }

  private convertToOpenAIRequest(request: LLMRequest, options: any = {}): any {
    return {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
        function_call: msg.functionCall
      })),
      temperature: request.options.temperature,
      max_tokens: request.options.maxTokens,
      top_p: request.options.topP,
      frequency_penalty: request.options.frequencyPenalty,
      presence_penalty: request.options.presencePenalty,
      stop: request.options.stop,
      functions: request.options.functions,
      function_call: request.options.functionCall,
      stream: options.stream || false,
      ...options
    };
  }

  private convertFromOpenAIResponse(response: any, request: LLMRequest): LLMResponse {
    const choice = response.choices[0];
    
    return {
      id: response.id,
      requestId: request.id,
      provider: 'openai',
      model: response.model,
      content: choice.message.content || '',
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      cost: 0, // Calculé dans le service principal
      latency: 0, // Calculé dans le service principal
      metadata: {},
      functionCall: choice.message.function_call ? {
        name: choice.message.function_call.name,
        arguments: choice.message.function_call.arguments
      } : undefined,
      createdAt: new Date()
    };
  }

  private async *convertFromOpenAIStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      
      yield {
        id: chunk.id,
        requestId: request.id,
        content: choice.delta.content || '',
        delta: choice.delta.content || '',
        finishReason: choice.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens
        } : undefined,
        createdAt: new Date()
      };
    }
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
    const mapping: Record<string, LLMResponse['finishReason']> = {
      'stop': 'stop',
      'length': 'length',
      'function_call': 'function_call',
      'content_filter': 'content_filter'
    };
    
    return mapping[reason] || 'stop';
  }

  private handleError(error: any): Error {
    if (error.code === 'insufficient_quota') {
      return new Error('Insufficient API quota');
    } else if (error.code === 'rate_limit_exceeded') {
      return new Error('Rate limit exceeded');
    } else if (error.code === 'invalid_api_key') {
      return new Error('Invalid API key');
    }
    
    return new Error(`OpenAI API error: ${error.message}`);
  }
}
