import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { 
  LLMRequest, 
  LLMResponse, 
  LLMStreamChunk,
  LLMProvider,
  LLMStats,
  PromptTemplate
} from '../types/llm.types';
import { LLM_PROVIDERS } from '../config/llm-providers.config';

// Import des providers (seront implémentés séparément)
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic-provider';
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
      const fallbackResponse = await this.tryFallback(request, error as Error);
      if (fallbackResponse) {
        return fallbackResponse;
      }
      
      throw error as Error;
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
      throw error as Error;
    }
  }

  private async *processStream(
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
          metadata: {},
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
    } as PromptTemplate;
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

  private estimateTokens(messages: any[]): number {
    // Estimation simple: ~4 caractères = 1 token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : 
        msg.content.map((c: any) => c.text || '').join('');
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

  private validateVariableValue(variable: any, value: any): void {
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
