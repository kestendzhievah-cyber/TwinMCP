# E7-Story7-1-Integration-LLM.md

## Epic 7: LLM Integration

### Story 7.1: Intégration LLM

**Description**: Connexion aux APIs OpenAI, Claude, et autres LLM

---

## Objectif

Développer un service d'intégration unifié pour multiples providers LLM (OpenAI, Anthropic Claude, Google Gemini, etc.) avec gestion des prompts, streaming, fallbacks et optimisation des coûts.

---

## Prérequis

- Clés API pour les différents providers LLM
- Service d'assemblage de contexte (Epic 5) opérationnel
- Système de gestion des tokens et coûts
- Infrastructure de monitoring et logging

---

## Spécifications Techniques

### 1. Architecture Multi-Provider

#### 1.1 Types et Interfaces

```typescript
// src/types/llm.types.ts
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
    functions?: LLMFunction[];
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
  createdAt: Date;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    image?: string; // base64 or URL
  }>;
  name?: string; // for function messages
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

export interface LLMResponse {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
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
```

#### 1.2 Configuration des Providers

```typescript
// src/config/llm-providers.config.ts
export const LLM_PROVIDERS: Record<string, LLMProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextWindow: 8192,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.03, output: 0.06 },
        performance: { latency: 2000, quality: 9 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.01, output: 0.03 },
        performance: { latency: 1500, quality: 9 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        contextWindow: 16384,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'streaming'],
        pricing: { input: 0.0015, output: 0.002 },
        performance: { latency: 800, quality: 7 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 128000,
      inputCost: 0.03,
      outputCost: 0.06
    },
    config: {
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: 'https://api.openai.com/v1',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000
      },
      features: {
        streaming: true,
        functions: true,
        images: true,
        caching: true
      }
    }
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'anthropic',
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.015, output: 0.075 },
        performance: { latency: 3000, quality: 10 }
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.003, output: 0.015 },
        performance: { latency: 2000, quality: 9 }
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.00025, output: 0.00125 },
        performance: { latency: 500, quality: 8 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 200000,
      inputCost: 0.015,
      outputCost: 0.075
    },
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      baseURL: 'https://api.anthropic.com',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000
      },
      features: {
        streaming: true,
        functions: true,
        images: true,
        caching: false
      }
    }
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    type: 'google',
    models: [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        contextWindow: 32768,
        maxOutputTokens: 2048,
        capabilities: ['functions', 'streaming'],
        pricing: { input: 0.0005, output: 0.0015 },
        performance: { latency: 1200, quality: 8 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 32768,
      inputCost: 0.0005,
      outputCost: 0.0015
    },
    config: {
      apiKey: process.env.GOOGLE_API_KEY!,
      baseURL: 'https://generativelanguage.googleapis.com/v1',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 32000
      },
      features: {
        streaming: true,
        functions: true,
        images: false,
        caching: false
      }
    }
  }
};
```

### 2. Service LLM Unifié

#### 2.1 LLM Service Principal

