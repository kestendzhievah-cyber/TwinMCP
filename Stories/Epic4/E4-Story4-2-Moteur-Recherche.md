# E4-Story4-2-Moteur-Recherche.md

## Epic 4: Library Resolution Engine

### Story 4.2: Moteur de recherche

**Description**: Algorithmes de matching flou et ranking des résultats

---

## Objectif

Développer un moteur de recherche intelligent avec algorithmes de matching flou, ranking personnalisé et suggestions contextuelles pour fournir les résultats les plus pertinents aux requêtes des utilisateurs.

---

## Prérequis

- Index de bibliothèques (Story 4.1) opérationnel
- PostgreSQL avec extensions pg_trgm et fuzzystrmatch
- Service d'indexation LibraryIndexService fonctionnel
- Redis pour cache des résultats

---

## Spécifications Techniques

### 1. Algorithmes de Matching

#### 1.1 Types de Matching

```typescript
// src/types/search.types.ts
export interface SearchQuery {
  query: string;
  context?: {
    userTags?: string[];
    userPreferences?: {
      languages?: string[];
      licenses?: string[];
      quality?: 'high' | 'medium' | 'any';
    };
    previousSearches?: string[];
    projectContext?: {
      dependencies?: string[];
      framework?: string;
    };
  };
  filters?: {
    tags?: string[];
    language?: string;
    license?: string;
    status?: string;
    minQuality?: number;
    minPopularity?: number;
  };
  options?: {
    fuzzy?: boolean;
    suggestions?: boolean;
    includeDeprecated?: boolean;
    boostRecent?: boolean;
  };
}

export interface SearchResult {
  library: Library;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'contextual';
  matchDetails: {
    nameMatch?: number;
    descriptionMatch?: number;
    tagMatch?: number;
    contextMatch?: number;
    popularityBoost?: number;
    qualityBoost?: number;
  };
  explanation: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: SearchFacets;
  suggestions?: string[];
  corrections?: string[];
  didYouMean?: string[];
  searchTime: number;
  queryProcessed: string;
}

export interface SearchFacets {
  tags: Array<{ name: string; count: number; relevance: number }>;
  languages: Array<{ name: string; count: number; relevance: number }>;
  licenses: Array<{ name: string; count: number; relevance: number }>;
  categories: Array<{ name: string; count: number; relevance: number }>;
}
```

#### 1.2 Service de Matching Avancé

