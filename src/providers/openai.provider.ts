import OpenAI from 'openai';
import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';

export class OpenAIProvider {
  private client: OpenAI | null = null;

  constructor(private config: ProviderConfig) {
    // Client will be initialized lazily when needed
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY environment variable.');
      }
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
    
    const stream = this.getClient().chat.completions.create(openaiRequest) as any;
    
    return this.convertFromOpenAIStream(stream, request);
  }

  private convertToOpenAIRequest(request: LLMRequest, options: any = {}): any {
    const openaiRequest: any = {
      model: request.model,
      messages: request.messages.map(msg => {
        const openaiMsg: any = {
          role: msg.role === 'tool' ? 'tool' : msg.role,
          content: msg.content,
        };
        if (msg.name) openaiMsg.name = msg.name;
        if (msg.tool_call_id) openaiMsg.tool_call_id = msg.tool_call_id;
        if (msg.toolCalls) {
          openaiMsg.tool_calls = msg.toolCalls;
        }
        return openaiMsg;
      }),
      temperature: request.options.temperature,
      max_tokens: request.options.maxTokens,
      top_p: request.options.topP,
      frequency_penalty: request.options.frequencyPenalty,
      presence_penalty: request.options.presencePenalty,
      stop: request.options.stop,
      stream: options.stream || false,
    };

    // New tools API (preferred)
    if (request.options.tools && request.options.tools.length > 0) {
      openaiRequest.tools = request.options.tools;
      if (request.options.toolChoice) {
        openaiRequest.tool_choice = request.options.toolChoice;
      }
    }
    // Legacy functions API (backward compatibility)
    else if (request.options.functions && request.options.functions.length > 0) {
      openaiRequest.tools = request.options.functions.map(fn => ({
        type: 'function' as const,
        function: fn
      }));
      if (request.options.functionCall) {
        if (typeof request.options.functionCall === 'string') {
          openaiRequest.tool_choice = request.options.functionCall;
        } else {
          openaiRequest.tool_choice = {
            type: 'function',
            function: { name: request.options.functionCall.name }
          };
        }
      }
    }

    return openaiRequest;
  }

  private convertFromOpenAIResponse(response: any, request: LLMRequest): LLMResponse {
    const choice = response.choices[0];
    
    const result: LLMResponse = {
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
      createdAt: new Date()
    };

    // Handle tool_calls (new API)
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }));
      // Backward compatibility
      result.functionCall = {
        name: choice.message.tool_calls[0].function.name,
        arguments: choice.message.tool_calls[0].function.arguments
      };
    }
    // Legacy function_call
    else if (choice.message.function_call) {
      result.functionCall = {
        name: choice.message.function_call.name,
        arguments: choice.message.function_call.arguments
      };
    }

    return result;
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
      'tool_calls': 'tool_calls',
      'content_filter': 'content_filter'
    };
    
    return mapping[reason] || 'stop';
  }

  private handleError(error: any): Error {
    if (error.code === 'insufficient_quota') {
      return new Error('Insufficient API quota. Check your OpenAI billing.');
    } else if (error.code === 'rate_limit_exceeded') {
      return new Error('Rate limit exceeded. Please retry after a moment.');
    } else if (error.code === 'invalid_api_key') {
      return new Error('Invalid OpenAI API key. Check OPENAI_API_KEY environment variable.');
    } else if (error.code === 'model_not_found') {
      return new Error(`Model not found. Verify the model ID is correct.`);
    } else if (error.status === 401) {
      return new Error('OpenAI authentication failed. Check your API key.');
    } else if (error.status === 429) {
      return new Error('OpenAI rate limit exceeded. Please retry later.');
    }
    
    return new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
  }
}