```typescript
// src/services/llm.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { 
  LLMRequest, 
  LLMResponse, 
  LLMStreamChunk,
  LLMProvider,
  LLMStats,
  PromptTemplate
} from '../types/llm.types';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { GoogleProvider } from '../providers/google.provider';

export class LLMService extends EventEmitter {
  private providers: Map<string, any> = new Map();
  private activeRequests: Map<string, LLMRequest> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis
  ) {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialisation des providers
    this.providers.set('openai', new OpenAIProvider(LLM_PROVIDERS.openai.config));
    this.providers.set('anthropic', new AnthropicProvider(LLM_PROVIDERS.anthropic.config));
    this.providers.set('google', new GoogleProvider(LLM_PROVIDERS.google.config));

    // Initialisation des rate limiters
    for (const [providerId, provider] of Object.entries(LLM_PROVIDERS)) {
      this.rateLimiters.set(providerId, new RateLimiter(provider.config.rateLimit));
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Validation de la requête
      await this.validateRequest(request);
      
      // Ajout à la liste des requêtes actives
      this.activeRequests.set(request.id, request);
      
      // Vérification du cache
      const cached = await this.checkCache(request);
      if (cached) {
        this.emit('cache_hit', { requestId: request.id, response: cached });
        return cached;
      }

      // Rate limiting
      await this.checkRateLimit(request.provider);

      // Sélection du provider et modèle
      const provider = this.providers.get(request.provider);
      if (!provider) {
        throw new Error(`Provider ${request.provider} not found`);
      }

      // Exécution de la requête
      const response = await provider.generate(request);
      
      // Calcul des coûts et métriques
      response.cost = this.calculateCost(request.provider, request.model, response.usage);
      response.latency = Date.now() - startTime;
      
      // Mise en cache
      await this.cacheResponse(request, response);
      
      // Logging et analytics
      await this.logRequest(request, response);
      
      // Émission d'événements
      this.emit('response_completed', { request, response });
      
      return response;

    } catch (error) {
      // Tentative de fallback
      const fallbackResponse = await this.tryFallback(request, error);
      if (fallbackResponse) {
        return fallbackResponse;
      }
      
      throw error;
    } finally {
      // Nettoyage
      this.activeRequests.delete(request.id);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    try {
      await this.validateRequest(request);
      await this.checkRateLimit(request.provider);

      const provider = this.providers.get(request.provider);
      if (!provider || !provider.generateStream) {
        throw new Error(`Streaming not supported by provider ${request.provider}`);
      }

      const stream = await provider.generateStream(request);
      
      return this.processStream(stream, request);

    } catch (error) {
      this.emit('stream_error', { requestId: request.id, error });
      throw error;
    }
  }

  private async processStream(
    providerStream: AsyncIterable<any>,
    request: LLMRequest
  ): AsyncIterable<LLMStreamChunk> {
    let accumulatedContent = '';
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const chunk of providerStream) {
      const processedChunk: LLMStreamChunk = {
        id: crypto.randomUUID(),
        requestId: request.id,
        content: accumulatedContent + (chunk.content || ''),
        delta: chunk.content || '',
        finishReason: chunk.finishReason,
        createdAt: new Date()
      };

      if (chunk.usage) {
        totalUsage = chunk.usage;
        processedChunk.usage = totalUsage;
      }

      accumulatedContent = processedChunk.content;
      
      // Émission du chunk
      this.emit('stream_chunk', processedChunk);
      
      yield processedChunk;

      // Si c'est le dernier chunk, finaliser
      if (chunk.finishReason) {
        // Création de la réponse finale pour le cache
        const finalResponse: LLMResponse = {
          id: crypto.randomUUID(),
          requestId: request.id,
          provider: request.provider,
          model: request.model,
          content: accumulatedContent,
          finishReason: chunk.finishReason as any,
          usage: totalUsage,
          cost: this.calculateCost(request.provider, request.model, totalUsage),
          latency: 0, // Calculé séparément
          createdAt: new Date()
        };

        await this.cacheResponse(request, finalResponse);
        await this.logRequest(request, finalResponse);
        
        break;
      }
    }
  }

  async getProviderStats(providerId?: string): Promise<LLMStats[]> {
    const whereClause = providerId ? 'WHERE provider = $1' : '';
    const params = providerId ? [providerId] : [];

    const result = await this.db.query(`
      SELECT 
        provider,
        model,
        COUNT(*) as total_requests,
        COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as total_cost,
        AVG(latency) as average_latency,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::float / COUNT(*) as success_rate,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::float / COUNT(*) as error_rate,
        COUNT(CASE WHEN cache_hit = true THEN 1 END)::float / COUNT(*) as cache_hit_rate,
        MAX(created_at) as last_request
      FROM llm_requests
      ${whereClause}
      GROUP BY provider, model
      ORDER BY total_requests DESC
    `, params);

    return result.rows.map(row => ({
      provider: row.provider,
      model: row.model,
      totalRequests: parseInt(row.total_requests),
      totalTokens: parseInt(row.total_tokens),
      totalCost: parseFloat(row.total_cost),
      averageLatency: parseFloat(row.average_latency),
      successRate: parseFloat(row.success_rate),
      errorRate: parseFloat(row.error_rate),
      cacheHitRate: parseFloat(row.cache_hit_rate),
      lastRequest: new Date(row.last_request)
    }));
  }

  async getPromptTemplate(templateId: string): Promise<PromptTemplate | null> {
    const result = await this.db.query(
      'SELECT * FROM prompt_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      template: row.template,
      variables: JSON.parse(row.variables),
      examples: JSON.parse(row.examples),
      metadata: JSON.parse(row.metadata)
    };
  }

  async renderPrompt(
    templateId: string, 
    variables: Record<string, any>
  ): Promise<string> {
    const template = await this.getPromptTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validation des variables
    this.validateTemplateVariables(template, variables);

    // Rendu du template
    let rendered = template.template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  private async validateRequest(request: LLMRequest): Promise<void> {
    if (!request.provider || !request.model) {
      throw new Error('Provider and model are required');
    }

    if (!request.messages || request.messages.length === 0) {
      throw new Error('At least one message is required');
    }

    // Validation du provider
    const provider = LLM_PROVIDERS[request.provider];
    if (!provider) {
      throw new Error(`Provider ${request.provider} not supported`);
    }

    // Validation du modèle
    const model = provider.models.find(m => m.id === request.model);
    if (!model) {
      throw new Error(`Model ${request.model} not found in provider ${request.provider}`);
    }

    // Validation des tokens
    const totalTokens = this.estimateTokens(request.messages);
    if (totalTokens > model.contextWindow) {
      throw new Error(`Request exceeds model context window (${totalTokens} > ${model.contextWindow})`);
    }
  }

  private async checkCache(request: LLMRequest): Promise<LLMResponse | null> {
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      const response = JSON.parse(cached);
      response.metadata = { ...response.metadata, cacheHit: true };
      return response;
    }
    
    return null;
  }

  private async cacheResponse(request: LLMRequest, response: LLMResponse): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    const ttl = 3600; // 1 heure
    
    await this.redis.setex(cacheKey, ttl, JSON.stringify(response));
  }

  private generateCacheKey(request: LLMRequest): string {
    const key = {
      provider: request.provider,
      model: request.model,
      messages: request.messages,
      options: request.options
    };
    
    return `llm_cache:${crypto.createHash('md5').update(JSON.stringify(key)).digest('hex')}`;
  }

  private async checkRateLimit(providerId: string): Promise<void> {
    const rateLimiter = this.rateLimiters.get(providerId);
    if (!rateLimiter) return;

    await rateLimiter.checkLimit();
  }

  private async tryFallback(request: LLMRequest, error: Error): Promise<LLMResponse | null> {
    // Implémentation de la logique de fallback
    const fallbackProviders = this.getFallbackProviders(request.provider);
    
    for (const fallbackProvider of fallbackProviders) {
      try {
        console.log(`Trying fallback provider: ${fallbackProvider}`);
        
        const fallbackRequest = { ...request, provider: fallbackProvider };
        const response = await this.generateResponse(fallbackRequest);
        
        response.metadata = { ...response.metadata, fallbackUsed: true };
        
        return response;
        
      } catch (fallbackError) {
        console.error(`Fallback provider ${fallbackProvider} also failed:`, fallbackError);
      }
    }
    
    return null;
  }

  private getFallbackProviders(primaryProvider: string): string[] {
    const fallbackMap: Record<string, string[]> = {
      'openai': ['anthropic', 'google'],
      'anthropic': ['openai', 'google'],
      'google': ['openai', 'anthropic']
    };
    
    return fallbackMap[primaryProvider] || [];
  }

  private calculateCost(providerId: string, modelId: string, usage: any): number {
    const provider = LLM_PROVIDERS[providerId];
    const model = provider?.models.find(m => m.id === modelId);
    
    if (!model) return 0;
    
    const inputCost = (usage.promptTokens / 1000) * model.pricing.input;
    const outputCost = (usage.completionTokens / 1000) * model.pricing.output;
    
    return inputCost + outputCost;
  }

  private estimateTokens(messages: LLMMessage[]): number {
    // Estimation simple: ~4 caractères = 1 token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : 
        msg.content.map(c => c.text || '').join('');
      return sum + content.length;
    }, 0);
    
    return Math.ceil(totalChars / 4);
  }

  private validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): void {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variables)) {
        throw new Error(`Required variable ${variable.name} is missing`);
      }
      
      if (variable.name in variables) {
        const value = variables[variable.name];
        this.validateVariableValue(variable, value);
      }
    }
  }

  private validateVariableValue(variable: PromptVariable, value: any): void {
    if (variable.validation) {
      const { min, max, pattern } = variable.validation;
      
      if (variable.type === 'number') {
        if (min !== undefined && value < min) {
          throw new Error(`Variable ${variable.name} must be >= ${min}`);
        }
        if (max !== undefined && value > max) {
          throw new Error(`Variable ${variable.name} must be <= ${max}`);
        }
      }
      
      if (pattern && typeof value === 'string') {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          throw new Error(`Variable ${variable.name} does not match pattern ${pattern}`);
        }
      }
    }
  }

  private async logRequest(request: LLMRequest, response: LLMResponse): Promise<void> {
    await this.db.query(`
      INSERT INTO llm_requests (
        id, provider, model, messages, context, options,
        status, response, usage, cost, latency, metadata,
        user_id, session_id, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
    `, [
      response.id,
      response.provider,
      response.model,
      JSON.stringify(request.messages),
      JSON.stringify(request.context),
      JSON.stringify(request.options),
      'success',
      JSON.stringify(response),
      JSON.stringify(response.usage),
      response.cost,
      response.latency,
      JSON.stringify(response.metadata),
      request.metadata.userId,
      request.metadata.sessionId
    ]);
  }
}

// Rate Limiter utility
class RateLimiter {
  private requests: number[] = [];
  private tokens: number[] = [];

  constructor(private config: { requestsPerMinute: number; tokensPerMinute: number }) {}

  async checkLimit(): Promise<void> {
    const now = Date.now();
    const window = 60000; // 1 minute

    // Nettoyage des anciennes requêtes
    this.requests = this.requests.filter(timestamp => now - timestamp < window);
    this.tokens = this.tokens.filter(timestamp => now - timestamp < window);

    // Vérification des limites
    if (this.requests.length >= this.config.requestsPerMinute) {
      const waitTime = this.requests[0] + window - now;
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    if (this.tokens.length >= this.config.tokensPerMinute) {
      const waitTime = this.tokens[0] + window - now;
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    // Enregistrement de la requête actuelle
    this.requests.push(now);
    this.tokens.push(now);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Provider OpenAI

#### 3.1 OpenAI Provider Implementation

```typescript
// src/providers/openai.provider.ts
import OpenAI from 'openai';
import { LLMRequest, LLMResponse, LLMStreamChunk, ProviderConfig } from '../types/llm.types';

export class OpenAIProvider {
  private client: OpenAI;

  constructor(private config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: config.retries
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const openaiRequest = this.convertToOpenAIRequest(request);
      
      const response = await this.client.chat.completions.create(openaiRequest);
      
      return this.convertFromOpenAIResponse(response, request);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const openaiRequest = this.convertToOpenAIRequest(request, { stream: true });
    
    const stream = await this.client.chat.completions.create(openaiRequest);
    
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
```

---

## Tâches Détaillées

### 1. Service LLM Unifié
- [ ] Implémenter LLMService principal
- [ ] Ajouter le support multi-providers
- [ ] Intégrer le rate limiting
- [ ] Développer le système de cache

### 2. Providers Spécifiques
- [ ] Implémenter OpenAIProvider
- [ ] Développer AnthropicProvider
- [ ] Ajouter GoogleProvider
- [ ] Créer le système de fallbacks

### 3. Streaming et Performance
- [ ] Implémenter le streaming asynchrone
- [ ] Ajouter le monitoring des performances
- [ ] Optimiser la gestion des tokens
- [ ] Créer les analytics de coûts

### 4. Templates et Prompts
- [ ] Développer le système de templates
- [ ] Ajouter la validation des variables
- [ ] Implémenter le rendu de prompts
- [ ] Créer les exemples et documentation

---

## Validation

### Tests du Service

```typescript
// __tests__/llm.service.test.ts
describe('LLMService', () => {
  let service: LLMService;

  beforeEach(() => {
    service = new LLMService(mockDb, mockRedis);
  });

  describe('generateResponse', () => {
    it('should generate response with OpenAI', async () => {
      const request: LLMRequest = {
        id: 'test-request',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
        options: { temperature: 0.7 },
        metadata: { purpose: 'chat', priority: 'normal' },
        createdAt: new Date()
      };

      const response = await service.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.provider).toBe('openai');
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.content).toBeDefined();
      expect(response.usage).toBeDefined();
      expect(response.cost).toBeGreaterThan(0);
    });
  });

  describe('generateStream', () => {
    it('should stream response from OpenAI', async () => {
      const request: LLMRequest = {
        id: 'test-stream',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Tell me a story' }
        ],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' },
        createdAt: new Date()
      };

      const chunks: LLMStreamChunk[] = [];
      
      for await (const chunk of service.generateStream(request)) {
        chunks.push(chunk);
        expect(chunk.requestId).toBe(request.id);
        expect(chunk.delta).toBeDefined();
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].finishReason).toBeDefined();
    });
  });
});
```

---

## Architecture

### Composants

1. **LLMService**: Service principal unifié
2. **Provider Registry**: Registre des providers
3. **Rate Limiters**: Gestion des limites d'API
4. **Cache Layer**: Cache intelligent des réponses
5. **Fallback System**: Système de secours

### Flux de Requête

```
Request → Validation → Cache Check → Rate Limit → Provider → Response → Cache → Analytics
```

---

## Performance

### Optimisations

- **Connection Pooling**: Pools de connexions optimisés
- **Smart Caching**: Cache basé sur la similarité
- **Batch Processing**: Traitement par lots
- **Async Streaming**: Streaming non-bloquant
- **Fallback Logic**: Basculement automatique

### Métriques Cibles

- **Response Latency**: < 2 secondes (95th percentile)
- **Stream Latency**: < 100ms par chunk
- **Cache Hit Rate**: > 30%
- **Success Rate**: > 99%
- **Cost Efficiency**: Optimisation automatique

---

## Monitoring

### Métriques

- `llm.requests.total`: Nombre total de requêtes
- `llm.requests.latency`: Latence par provider
- `llm.tokens.total`: Tokens consommés
- `llm.cost.total`: Coûts accumulés
- `llm.cache.hit_rate`: Taux de cache hits
- `llm.fallback.rate`: Taux de fallbacks

---

## Livrables

1. **LLMService**: Service unifié complet
2. **Provider Implementations**: OpenAI, Anthropic, Google
3. **Streaming System**: Streaming asynchrone
4. **Template Engine**: Système de prompts
5. **Analytics Dashboard**: Monitoring et coûts

---

## Critères de Succès

- [ ] Intégration multi-providers fonctionnelle
- [ ] Streaming temps réel opérationnel
- [ ] Système de fallback efficace
- [ ] Cache hit rate > 30%
- [ ] Latence < 2 secondes
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Cost Monitoring**: Surveillance des coûts
2. **Performance Tuning**: Optimisation des latences
3. **Provider Evaluation**: Évaluation comparative
4. **User Feedback**: Collecte des retours qualité
