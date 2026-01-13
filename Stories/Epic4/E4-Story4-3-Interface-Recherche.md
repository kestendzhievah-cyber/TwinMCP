# E4-Story4-3-Interface-Recherche.md

## Epic 4: Library Resolution Engine

### Story 4.3: Interface de recherche

**Description**: API pour rechercher et résoudre les bibliothèques

---

## Objectif

Créer une interface de recherche complète et performante avec pagination, filtrage avancé, auto-complétion et optimisations pour fournir une expérience utilisateur exceptionnelle dans la recherche et résolution de bibliothèques.

---

## Prérequis

- Index de bibliothèques (Story 4.1) peuplé et fonctionnel
- Moteur de recherche (Story 4.2) avec algorithmes de matching
- API Gateway (Epic 3) avec authentification
- Redis pour cache et sessions

---

## Spécifications Techniques

### 1. API Endpoints

#### 1.1 Routes Principales

```typescript
// src/routes/library-search.routes.ts
import { FastifyInstance } from 'fastify';
import { LibrarySearchController } from '../controllers/library-search.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';

export async function librarySearchRoutes(fastify: FastifyInstance) {
  const controller = new LibrarySearchController();

  // Recherche principale
  fastify.get('/api/libraries/search', {
    preHandler: [rateLimitMiddleware.search],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sort: { type: 'string', enum: ['relevance', 'popularity', 'quality', 'updated', 'downloads'], default: 'relevance' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          tags: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          license: { type: 'string' },
          status: { type: 'string', enum: ['active', 'deprecated', 'archived'] },
          min_quality: { type: 'number', minimum: 0, maximum: 1 },
          min_popularity: { type: 'number', minimum: 0, maximum: 1 },
          fuzzy: { type: 'boolean', default: true },
          suggestions: { type: 'boolean', default: true }
        }
      }
    }
  }, controller.search.bind(controller));

  // Auto-complétion
  fastify.get('/api/libraries/autocomplete', {
    preHandler: [rateLimitMiddleware.autocomplete],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 50, required: true },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }, controller.autocomplete.bind(controller));

  // Détails d'une bibliothèque
  fastify.get('/api/libraries/:name', {
    preHandler: [rateLimitMiddleware.libraryDetail]
  }, controller.getLibrary.bind(controller));

  // Versions d'une bibliothèque
  fastify.get('/api/libraries/:name/versions', {
    preHandler: [rateLimitMiddleware.libraryDetail]
  }, controller.getLibraryVersions.bind(controller));

  // Dépendances d'une bibliothèque
  fastify.get('/api/libraries/:name/dependencies', {
    preHandler: [rateLimitMiddleware.libraryDetail]
  }, controller.getLibraryDependencies.bind(controller));

  // Suggestions basées sur le contexte
  fastify.post('/api/libraries/suggestions', {
    preHandler: [authMiddleware.optional, rateLimitMiddleware.suggestions]
  }, controller.getContextualSuggestions.bind(controller));

  // Statistiques de recherche
  fastify.get('/api/libraries/stats', {
    preHandler: [authMiddleware.required]
  }, controller.getSearchStats.bind(controller));

  // Export des résultats
  fastify.get('/api/libraries/export', {
    preHandler: [authMiddleware.required, rateLimitMiddleware.export]
  }, controller.exportResults.bind(controller));
}
```

#### 1.2 Controller Complet