```typescript
// src/services/search-matching.service.ts
import { Pool } from 'pg';
import { SearchQuery, SearchResult, SearchResponse } from '../types/search.types';
import { Library } from '../types/library.types';

export class SearchMatchingService {
  constructor(private db: Pool) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // 1. Nettoyage et normalisation de la requête
    const processedQuery = this.preprocessQuery(query.query);
    
    // 2. Génération des variations de recherche
    const searchVariations = this.generateSearchVariations(processedQuery);
    
    // 3. Exécution des différentes stratégies de recherche
    const [exactResults, fuzzyResults, semanticResults] = await Promise.all([
      this.exactSearch(searchVariations.exact, query),
      this.fuzzySearch(searchVariations.fuzzy, query),
      this.semanticSearch(searchVariations.semantic, query)
    ]);
    
    // 4. Fusion et ranking des résultats
    const allResults = this.mergeResults([
      ...exactResults,
      ...fuzzyResults,
      ...semanticResults
    ]);
    
    // 5. Application du ranking personnalisé
    const rankedResults = await this.applyPersonalizedRanking(allResults, query);
    
    // 6. Génération des suggestions et corrections
    const suggestions = await this.generateSuggestions(processedQuery);
    const corrections = await this.generateCorrections(processedQuery);
    const didYouMean = await this.generateDidYouMean(processedQuery);
    
    // 7. Calcul des facets
    const facets = await this.calculateFacets(rankedResults);
    
    const searchTime = Date.now() - startTime;
    
    return {
      results: rankedResults.slice(0, query.options?.suggestions ? 20 : 50),
      total: rankedResults.length,
      facets,
      suggestions: query.options?.suggestions ? suggestions : undefined,
      corrections,
      didYouMean,
      searchTime,
      queryProcessed: processedQuery
    };
  }

  private preprocessQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, ' ') // Garder seulement lettres, chiffres, espaces, tirets
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .replace(/\b(js|javascript)\b/g, 'javascript') // Normaliser JS
      .replace(/\b(ts|typescript)\b/g, 'typescript') // Normaliser TS
      .replace(/\b(node|nodejs)\b/g, 'node'); // Normaliser Node
  }

  private generateSearchVariations(query: string): {
    exact: string[];
    fuzzy: string[];
    semantic: string[];
  } {
    const variations = {
      exact: [query],
      fuzzy: [] as string[],
      semantic: [] as string[]
    };

    // Génération des variations floues
    const words = query.split(' ').filter(w => w.length > 2);
    
    for (const word of words) {
      // Variations avec fautes de frappe possibles
      variations.fuzzy.push(word);
      
      // Levenshtein distance variations
      if (word.length > 3) {
        // Suppression de lettres
        for (let i = 0; i < word.length; i++) {
          variations.fuzzy.push(word.slice(0, i) + word.slice(i + 1));
        }
        
        // Substitution de lettres adjacentes
        for (let i = 0; i < word.length - 1; i++) {
          const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
          variations.fuzzy.push(swapped);
        }
      }
    }

    // Variations sémantiques
    const semanticMappings = {
      'button': ['btn', 'click', 'press'],
      'form': ['input', 'field', 'validation'],
      'http': ['request', 'api', 'fetch', 'axios'],
      'database': ['db', 'sql', 'orm', 'query'],
      'test': ['jest', 'mocha', 'spec', 'unit'],
      'style': ['css', 'sass', 'scss', 'styled'],
      'router': ['routing', 'navigation', 'route'],
      'state': ['store', 'redux', 'mobx', 'state'],
      'auth': ['authentication', 'login', 'passport', 'jwt']
    };

    for (const [key, synonyms] of Object.entries(semanticMappings)) {
      if (query.includes(key)) {
        variations.semantic.push(...synonyms);
      }
    }

    return variations;
  }

  private async exactSearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    const sqlQuery = `
      SELECT 
        l.*,
        ts_rank(l.search_vector, plainto_tsquery($1)) as text_rank,
        CASE 
          WHEN l.name ILIKE $1 THEN 1.0
          WHEN l.display_name ILIKE $1 THEN 0.9
          ELSE 0.0
        END as name_rank,
        similarity(l.name, $1) as name_similarity
      FROM libraries l
      WHERE 
        l.search_vector @@ plainto_tsquery($1)
        OR l.name ILIKE '%' || $1 || '%'
        OR l.display_name ILIKE '%' || $1 || '%'
      ${this.buildFilterClause(query.filters)}
    `;

    const results = await this.db.query(sqlQuery, [terms[0]]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'exact'));
  }

  private async fuzzySearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    if (terms.length === 0) return [];

    const sqlQuery = `
      SELECT 
        l.*,
        similarity(l.name, $1) as name_similarity,
        similarity(l.description, $1) as desc_similarity,
        CASE 
          WHEN l.name % $1 THEN 0.8
          ELSE 0.0
        END as fuzzy_rank
      FROM libraries l
      WHERE 
        l.name % $1 
        OR l.description % $1
      ${this.buildFilterClause(query.filters)}
      HAVING similarity(l.name, $1) > 0.3 OR similarity(l.description, $1) > 0.3
      ORDER BY fuzzy_rank DESC, name_similarity DESC, desc_similarity DESC
      LIMIT 50
    `;

    const results = await this.db.query(sqlQuery, [terms[0]]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'fuzzy'));
  }

  private async semanticSearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    if (terms.length === 0) return [];

    // Recherche basée sur les tags et descriptions sémantiques
    const sqlQuery = `
      SELECT DISTINCT
        l.*,
        COUNT(t.id) as tag_match_count,
        ts_rank(l.search_vector, plainto_tsquery($1)) as semantic_rank
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE 
        t.name ILIKE ANY($2)
        OR l.description ILIKE ANY($2)
      ${this.buildFilterClause(query.filters)}
      GROUP BY l.id
      ORDER BY tag_match_count DESC, semantic_rank DESC
      LIMIT 30
    `;

    const termPatterns = terms.map(term => `%${term}%`);
    const results = await this.db.query(sqlQuery, [terms.join(' '), termPatterns]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'semantic'));
  }

  private mergeResults(results: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = merged.get(result.library.name);
      
      if (!existing || result.score > existing.score) {
        merged.set(result.library.name, result);
      } else if (existing) {
        // Combiner les scores si même bibliothèque avec matchs différents
        existing.score = Math.max(existing.score, result.score);
        existing.matchDetails = {
          ...existing.matchDetails,
          ...result.matchDetails
        };
      }
    }

    return Array.from(merged.values());
  }

  private async applyPersonalizedRanking(
    results: SearchResult[], 
    query: SearchQuery
  ): Promise<SearchResult[]> {
    if (!query.context) return results;

    return results.map(result => {
      let boost = 0;
      const details = result.matchDetails;

      // Boost basé sur les préférences utilisateur
      if (query.context.userPreferences?.languages?.includes(result.library.language)) {
        boost += 0.2;
        details.contextMatch = (details.contextMatch || 0) + 0.2;
      }

      // Boost basé sur les tags utilisateur
      if (query.context.userTags) {
        const commonTags = query.context.userTags.filter(tag =>
          result.library.tags?.some(libTag => libTag.name === tag)
        );
        boost += commonTags.length * 0.1;
        details.contextMatch = (details.contextMatch || 0) + commonTags.length * 0.1;
      }

      // Boost basé sur le contexte du projet
      if (query.context.projectContext?.dependencies?.includes(result.library.name)) {
        boost += 0.5; // Fort boost si déjà utilisé
        details.contextMatch = (details.contextMatch || 0) + 0.5;
      }

      // Boost basé sur la qualité minimale requise
      if (query.context.userPreferences?.quality === 'high' && result.library.qualityScore > 0.8) {
        boost += 0.15;
        details.qualityBoost = 0.15;
      }

      // Boost pour les bibliothèques récentes
      if (query.options?.boostRecent) {
        const daysSinceUpdate = (Date.now() - new Date(result.library.lastUpdatedAt || 0).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          boost += 0.1;
        }
      }

      result.score += boost;
      return result;
    }).sort((a, b) => b.score - a.score);
  }

  private async generateSuggestions(query: string): Promise<string[]> {
    const sqlQuery = `
      SELECT name, similarity(name, $1) as similarity
      FROM libraries
      WHERE name % $1 AND similarity(name, $1) > 0.5
      ORDER BY similarity DESC, weekly_downloads DESC
      LIMIT 5
    `;

    const result = await this.db.query(sqlQuery, [query]);
    return result.rows.map(row => row.name);
  }

  private async generateCorrections(query: string): Promise<string[]> {
    // Correction orthographique basée sur les bibliothèques populaires
    const words = query.split(' ');
    const corrections: string[] = [];

    for (const word of words) {
      if (word.length < 3) continue;

      const sqlQuery = `
        SELECT name, similarity(name, $1) as similarity
        FROM libraries
        WHERE name % $1 AND similarity(name, $1) > 0.6
        ORDER BY similarity DESC, weekly_downloads DESC
        LIMIT 1
      `;

      const result = await this.db.query(sqlQuery, [word]);
      if (result.rows.length > 0 && result.rows[0].similarity > 0.8) {
        corrections.push(result.rows[0].name);
      }
    }

    return corrections;
  }

  private async generateDidYouMean(query: string): Promise<string[]> {
    // Suggestions "Did you mean" basées sur les recherches populaires
    const sqlQuery = `
      SELECT DISTINCT query
      FROM search_logs
      WHERE query % $1 
        AND result_count > 0
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY similarity(query, $1) DESC, search_count DESC
      LIMIT 3
    `;

    const result = await this.db.query(sqlQuery, [query]);
    return result.rows.map(row => row.query);
  }

  private async calculateFacets(results: SearchResult[]): Promise<SearchFacets> {
    if (results.length === 0) {
      return { tags: [], languages: [], licenses: [], categories: [] };
    }

    // Agrégation des tags
    const tagCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    const licenseCounts = new Map<string, number>();

    for (const result of results) {
      // Tags
      result.library.tags?.forEach(tag => {
        tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1);
      });

      // Language
      if (result.library.language) {
        languageCounts.set(result.library.language, (languageCounts.get(result.library.language) || 0) + 1);
      }

      // License
      if (result.library.license) {
        licenseCounts.set(result.library.license, (licenseCounts.get(result.library.license) || 0) + 1);
      }
    }

    const total = results.length;

    return {
      tags: this.mapToFacetArray(tagCounts, total),
      languages: this.mapToFacetArray(languageCounts, total),
      licenses: this.mapToFacetArray(licenseCounts, total),
      categories: [] // TODO: Implémenter les catégories
    };
  }

  private mapToFacetArray(counts: Map<string, number>, total: number): Array<{ name: string; count: number; relevance: number }> {
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        relevance: count / total
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private buildFilterClause(filters?: any): string {
    if (!filters) return '';

    const conditions: string[] = [];
    
    if (filters.tags?.length > 0) {
      conditions.push(`l.id IN (
        SELECT library_id FROM library_tag_associations 
        WHERE tag_id IN (SELECT id FROM library_tags WHERE name = ANY('${filters.tags}'))
      )`);
    }

    if (filters.language) {
      conditions.push(`l.language = '${filters.language}'`);
    }

    if (filters.license) {
      conditions.push(`l.license = '${filters.license}'`);
    }

    if (filters.status) {
      conditions.push(`l.status = '${filters.status}'`);
    }

    if (filters.minQuality) {
      conditions.push(`l.quality_score >= ${filters.minQuality}`);
    }

    if (filters.minPopularity) {
      conditions.push(`l.popularity_score >= ${filters.minPopularity}`);
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  private mapToSearchResult(row: any, matchType: SearchResult['matchType']): SearchResult {
    const library = {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      // ... autres champs
    } as Library;

    // Calcul du score composite
    let score = 0;
    const matchDetails: any = {};

    if (row.text_rank) {
      score += row.text_rank * 0.4;
    }

    if (row.name_rank) {
      score += row.name_rank * 0.3;
      matchDetails.nameMatch = row.name_rank;
    }

    if (row.name_similarity) {
      score += row.name_similarity * 0.2;
      matchDetails.nameMatch = row.name_similarity;
    }

    if (row.desc_similarity) {
      score += row.desc_similarity * 0.1;
      matchDetails.descriptionMatch = row.desc_similarity;
    }

    if (row.tag_match_count) {
      score += Math.min(row.tag_match_count * 0.1, 0.3);
      matchDetails.tagMatch = row.tag_match_count * 0.1;
    }

    // Boost de popularité
    if (row.weekly_downloads > 10000) {
      score += 0.1;
      matchDetails.popularityBoost = 0.1;
    }

    // Boost de qualité
    if (row.quality_score > 0.8) {
      score += 0.1;
      matchDetails.qualityBoost = 0.1;
    }

    return {
      library,
      score: Math.min(score, 1), // Normaliser entre 0 et 1
      matchType,
      matchDetails,
      explanation: this.generateExplanation(matchType, matchDetails)
    };
  }

  private generateExplanation(matchType: string, details: any): string {
    const explanations: string[] = [];

    if (matchType === 'exact') {
      explanations.push('Correspondance exacte du nom ou de la description');
    } else if (matchType === 'fuzzy') {
      explanations.push('Correspondance approximative (faute de frappe possible)');
    } else if (matchType === 'semantic') {
      explanations.push('Correspondance sémantique basée sur les tags');
    }

    if (details.nameMatch > 0.8) {
      explanations.push('Nom de bibliothèque très similaire');
    }

    if (details.popularityBoost) {
      explanations.push('Bibliothèque populaire');
    }

    if (details.qualityBoost) {
      explanations.push('Haute qualité de code');
    }

    return explanations.join(', ') || 'Correspondance trouvée';
  }
}
```

