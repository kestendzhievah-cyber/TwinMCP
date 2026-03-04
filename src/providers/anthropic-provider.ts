import Anthropic from '@anthropic-ai/sdk';
import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';
import crypto from 'crypto';

export class AnthropicProvider {
  private client: Anthropic | null = null;

  constructor(private config: ProviderConfig) {
    // Client will be initialized lazily when needed
  }

  private getClient(): Anthropic {
    if (!this.client) {
      if (!this.config.apiKey) {
        throw new Error('Anthropic API key is not configured. Set ANTHROPIC_API_KEY environment variable.');
      }
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.retries,
      });
    }
    return this.client;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const anthropicRequest = this.convertToAnthropicRequest(request);
      
      const response = await this.getClient().messages.create(anthropicRequest);
      
      return this.convertFromAnthropicResponse(response, request);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    try {
      const anthropicRequest = this.convertToAnthropicRequest(request, { stream: true });
      
      const stream = await this.getClient().messages.create(anthropicRequest) as unknown as AsyncIterable<any>;
      
      return this.convertFromAnthropicStream(stream, request);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private convertToAnthropicRequest(request: LLMRequest, options: any = {}): any {
    // Conversion des messages au format Anthropic
    const messages = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : 
          (msg.content || []).map(c => c.type === 'text' ? c.text : '').join('')
      }));

    const systemMessage = request.messages.find(msg => msg.role === 'system');

    return {
      model: request.model,
      messages,
      system: systemMessage?.content,
      max_tokens: request.options.maxTokens || 4096,
      temperature: request.options.temperature,
      top_p: request.options.topP,
      stop_sequences: request.options.stop,
      stream: options.stream || false,
      ...options
    };
  }

  private convertFromAnthropicResponse(response: any, request: LLMRequest): LLMResponse {
    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    const result: LLMResponse = {
      id: response.id,
      requestId: request.id,
      provider: 'anthropic',
      model: response.model,
      content,
      finishReason: this.mapFinishReason(response.stop_reason),
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      cost: 0, // Calculé dans le service principal
      latency: 0, // Calculé dans le service principal
      metadata: {},
      createdAt: new Date()
    };

    // Extract tool_use blocks (Anthropic's equivalent of function calling)
    const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      result.toolCalls = toolUseBlocks.map((block: any) => ({
        id: block.id,
        type: 'function' as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      }));
      // Backward compatibility
      result.functionCall = {
        name: toolUseBlocks[0].name,
        arguments: JSON.stringify(toolUseBlocks[0].input),
      };
    }

    return result;
  }

  private async *convertFromAnthropicStream(
    stream: AsyncIterable<any>,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    let accumulatedContent = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        accumulatedContent += chunk.delta.text;
        
        yield {
          id: crypto.randomUUID(),
          requestId: request.id,
          content: accumulatedContent,
          delta: chunk.delta.text,
          createdAt: new Date()
        };
      }

      if (chunk.type === 'message_delta') {
        yield {
          id: crypto.randomUUID(),
          requestId: request.id,
          content: accumulatedContent,
          delta: '',
          finishReason: chunk.delta?.stop_reason ? this.mapFinishReason(chunk.delta.stop_reason) : undefined,
          usage: chunk.usage ? {
            promptTokens: 0,
            completionTokens: chunk.usage.output_tokens || 0,
            totalTokens: chunk.usage.output_tokens || 0,
          } : undefined,
          createdAt: new Date()
        };
      }

      if (chunk.type === 'message_stop') {
        break;
      }
    }
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
    const mapping: Record<string, LLMResponse['finishReason']> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop',
      'tool_use': 'function_call'
    };
    
    return mapping[reason] || 'stop';
  }

  private handleError(error: any): Error {
    if (error.type === 'insufficient_quota') {
      return new Error('Insufficient API quota');
    } else if (error.type === 'rate_limit_error') {
      return new Error('Rate limit exceeded');
    } else if (error.type === 'authentication_error') {
      return new Error('Invalid API key');
    }
    
    return new Error(`Anthropic API error: ${error.message}`);
  }
}