```typescript
// src/controllers/library-search.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { LibrarySearchService } from '../services/library-search.service';
import { LibraryAnalyticsService } from '../services/library-analytics.service';
import { CacheService } from '../services/cache.service';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'popularity', 'quality', 'updated', 'downloads']).default('relevance'),
  order: z.enum(['asc', 'desc']).default('desc'),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'archived']).optional(),
  min_quality: z.number().min(0).max(1).optional(),
  min_popularity: z.number().min(0).max(1).optional(),
  fuzzy: z.boolean().default(true),
  suggestions: z.boolean().default(true)
});

export class LibrarySearchController {
  constructor(
    private searchService: LibrarySearchService,
    private analyticsService: LibraryAnalyticsService,
    private cacheService: CacheService
  ) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchSchema.parse(request.query);
      
      // Vérifier le cache
      const cacheKey = this.generateCacheKey('search', query, request.user?.id);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      // Exécuter la recherche
      const startTime = Date.now();
      const results = await this.searchService.search(query);
      const searchTime = Date.now() - startTime;

      // Logging analytics
      await this.analyticsService.logSearch({
        query: query.q,
        userId: request.user?.id,
        resultCount: results.results.length,
        searchTime,
        filters: {
          tags: query.tags,
          language: query.language,
          license: query.license
        }
      });

      // Mettre en cache
      await this.cacheService.set(cacheKey, results, 300); // 5 minutes

      return reply.send({
        success: true,
        data: results,
        searchTime,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        error: 'Invalid search parameters'
      });
    }
  }

  async autocomplete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q, limit = 10 } = request.query as { q: string; limit?: number };
      
      if (q.length < 2) {
        return reply.send({
          success: true,
          data: []
        });
      }

      // Cache pour les requêtes d'autocomplétion
      const cacheKey = `autocomplete:${q}:${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      const suggestions = await this.searchService.autocomplete(q, limit);
      
      // Cache plus long pour l'autocomplétion
      await this.cacheService.set(cacheKey, suggestions, 1800); // 30 minutes

      return reply.send({
        success: true,
        data: suggestions,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibrary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      // Cache pour les détails de bibliothèque
      const cacheKey = `library:${name}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true
        });
      }

      const library = await this.searchService.getLibraryDetails(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      // Cache plus long pour les détails
      await this.cacheService.set(cacheKey, library, 3600); // 1 heure

      return reply.send({
        success: true,
        data: library,
        cached: false
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibraryVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      const versions = await this.searchService.getLibraryVersions(name);
      
      return reply.send({
        success: true,
        data: versions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibraryDependencies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      
      const dependencies = await this.searchService.getLibraryDependencies(name);
      
      return reply.send({
        success: true,
        data: dependencies
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getContextualSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const context = request.body as {
        project?: {
          dependencies?: string[];
          devDependencies?: string[];
          framework?: string;
        };
        user?: {
          preferences?: {
            languages?: string[];
            tags?: string[];
          };
        };
        query?: string;
      };

      const suggestions = await this.searchService.getContextualSuggestions(context);
      
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

  async getSearchStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const stats = await this.analyticsService.getUserSearchStats(userId);
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async exportResults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchSchema.parse(request.query);
      const format = request.query.format as 'json' | 'csv' | 'xlsx' || 'json';
      
      // Limiter l'export pour éviter l'abus
      const limitedQuery = { ...query, limit: Math.min(query.limit, 1000) };
      
      const results = await this.searchService.search(limitedQuery);
      
      // Logging de l'export
      await this.analyticsService.logExport({
        userId: request.user?.id,
        query: query.q,
        resultCount: results.results.length,
        format
      });

      // Formatage selon le type demandé
      let data: string;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv':
          data = this.formatAsCSV(results.results);
          contentType = 'text/csv';
          filename = `libraries-${Date.now()}.csv`;
          break;
        case 'xlsx':
          data = await this.formatAsExcel(results.results);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `libraries-${Date.now()}.xlsx`;
          break;
        default:
          data = JSON.stringify(results, null, 2);
          contentType = 'application/json';
          filename = `libraries-${Date.now()}.json`;
      }

      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      
      return reply.send(data);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Export failed'
      });
    }
  }

  private generateCacheKey(type: string, query: any, userId?: string): string {
    const queryHash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(query))
      .digest('hex');
    
    return `${type}:${queryHash}${userId ? `:${userId}` : ''}`;
  }

  private formatAsCSV(results: any[]): string {
    const headers = [
      'name', 'displayName', 'description', 'version', 'license',
      'downloads', 'stars', 'qualityScore', 'popularityScore', 'language'
    ];
    
    const csvRows = [
      headers.join(','),
      ...results.map(result => [
        `"${result.name}"`,
        `"${result.displayName || ''}"`,
        `"${(result.description || '').replace(/"/g, '""')}"`,
        `"${result.latestVersion || ''}"`,
        `"${result.license || ''}"`,
        result.weeklyDownloads || 0,
        result.stars || 0,
        result.qualityScore || 0,
        result.popularityScore || 0,
        `"${result.language || ''}"`
      ].join(','))
    ];
    
    return csvRows.join('\n');
  }

  private async formatAsExcel(results: any[]): Promise<Buffer> {
    // Implémentation avec xlsx library
    const XLSX = require('xlsx');
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(results.map(result => ({
      Name: result.name,
      'Display Name': result.displayName || '',
      Description: result.description || '',
      Version: result.latestVersion || '',
      License: result.license || '',
      'Weekly Downloads': result.weeklyDownloads || 0,
      Stars: result.stars || 0,
      'Quality Score': result.qualityScore || 0,
      'Popularity Score': result.popularityScore || 0,
      Language: result.language || ''
    })));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Libraries');
    
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
```

### 2. Service de Recherche Optimisé

#### 2.1 Library Search Service

```typescript
// src/services/library-search.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { SearchMatchingService } from './search-matching.service';

export class LibrarySearchService {
  constructor(
    private db: Pool,
    private redis: Redis,
    private searchMatchingService: SearchMatchingService
  ) {}

  async search(query: any): Promise<any> {
    // Utiliser le service de matching existant
    const searchQuery = {
      query: query.q,
      context: query.context,
      filters: {
        tags: query.tags,
        language: query.language,
        license: query.license,
        status: query.status,
        minQuality: query.min_quality,
        minPopularity: query.min_popularity
      },
      options: {
        fuzzy: query.fuzzy,
        suggestions: query.suggestions
      }
    };

    const results = await this.searchMatchingService.search(searchQuery);
    
    // Pagination
    const offset = (query.page - 1) * query.limit;
    const paginatedResults = results.results.slice(offset, offset + query.limit);
    
    return {
      ...results,
      results: paginatedResults,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: results.total,
        pages: Math.ceil(results.total / query.limit),
        hasNext: offset + query.limit < results.total,
        hasPrev: query.page > 1
      }
    };
  }

  async autocomplete(query: string, limit: number): Promise<Array<{
    name: string;
    displayName?: string;
    description?: string;
    type: 'exact' | 'partial' | 'suggestion';
  }>> {
    // Recherche exacte d'abord
    const exactResults = await this.db.query(`
      SELECT name, display_name, description
      FROM libraries
      WHERE name ILIKE $1 OR display_name ILIKE $1
      ORDER BY weekly_downloads DESC
      LIMIT $2
    `, [`${query}%`, limit]);

    // Recherche partielle
    const partialResults = await this.db.query(`
      SELECT name, display_name, description
      FROM libraries
      WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
      ORDER BY weekly_downloads DESC
      LIMIT $2
    `, [`%${query}%`, limit]);

    // Fusion et déduplication
    const combined = new Map();
    
    exactResults.rows.forEach(row => {
      combined.set(row.name, { ...row, type: 'exact' as const });
    });
    
    partialResults.rows.forEach(row => {
      if (!combined.has(row.name)) {
        combined.set(row.name, { ...row, type: 'partial' as const });
      }
    });

    return Array.from(combined.values()).slice(0, limit);
  }

  async getLibraryDetails(name: string): Promise<any> {
    const libraryQuery = `
      SELECT 
        l.*,
        json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name,
            'category', t.category,
            'confidence', a.confidence
          )
        ) as tags
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE l.name = $1
      GROUP BY l.id
    `;

    const libraryResult = await this.db.query(libraryQuery, [name]);
    
    if (libraryResult.rows.length === 0) {
      return null;
    }

    const library = libraryResult.rows[0];
    
    // Récupération des informations complémentaires en parallèle
    const [versions, dependencies, maintainers] = await Promise.all([
      this.getLibraryVersions(library.id),
      this.getLibraryDependencies(library.id),
      this.getLibraryMaintainers(library.id)
    ]);

    return {
      ...library,
      versions,
      dependencies,
      maintainers
    };
  }

  async getLibraryVersions(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT * FROM library_versions
      WHERE library_id = $1
      ORDER BY 
        CASE WHEN is_latest THEN 1 ELSE 2 END,
        release_date DESC,
        version DESC
    `, [libraryId]);

    return result.rows;
  }

  async getLibraryDependencies(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        ld.*,
        dl.name as dependency_library_name,
        dl.display_name as dependency_display_name
      FROM library_dependencies ld
      LEFT JOIN libraries dl ON ld.dependency_library_id = dl.id
      WHERE ld.library_id = $1
      ORDER BY ld.dependency_type, ld.dependency_name
    `, [libraryId]);

    return result.rows;
  }

  async getLibraryMaintainers(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        m.*,
        lm.role
      FROM maintainers m
      JOIN library_maintainers lm ON m.id = lm.maintainer_id
      WHERE lm.library_id = $1
      ORDER BY lm.role DESC, m.name
    `, [libraryId]);

    return result.rows;
  }

  async getContextualSuggestions(context: any): Promise<{
    basedOnDependencies: any[];
    basedOnFramework: any[];
    basedOnPreferences: any[];
    trending: any[];
  }> {
    const suggestions = {
      basedOnDependencies: [],
      basedOnFramework: [],
      basedOnPreferences: [],
      trending: []
    };

    // Suggestions basées sur les dépendances existantes
    if (context.project?.dependencies?.length > 0) {
      const deps = context.project.dependencies;
      suggestions.basedOnDependencies = await this.getRelatedLibraries(deps);
    }

    // Suggestions basées sur le framework
    if (context.project?.framework) {
      suggestions.basedOnFramework = await this.getFrameworkLibraries(context.project.framework);
    }

    // Suggestions basées sur les préférences utilisateur
    if (context.user?.preferences) {
      suggestions.basedOnPreferences = await this.getPreferenceBasedLibraries(context.user.preferences);
    }

    // Bibliothèques tendances
    suggestions.trending = await this.getTrendingLibraries();

    return suggestions;
  }

  private async getRelatedLibraries(dependencies: string[]): Promise<any[]> {
    const result = await this.db.query(`
      WITH deps AS (
        SELECT id FROM libraries WHERE name = ANY($1)
      )
      SELECT DISTINCT l.*, COUNT(*) as common_usage
      FROM libraries l
      JOIN library_dependencies ld ON l.id = ld.library_id
      WHERE ld.dependency_library_id IN (SELECT id FROM deps)
        AND l.name != ALL($1)
      GROUP BY l.id
      ORDER BY common_usage DESC, l.weekly_downloads DESC
      LIMIT 10
    `, [dependencies]);

    return result.rows;
  }

  private async getFrameworkLibraries(framework: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT l.*
      FROM libraries l
      JOIN library_tag_associations a ON l.id = a.library_id
      JOIN library_tags t ON a.tag_id = t.id
      WHERE t.name ILIKE $1 OR l.description ILIKE $1
      ORDER BY l.weekly_downloads DESC
      LIMIT 10
    `, [`%${framework}%`]);

    return result.rows;
  }

  private async getPreferenceBasedLibraries(preferences: any): Promise<any[]> {
    let query = `
      SELECT l.*, 
        SUM(
          CASE 
            WHEN l.language = ANY($1) THEN 0.3
            WHEN t.name = ANY($2) THEN 0.2
            ELSE 0
          END
        ) as preference_score
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE 1=1
    `;

    const params: any[] = [];
    
    if (preferences.languages?.length > 0) {
      params.push(preferences.languages);
    } else {
      params.push([]);
    }

    if (preferences.tags?.length > 0) {
      params.push(preferences.tags);
    } else {
      params.push([]);
    }

    query += `
      GROUP BY l.id
      HAVING preference_score > 0
      ORDER BY preference_score DESC, l.weekly_downloads DESC
      LIMIT 10
    `;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  private async getTrendingLibraries(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT *
      FROM libraries
      WHERE last_updated_at > NOW() - INTERVAL '30 days'
        AND status = 'active'
      ORDER BY 
        (weekly_downloads / NULLIF(total_downloads, 0)) DESC,
        weekly_downloads DESC
      LIMIT 10
    `);

    return result.rows;
  }
}
```

### 3. Middleware de Rate Limiting Spécialisé

#### 3.1 Search Rate Limiting

```typescript
// src/middleware/search-rate-limit.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

export class SearchRateLimitMiddleware {
  constructor(private redis: Redis) {}

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:search:${request.ip}`;
    const limit = request.user ? 1000 : 100; // Authentifié vs anonyme
    const window = 60; // 1 minute

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - current));
    reply.header('X-RateLimit-Reset', new Date(Date.now() + window * 1000).toISOString());

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many search requests',
        retryAfter: window
      });
    }
  };

  autocomplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:autocomplete:${request.ip}`;
    const limit = request.user ? 500 : 50;
    const window = 60;

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many autocomplete requests'
      });
    }
  };

  libraryDetail = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:detail:${request.ip}`;
    const limit = request.user ? 2000 : 200;
    const window = 60;

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many detail requests'
      });
    }
  };

  suggestions = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:suggestions:${request.user?.id || request.ip}`;
    const limit = 100;
    const window = 300; // 5 minutes

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Too many suggestion requests'
      });
    }
  };

  export = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `rate-limit:export:${request.user?.id}`;
    const limit = 10;
    const window = 3600; // 1 heure

    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      return reply.code(429).send({
        success: false,
        error: 'Export limit exceeded',
        retryAfter: window
      });
    }
  };
}
```