### 2. Service de Learning

#### 2.1 Search Analytics Service

```typescript
// src/services/search-analytics.service.ts
import { Pool } from 'pg';

export class SearchAnalyticsService {
  constructor(private db: Pool) {}

  async logSearch(query: string, userId?: string, results?: SearchResult[]): Promise<void> {
    await this.db.query(`
      INSERT INTO search_logs (
        query, user_id, result_count, clicked_result, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      query,
      userId,
      results?.length || 0,
      results?.find(r => r.clicked)?.library.id
    ]);
  }

  async logClick(libraryId: string, query: string, userId?: string): Promise<void> {
    await this.db.query(`
      INSERT INTO search_clicks (
        library_id, query, user_id, created_at
      ) VALUES ($1, $2, $3, NOW())
    `, [libraryId, query, userId]);

    // Mettre à jour le score de pertinence
    await this.updateRelevanceScore(libraryId, query);
  }

  private async updateRelevanceScore(libraryId: string, query: string): Promise<void> {
    // Augmenter le score de pertinence pour cette combinaison
    await this.db.query(`
      INSERT INTO search_relevance (library_id, query, score, last_updated)
      VALUES ($1, $2, 1.0, NOW())
      ON CONFLICT (library_id, query) 
      DO UPDATE SET 
        score = LEAST(search_relevance.score + 0.1, 1.0),
        last_updated = NOW()
    `, [libraryId, query]);
  }

  async getPopularQueries(limit: number = 10): Promise<Array<{ query: string; count: number }>> {
    const result = await this.db.query(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  async getZeroResultQueries(): Promise<Array<{ query: string; count: number }>> {
    const result = await this.db.query(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE result_count = 0 
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY count DESC
    `);

    return result.rows;
  }
}
```

### 3. API Controller

#### 3.1 Enhanced Search Controller

```typescript
// src/controllers/enhanced-search.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchMatchingService } from '../services/search-matching.service';
import { SearchAnalyticsService } from '../services/search-analytics.service';
import { z } from 'zod';

const searchQuerySchema = z.object({
  query: z.string().min(1).max(100),
  context: z.object({
    userTags: z.array(z.string()).optional(),
    userPreferences: z.object({
      languages: z.array(z.string()).optional(),
      licenses: z.array(z.string()).optional(),
      quality: z.enum(['high', 'medium', 'any']).optional()
    }).optional(),
    projectContext: z.object({
      dependencies: z.array(z.string()).optional(),
      framework: z.string().optional()
    }).optional()
  }).optional(),
  filters: z.object({
    tags: z.array(z.string()).optional(),
    language: z.string().optional(),
    license: z.string().optional(),
    status: z.string().optional(),
    minQuality: z.number().min(0).max(1).optional(),
    minPopularity: z.number().min(0).max(1).optional()
  }).optional(),
  options: z.object({
    fuzzy: z.boolean().default(true),
    suggestions: z.boolean().default(true),
    includeDeprecated: z.boolean().default(false),
    boostRecent: z.boolean().default(false)
  }).optional()
});

export class EnhancedSearchController {
  constructor(
    private searchMatchingService: SearchMatchingService,
    private analyticsService: SearchAnalyticsService
  ) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchQuerySchema.parse({
        query: request.query.q,
        context: request.body?.context,
        filters: request.body?.filters,
        options: request.body?.options
      });

      const results = await this.searchMatchingService.search(query);

      // Logging pour analytics
      await this.analyticsService.logSearch(
        query.query,
        request.user?.id,
        results.results
      );

      return reply.send({
        success: true,
        data: results
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        error: 'Invalid search parameters'
      });
    }
  }

  async click(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { libraryId } = request.params as { libraryId: string };
      const { query } = request.body as { query: string };

      await this.analyticsService.logClick(
        libraryId,
        query,
        request.user?.id
      );

      return reply.send({
        success: true,
        message: 'Click logged'
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async suggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q } = request.query as { q: string };
      
      if (!q || q.length < 2) {
        return reply.send({
          success: true,
          data: []
        });
      }

      const suggestions = await this.searchMatchingService.generateSuggestions(q);
      
      return reply.send({
        success: true,
        data: suggestions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}
```

---

## Tâches Détaillées

### 1. Algorithmes de Matching
- [ ] Implémenter la recherche exacte avec tsvector
- [ ] Développer le matching flou avec pg_trgm
- [ ] Créer la recherche sémantique basée sur les tags
- [ ] Ajouter la gestion des fautes de frappe

### 2. Ranking Personnalisé
- [ ] Développer l'algorithme de scoring composite
- [ ] Implémenter les boosts contextuels
- [ ] Ajouter la personnalisation basée sur l'utilisateur
- [ ] Optimiser le poids des différents facteurs

### 3. Analytics et Learning
- [ ] Créer le service d'analytics de recherche
- [ ] Implémenter le logging des interactions
- [ ] Développer l'apprentissage des préférences
- [ ] Ajouter les suggestions d'amélioration

### 4. API Enhancements
- [ ] Étendre les endpoints de recherche
- [ ] Ajouter les options de filtrage avancé
- [ ] Implémenter les corrections orthographiques
- [ ] Optimiser les performances

---

## Validation

### Tests des Algorithmes

```typescript
// __tests__/search-matching.service.test.ts
describe('SearchMatchingService', () => {
  let service: SearchMatchingService;

  beforeEach(() => {
    service = new SearchMatchingService(db);
  });

  describe('search', () => {
    it('should return exact matches first', async () => {
      const query = {
        query: 'react',
        options: { fuzzy: true, suggestions: true }
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength.greaterThan(0);
      expect(result.results[0].matchType).toBe('exact');
      expect(result.searchTime).toBeLessThan(500);
    });

    it('should handle fuzzy matching', async () => {
      const query = {
        query: 'reac', // Faute de frappe
        options: { fuzzy: true }
      };

      const result = await service.search(query);

      expect(result.results).toHaveLength.greaterThan(0);
      expect(result.results.some(r => r.matchType === 'fuzzy')).toBe(true);
    });

    it('should provide relevant suggestions', async () => {
      const query = {
        query: 'btn',
        options: { suggestions: true }
      };

      const result = await service.search(query);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('button');
    });
  });

  describe('personalized ranking', () => {
    it('should boost user preferences', async () => {
      const query = {
        query: 'http',
        context: {
          userPreferences: {
            languages: ['TypeScript']
          }
        }
      };

      const result = await service.search(query);

      const tsLibraries = result.results.filter(r => 
        r.library.language === 'TypeScript'
      );
      
      expect(tsLibraries.length).toBeGreaterThan(0);
      expect(tsLibraries[0].score).toBeGreaterThan(0.5);
    });
  });
});
```

---

## Architecture

### Composants

1. **SearchMatchingService**: Moteur de recherche principal
2. **SearchAnalyticsService**: Analytics et apprentissage
3. **EnhancedSearchController**: API endpoints avancés
4. **PostgreSQL**: Recherche textuelle et matching flou
5. **Redis**: Cache des résultats populaires

### Flux de Recherche

```
Query → Preprocessing → Multiple Search Strategies → Merge → Personalized Ranking → Results
```

---

## Performance

### Optimisations

- **Parallel Search**: Exécution parallèle des stratégies
- **Result Caching**: Cache Redis pour requêtes populaires
- **Index Optimization**: Index GIN et pg_trgm optimisés
- **Query Optimization**: Requêtes SQL optimisées

### Métriques Cibles

- **Search Latency**: < 200ms pour 95% des requêtes
- **Fuzzy Matching**: < 300ms avec variations
- **Cache Hit Rate**: > 70% pour requêtes populaires
- **Relevance Score**: > 0.8 pour top 3 résultats

---

## Monitoring

### Métriques

- `search.requests_total`: Nombre de recherches
- `search.latency`: Latence par type de matching
- `search.click_rate`: Taux de clics
- `search.zero_results`: Requêtes sans résultats
- `search.cache_hit_rate`: Taux de cache hits

---

## Livrables

1. **SearchMatchingService**: Moteur complet avec algorithmes
2. **SearchAnalyticsService**: Analytics et apprentissage
3. **Enhanced API**: Endpoints de recherche avancés
4. **Performance Tests**: Suite de tests de charge
5. **Documentation**: Guide des algorithmes et optimisations

---

## Critères de Succès

- [ ] Recherche exacte < 100ms
- [ ] Matching flou fonctionnel avec corrections
- [ ] Ranking personnalisé efficace
- [ ] Analytics et apprentissage opérationnels
- [ ] Taux de pertinence > 85%
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **A/B Testing**: Test des algorithmes de ranking
2. **User Feedback**: Collecte des retours utilisateurs
3. **Performance Tuning**: Optimisation continue
4. **Algorithm Updates**: Mise à jour des poids de scoring
