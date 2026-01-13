import { FastifyInstance } from 'fastify';
import { LibrarySearchController } from '../controllers/library-search.controller';
import { SearchRateLimitMiddleware } from '../middleware/search-rate-limit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

export async function librarySearchRoutes(fastify: FastifyInstance) {
  const rateLimitMiddleware = new SearchRateLimitMiddleware(fastify.redis as any);
  const controller = new LibrarySearchController(
    fastify.librarySearchService as any,
    fastify.libraryAnalyticsService as any,
    fastify.cacheService as any
  );

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
    preHandler: [rateLimitMiddleware.libraryDetail],
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true }
        }
      }
    }
  }, controller.getLibrary.bind(controller));

  // Versions d'une bibliothèque
  fastify.get('/api/libraries/:name/versions', {
    preHandler: [rateLimitMiddleware.libraryDetail],
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true }
        }
      }
    }
  }, controller.getLibraryVersions.bind(controller));

  // Dépendances d'une bibliothèque
  fastify.get('/api/libraries/:name/dependencies', {
    preHandler: [rateLimitMiddleware.libraryDetail],
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true }
        }
      }
    }
  }, controller.getLibraryDependencies.bind(controller));

  // Suggestions basées sur le contexte
  fastify.post('/api/libraries/suggestions', {
    preHandler: [authMiddleware.optional, rateLimitMiddleware.suggestions],
    schema: {
      body: {
        type: 'object',
        properties: {
          project: {
            type: 'object',
            properties: {
              dependencies: { type: 'array', items: { type: 'string' } },
              devDependencies: { type: 'array', items: { type: 'string' } },
              framework: { type: 'string' }
            }
          },
          user: {
            type: 'object',
            properties: {
              preferences: {
                type: 'object',
                properties: {
                  languages: { type: 'array', items: { type: 'string' } },
                  tags: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },
          query: { type: 'string' }
        }
      }
    }
  }, controller.getContextualSuggestions.bind(controller));

  // Statistiques de recherche
  fastify.get('/api/libraries/stats', {
    preHandler: [authMiddleware.required]
  }, controller.getSearchStats.bind(controller));

  // Export des résultats
  fastify.get('/api/libraries/export', {
    preHandler: [authMiddleware.required, rateLimitMiddleware.export],
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
          suggestions: { type: 'boolean', default: true },
          format: { type: 'string', enum: ['json', 'csv', 'xlsx'], default: 'json' }
        }
      }
    }
  }, controller.exportResults.bind(controller));
}