---

## Tâches Détaillées

### 1. API Endpoints
- [ ] Créer tous les endpoints de recherche
- [ ] Implémenter la pagination et filtrage
- [ ] Ajouter les schémas de validation Zod
- [ ] Configurer le middleware de rate limiting

### 2. Auto-complétion
- [ ] Développer l'algorithme de suggestions
- [ ] Implémenter le cache pour l'autocomplétion
- [ ] Ajouter les types de correspondance
- [ ] Optimiser les performances

### 3. Contexte et Personnalisation
- [ ] Implémenter les suggestions contextuelles
- [ ] Ajouter la personnalisation utilisateur
- [ ] Créer les algorithmes de recommandation
- [ ] Optimiser les requêtes complexes

### 4. Export et Analytics
- [ ] Développer les fonctionnalités d'export
- [ ] Implémenter le tracking des interactions
- [ ] Ajouter les statistiques utilisateur
- [ ] Optimiser les formats de sortie

---

## Validation

### Tests de l'API

```typescript
// __tests__/library-search.controller.test.ts
describe('LibrarySearchController', () => {
  let controller: LibrarySearchController;
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();
    controller = new LibrarySearchController(
      mockSearchService,
      mockAnalyticsService,
      mockCacheService
    );
    await librarySearchRoutes(app);
  });

  describe('GET /api/libraries/search', () => {
    it('should return search results with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/libraries/search?q=react&page=1&limit=10'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.success).toBe(true);
      expect(data.data.results).toHaveLength(10);
      expect(data.data.pagination).toBeDefined();
    });

    it('should apply filters correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/libraries/search?q=http&language=TypeScript&tags=frontend'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.success).toBe(true);
      expect(data.data.results.every(r => r.language === 'TypeScript')).toBe(true);
    });
  });

  describe('GET /api/libraries/autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/libraries/autocomplete?q=reac&limit=5'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(5);
      expect(data.data[0].name).toContain('reac');
    });
  });

  describe('POST /api/libraries/suggestions', () => {
    it('should return contextual suggestions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/libraries/suggestions',
        payload: {
          project: {
            dependencies: ['react', 'express'],
            framework: 'react'
          },
          user: {
            preferences: {
              languages: ['TypeScript'],
              tags: ['frontend']
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.success).toBe(true);
      expect(data.data.basedOnDependencies).toBeDefined();
      expect(data.data.basedOnFramework).toBeDefined();
      expect(data.data.trending).toBeDefined();
    });
  });
});
```

