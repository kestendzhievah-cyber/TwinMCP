import { Pool } from 'pg';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { 
  ContextQuery,
  ContextResult,
  ContextSource,
  ContextChunk,
  ContextFilters,
  ContextOptions,
  ContextInjection,
  ContextCache,
  QueryIntent,
  QueryEntity,
  ContextSuggestion,
  VectorSearchRequest,
  VectorSearchResult,
  NLPAnalysis,
  ContextTemplate
} from '../types/context-intelligent.types';
import { VectorSearchService } from './vector-search.service';
import { NLPService } from './nlp.service';
import { ContextTemplateEngine } from './context-template.service';
import { VectorSearchQuery } from '../types/embeddings.types';

export class ContextIntelligentService {
  constructor(
    private db: Pool,
    private redis: Redis,
    private vectorSearch: VectorSearchService,
    private nlp: NLPService,
    private templateEngine: ContextTemplateEngine
  ) {}

  async processQuery(query: ContextQuery): Promise<ContextResult> {
    const startTime = Date.now();

    try {
      // Vérification du cache
      const cacheKey = this.generateCacheKey(query);
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        await this.updateCacheAccess(cacheKey);
        return cached;
      }

      // Analyse de l'intention
      const intent = await this.analyzeIntent(query.query);
      query.intent = intent;

      // Extraction des entités
      const entities = await this.extractEntities(query.query);
      query.entities = entities;

      // Recherche vectorielle
      const vectorResults = await this.performVectorSearch(query);
      
      // Filtrage et ranking
      const filteredResults = await this.filterAndRank(vectorResults, query);
      
      // Diversification des résultats
      const diversifiedResults = await this.diversifyResults(filteredResults, query);
      
      // Génération du résumé
      const summary = await this.generateSummary(diversifiedResults, query);
      
      // Génération des suggestions
      const suggestions = await this.generateSuggestions(diversifiedResults, query);

      const result: ContextResult = {
        queryId: query.id,
        sources: diversifiedResults.sources,
        chunks: diversifiedResults.chunks,
        summary,
        metadata: {
          totalSources: diversifiedResults.sources.length,
          totalChunks: diversifiedResults.chunks.length,
          queryTime: Date.now() - startTime,
          relevanceScore: this.calculateRelevanceScore(diversifiedResults),
          coverage: this.calculateCoverage(diversifiedResults, query),
          freshness: this.calculateFreshness(diversifiedResults)
        },
        suggestions
      };

      // Mise en cache
      await this.cacheResult(cacheKey, result);

      // Logging analytics
      await this.logQueryAnalytics(query, result);

      return result;

    } catch (error) {
      console.error('Error processing context query:', error);
      throw new Error(`Context query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async injectContext(
    conversationId: string,
    messageId: string,
    userMessage: string,
    context: ContextResult
  ): Promise<ContextInjection> {
    // Sélection du template approprié
    const template = await this.selectTemplate(context);
    
    // Génération du prompt injecté
    const injectedPrompt = await this.templateEngine.render(template, {
      userMessage,
      context: context.summary,
      sources: context.sources.slice(0, 5), // Top 5 sources
      chunks: context.chunks.slice(0, 10), // Top 10 chunks
      metadata: context.metadata
    });

    const injection: ContextInjection = {
      conversationId,
      messageId,
      context,
      template: template.id,
      injectedPrompt,
      metadata: {
        originalLength: userMessage.length,
        injectedLength: injectedPrompt.length,
        compressionRatio: userMessage.length / injectedPrompt.length,
        relevanceScore: context.metadata.relevanceScore
      }
    };

    // Sauvegarde de l'injection
    await this.saveInjection(injection);

    return injection;
  }

  private async analyzeIntent(query: string): Promise<QueryIntent> {
    // Analyse NLP pour déterminer l'intention
    const analysis = await this.nlp.analyzeIntent(query);
    
    return {
      type: this.mapIntentType(analysis.type),
      confidence: analysis.confidence,
      keywords: analysis.keywords,
      category: analysis.category,
      subcategory: analysis.subcategory
    };
  }

  private async extractEntities(query: string): Promise<QueryEntity[]> {
    const entities = await this.nlp.extractEntities(query);
    
    return entities.map(entity => ({
      text: entity.text,
      type: this.mapEntityType(entity.type),
      confidence: entity.confidence,
      position: entity.position
    }));
  }

  private async performVectorSearch(query: ContextQuery): Promise<{
    sources: ContextSource[];
    chunks: ContextChunk[];
  }> {
    // Adaptation pour utiliser le VectorSearchService existant
    const vectorQuery: VectorSearchQuery = {
      query: query.query,
      limit: query.options.maxResults || 50,
      threshold: query.filters.minRelevance || 0.7,
      includeMetadata: true,
      filters: {
        contentType: query.filters.types?.map(t => t === 'documentation' ? 'text' : t) as any,
        codeLanguage: query.filters.languages
      }
    };

    // Recherche vectorielle des chunks
    const searchResults = await this.vectorSearch.search(vectorQuery);

    // Regroupement par source
    const sourceMap = new Map<string, ContextSource>();
    const chunks: ContextChunk[] = [];

    for (const result of searchResults) {
      const chunk = this.mapVectorResultToChunk(result);
      chunks.push(chunk);

      // Récupération ou création de la source
      if (!sourceMap.has(chunk.sourceId)) {
        const source = await this.getSourceById(chunk.sourceId);
        if (source) {
          sourceMap.set(chunk.sourceId, source);
        }
      }
    }

    return {
      sources: Array.from(sourceMap.values()),
      chunks
    };
  }

  private async filterAndRank(
    results: { sources: ContextSource[]; chunks: ContextChunk[] },
    query: ContextQuery
  ): Promise<{ sources: ContextSource[]; chunks: ContextChunk[] }> {
    let filteredChunks = [...results.chunks];

    // Filtrage par date
    if (query.filters.dateRange) {
      filteredChunks = filteredChunks.filter(chunk => {
        const source = results.sources.find(s => s.id === chunk.sourceId);
        return source && 
          source.metadata.lastUpdated >= query.filters.dateRange!.start &&
          source.metadata.lastUpdated <= query.filters.dateRange!.end;
      });
    }

    // Filtrage par type
    if (query.filters.types) {
      filteredChunks = filteredChunks.filter(chunk => {
        const source = results.sources.find(s => s.id === chunk.sourceId);
        return source && query.filters.types!.includes(source.type);
      });
    }

    // Filtrage par pertinence
    if (query.filters.minRelevance) {
      filteredChunks = filteredChunks.filter(chunk => {
        const source = results.sources.find(s => s.id === chunk.sourceId);
        return source && source.metadata.relevanceScore >= query.filters.minRelevance!;
      });
    }

    // Ranking multi-critères
    const rankedChunks = filteredChunks.map(chunk => {
      const source = results.sources.find(s => s.id === chunk.sourceId);
      const score = this.calculateChunkScore(chunk, source!, query);
      return { chunk, score };
    });

    rankedChunks.sort((a, b) => b.score - a.score);

    // Limitation des résultats
    const maxChunks = query.filters.maxResults || 20;
    const finalChunks = rankedChunks.slice(0, maxChunks).map(r => r.chunk);

    // Sources correspondantes
    const sourceIds = new Set(finalChunks.map(c => c.sourceId));
    const finalSources = results.sources.filter(s => sourceIds.has(s.id));

    return {
      sources: finalSources,
      chunks: finalChunks
    };
  }

  private async diversifyResults(
    results: { sources: ContextSource[]; chunks: ContextChunk[] },
    query: ContextQuery
  ): Promise<{ sources: ContextSource[]; chunks: ContextChunk[] }> {
    // Diversification par source
    const chunksBySource = new Map<string, ContextChunk[]>();
    
    for (const chunk of results.chunks) {
      if (!chunksBySource.has(chunk.sourceId)) {
        chunksBySource.set(chunk.sourceId, []);
      }
      chunksBySource.get(chunk.sourceId)!.push(chunk);
    }

    // Sélection équilibrée
    const diversifiedChunks: ContextChunk[] = [];
    const maxChunksPerSource = Math.ceil((query.options.maxResults || 20) / Math.min(results.sources.length, 5));

    for (const [sourceId, chunks] of chunksBySource) {
      const sourceChunks = chunks
        .sort((a, b) => {
          const sourceA = results.sources.find(s => s.id === a.sourceId);
          const sourceB = results.sources.find(s => s.id === b.sourceId);
          return (sourceB?.metadata.relevanceScore || 0) - (sourceA?.metadata.relevanceScore || 0);
        })
        .slice(0, maxChunksPerSource);
      
      diversifiedChunks.push(...sourceChunks);
    }

    // Tri final
    diversifiedChunks.sort((a, b) => {
      const sourceA = results.sources.find(s => s.id === a.sourceId);
      const sourceB = results.sources.find(s => s.id === b.sourceId);
      return (sourceB?.metadata.relevanceScore || 0) - (sourceA?.metadata.relevanceScore || 0);
    });

    return {
      sources: results.sources,
      chunks: diversifiedChunks
    };
  }

  private async generateSummary(
    results: { sources: ContextSource[]; chunks: ContextChunk[] },
    query: ContextQuery
  ): Promise<string> {
    // Génération d'un résumé contextuel
    const keyPoints = results.chunks.slice(0, 5).map(chunk => {
      const source = results.sources.find(s => s.id === chunk.sourceId);
      return {
        content: chunk.content.substring(0, 200) + '...',
        source: source?.title,
        relevance: source?.metadata.relevanceScore || 0
      };
    });

    const summary = await this.nlp.generateSummary({
      query: query.query,
      intent: query.intent,
      keyPoints,
      maxLength: 500
    });

    return summary;
  }

  private async generateSuggestions(
    results: { sources: ContextSource[]; chunks: ContextChunk[] },
    query: ContextQuery
  ): Promise<ContextSuggestion[]> {
    const suggestions: ContextSuggestion[] = [];

    // Suggestions basées sur les entités
    for (const entity of query.entities) {
      if (entity.type === 'library') {
        suggestions.push({
          type: 'documentation',
          text: `Voir la documentation complète de ${entity.text}`,
          reason: 'Library mentionnée dans la requête',
          confidence: entity.confidence
        });
      }
    }

    // Suggestions basées sur l'intention
    switch (query.intent.type) {
      case 'question':
        suggestions.push({
          type: 'related_query',
          text: 'Comment utiliser cette fonctionnalité ?',
          reason: 'Question fréquente sur ce sujet',
          confidence: 0.8
        });
        break;
      case 'example':
        suggestions.push({
          type: 'example',
          text: 'Voir des exemples d\'utilisation',
          reason: 'Exemples disponibles pour ce cas',
          confidence: 0.9
        });
        break;
    }

    return suggestions.slice(0, 3);
  }

  private calculateChunkScore(
    chunk: ContextChunk,
    source: ContextSource,
    query: ContextQuery
  ): number {
    let score = source.metadata.relevanceScore;

    // Bonus pour la fraîcheur
    if (query.options.preferRecent) {
      const daysSinceUpdate = (Date.now() - source.metadata.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      const freshnessBonus = Math.max(0, 1 - daysSinceUpdate / 365); // Perte sur 1 an
      score += freshnessBonus * 0.2;
    }

    // Bonus pour la popularité
    score += source.metadata.popularity * 0.1;

    // Bonus pour la correspondance des entités
    for (const entity of query.entities) {
      if (chunk.content.toLowerCase().includes(entity.text.toLowerCase())) {
        score += entity.confidence * 0.15;
      }
    }

    // Pénalité pour la complexité si c'est une question simple
    if (query.intent.type === 'question' && chunk.metadata.complexity === 'high') {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateRelevanceScore(results: { sources: ContextSource[]; chunks: ContextChunk[] }): number {
    if (results.chunks.length === 0) return 0;

    const totalRelevance = results.chunks.reduce((sum, chunk) => {
      const source = results.sources.find(s => s.id === chunk.sourceId);
      return sum + (source?.metadata.relevanceScore || 0);
    }, 0);

    return totalRelevance / results.chunks.length;
  }

  private calculateCoverage(
    results: { sources: ContextSource[]; chunks: ContextChunk[] },
    query: ContextQuery
  ): number {
    // Calcul de la couverture sémantique
    const queryTerms = query.query.toLowerCase().split(/\s+/);
    const coveredTerms = new Set<string>();

    for (const chunk of results.chunks) {
      const chunkContent = chunk.content.toLowerCase();
      for (const term of queryTerms) {
        if (chunkContent.includes(term)) {
          coveredTerms.add(term);
        }
      }
    }

    return coveredTerms.size / queryTerms.length;
  }

  private calculateFreshness(results: { sources: ContextSource[]; chunks: ContextChunk[] }): number {
    if (results.sources.length === 0) return 0;

    const now = Date.now();
    const totalFreshness = results.sources.reduce((sum, source) => {
      const daysSinceUpdate = (now - source.metadata.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      const freshness = Math.max(0, 1 - daysSinceUpdate / 365); // Normalisé sur 1 an
      return sum + freshness;
    }, 0);

    return totalFreshness / results.sources.length;
  }

  private async selectTemplate(context: ContextResult): Promise<ContextTemplate> {
    // Sélection du template basé sur le type de contenu et l'intention
    const templateType = this.determineTemplateType(context);
    
    return await this.templateEngine.getTemplate(templateType);
  }

  private determineTemplateType(context: ContextResult): string {
    const hasCode = context.chunks.some(c => c.metadata.codeBlocks > 0);
    const hasExamples = context.sources.some(s => s.type === 'example');
    const hasAPI = context.sources.some(s => s.type === 'api');

    if (hasAPI) return 'api_context';
    if (hasExamples) return 'example_context';
    if (hasCode) return 'code_context';
    return 'general_context';
  }

  // Méthodes utilitaires
  private generateCacheKey(query: ContextQuery): string {
    const key = {
      query: query.query,
      filters: query.filters,
      options: query.options
    };
    
    return `context_cache:${crypto.createHash('md5').update(JSON.stringify(key)).digest('hex')}`;
  }

  private async getCachedResult(cacheKey: string): Promise<ContextResult | null> {
    const cached = await this.redis.get(cacheKey);
    if (!cached) return null;

    const cache: ContextCache = JSON.parse(cached);
    
    // Vérification de l'expiration
    if (new Date() > cache.expiresAt) {
      await this.redis.del(cacheKey);
      return null;
    }

    return cache.result;
  }

  private async cacheResult(cacheKey: string, result: ContextResult): Promise<void> {
    const cache: ContextCache = {
      key: cacheKey,
      query: '', // Pas nécessaire pour l'instant
      result,
      expiresAt: new Date(Date.now() + 3600000), // 1 heure
      hitCount: 0,
      lastAccessed: new Date()
    };

    await this.redis.setex(cacheKey, 3600, JSON.stringify(cache));
  }

  private async updateCacheAccess(cacheKey: string): Promise<void> {
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const cache: ContextCache = JSON.parse(cached);
      cache.hitCount++;
      cache.lastAccessed = new Date();
      await this.redis.setex(cacheKey, 3600, JSON.stringify(cache));
    }
  }

  private async getSourceById(sourceId: string): Promise<ContextSource | null> {
    // Simulation - à adapter avec la vraie base de données
    return {
      id: sourceId,
      type: 'documentation',
      title: `Source ${sourceId}`,
      content: 'Contenu de la source',
      metadata: {
        language: 'javascript',
        tags: ['javascript', 'react'],
        relevanceScore: 0.8,
        freshness: 0.9,
        popularity: 0.7,
        lastUpdated: new Date()
      },
      chunks: []
    };
  }

  private async saveInjection(injection: ContextInjection): Promise<void> {
    await this.db.query(`
      INSERT INTO context_injections (
        conversation_id, message_id, context, template, injected_prompt, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
    `, [
      injection.conversationId,
      injection.messageId,
      JSON.stringify(injection.context),
      injection.template,
      injection.injectedPrompt,
      JSON.stringify(injection.metadata)
    ]);
  }

  private async logQueryAnalytics(query: ContextQuery, result: ContextResult): Promise<void> {
    await this.db.query(`
      INSERT INTO context_query_analytics (
        query_id, conversation_id, query_text, intent, entities,
        filters, options, result_metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
    `, [
      query.id,
      query.conversationId,
      query.query,
      JSON.stringify(query.intent),
      JSON.stringify(query.entities),
      JSON.stringify(query.filters),
      JSON.stringify(query.options),
      JSON.stringify(result.metadata)
    ]);
  }

  private mapIntentType(intent: string): QueryIntent['type'] {
    const mapping: Record<string, QueryIntent['type']> = {
      'question': 'question',
      'explanation': 'explanation',
      'example': 'example',
      'troubleshooting': 'troubleshooting',
      'comparison': 'comparison',
      'tutorial': 'tutorial'
    };
    
    return mapping[intent] || 'question';
  }

  private mapEntityType(type: string): QueryEntity['type'] {
    const mapping: Record<string, QueryEntity['type']> = {
      'library': 'library',
      'function': 'function',
      'class': 'class',
      'concept': 'concept',
      'technology': 'technology',
      'version': 'version'
    };
    
    return mapping[type] || 'concept';
  }

  private mapVectorResultToChunk(result: any): ContextChunk {
    return {
      id: result.chunk?.id || result.id,
      sourceId: result.chunk?.libraryId || 'unknown',
      content: result.chunk?.content || result.content || '',
      position: {
        start: result.chunk?.metadata?.position || 0,
        end: result.chunk?.metadata?.position || 100,
        index: 0,
        total: 1
      },
      metadata: {
        sectionTitle: result.chunk?.metadata?.section,
        codeBlocks: result.chunk?.metadata?.contentType === 'code' ? 1 : 0,
        links: 0,
        images: 0,
        complexity: 'medium'
      },
      embeddings: result.chunk?.embedding
    };
  }
}
