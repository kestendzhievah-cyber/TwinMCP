// Types et interfaces pour l'intégration LLM

export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'cohere' | 'local';
  models: LLMModel[];
  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    maxTokens: number;
    inputCost: number; // per 1K tokens
    outputCost: number; // per 1K tokens
  };
  config: ProviderConfig;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  trainingCutoff?: Date;
  capabilities: string[];
  pricing: {
    input: number; // per 1K tokens
    output: number; // per 1K tokens
  };
  performance: {
    latency: number; // average ms
    quality: number; // 1-10 score
  };
}

export interface LLMRequest {
  id: string;
  provider: string;
  model: string;
  messages: LLMMessage[];
  context?: {
    assembledContext: string;
    sources: SourceReference[];
    metadata: any;
  };
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stream?: boolean;
    tools?: LLMTool[];
    toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    /** @deprecated Use tools/toolChoice instead */
    functions?: LLMFunction[];
    /** @deprecated Use tools/toolChoice instead */
    functionCall?: 'auto' | 'none' | { name: string };
    stop?: string[];
  };
  metadata: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    purpose: 'chat' | 'documentation' | 'code' | 'analysis' | 'translation';
    priority: 'low' | 'normal' | 'high';
  };
  createdAt?: Date;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    image?: string; // base64 or URL
  }> | null;
  name?: string; // for function/tool messages
  tool_call_id?: string; // for tool response messages
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  /** @deprecated Use toolCalls instead */
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface LLMFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMTool {
  type: 'function';
  function: LLMFunction;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  latency: number;
  metadata: {
    cacheHit?: boolean;
    fallbackUsed?: boolean;
    retries?: number;
  };
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  /** @deprecated Use toolCalls instead */
  functionCall?: {
    name: string;
    arguments: string;
  };
  createdAt: Date;
}

export interface LLMStreamChunk {
  id: string;
  requestId: string;
  content: string;
  delta: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: Date;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    streaming: boolean;
    functions: boolean;
    images: boolean;
    caching: boolean;
  };
}

export interface LLMStats {
  provider: string;
  model: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  cacheHitRate: number;
  lastRequest: Date;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'chat' | 'documentation' | 'code' | 'analysis' | 'system';
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  metadata: {
    version: string;
    author: string;
    tags: string[];
    optimizedFor: string[];
  };
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface PromptExample {
  id: string;
  variables: Record<string, any>;
  expectedOutput: string;
  description: string;
}

export interface SourceReference {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface LLMBilling {
  id: string;
  userId: string;
  provider: string;
  model: string;
  period: string; // YYYY-MM format
  usage: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    breakdown: {
      inputTokens: number;
      outputTokens: number;
      inputCost: number;
      outputCost: number;
    };
  };
  billingStatus: 'pending' | 'processed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
}

export interface LLMBillingConfig {
  provider: string;
  model: string;
  pricing: {
    input: number; // per 1K tokens
    output: number; // per 1K tokens;
  };
  billingCycle: 'monthly' | 'daily';
  currency: string;
  taxRate?: number;
  discounts?: {
    volumeThreshold: number;
    discountPercentage: number;
  }[];
}

export interface LLMUsageReport {
  userId: string;
  period: string;
  totalUsage: {
    requests: number;
    tokens: number;
    cost: number;
  };
  byProvider: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
    models: Record<string, {
      requests: number;
      tokens: number;
      cost: number;
    }>;
  }>;
  byPurpose: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  trends: {
    dailyUsage: Array<{
      date: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
    averageLatency: number;
    cacheHitRate: number;
  };
}