---

## Architecture

### Composants

1. **LibrarySearchController**: API endpoints et validation
2. **LibrarySearchService**: Logique de recherche et pagination
3. **SearchRateLimitMiddleware**: Rate limiting spécialisé
4. **CacheService**: Gestion du cache Redis
5. **LibraryAnalyticsService**: Tracking et analytics

### Flux de Recherche

```
Client Request → Validation → Cache Check → Search Service → Database → Cache → Response
```

---

## Performance

### Optimisations

- **Multi-level Caching**: Cache Redis pour résultats et autocomplétion
- **Database Indexing**: Index optimisés pour les filtres
- **Connection Pooling**: Pool de connexions PostgreSQL
- **Query Optimization**: Requêtes SQL optimisées
- **Pagination**: Limitation des résultats retournés

### Métriques Cibles

- **Search Response**: < 200ms pour 95% des requêtes
- **Autocomplete**: < 50ms pour les suggestions
- **Cache Hit Rate**: > 80% pour requêtes populaires
- **Concurrent Users**: > 1000 utilisateurs simultanés

---

## Monitoring

### Métriques

- `search.requests.total`: Nombre total de recherches
- `search.latency.p95`: Latence 95ème percentile
- `search.cache.hit_rate`: Taux de cache hits
- `autocomplete.requests.total`: Requêtes d'autocomplétion
- `export.requests.total`: Exportations de données

---

## Livrables

1. **API Complete**: Tous les endpoints de recherche
2. **Documentation**: API docs avec exemples
3. **Performance Tests**: Tests de charge et benchmarks
4. **Monitoring**: Métriques et alertes configurées
5. **User Guide**: Guide d'utilisation de l'API

---

## Critères de Succès

- [ ] API complète avec tous les endpoints
- [ ] Pagination et filtrage fonctionnels
- [ ] Auto-complétion < 50ms
- [ ] Cache hit rate > 80%
- [ ] Rate limiting efficace
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance continue des performances
2. **User Feedback**: Collecte des retours utilisateurs
3. **API Analytics**: Analyse des patterns d'utilisation
4. **Feature Requests**: Évolution basée sur l'usage
