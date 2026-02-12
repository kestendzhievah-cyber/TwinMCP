import { FastifyRequest, FastifyReply } from 'fastify';
import { LibraryIndexService } from '../services/library-index.service';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'archived']).optional(),
  sort: z.enum(['relevance', 'popularity', 'quality', 'updated', 'downloads']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

export class LibraryController {
  constructor(private libraryIndexService: LibraryIndexService) {}

  async searchLibraries(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchQuerySchema.parse(request.query);
      const searchQuery = {
        q: query.q,
        tags: query.tags,
        language: query.language,
        license: query.license,
        status: query.status,
        sort: query.sort,
        order: query.order,
        limit: query.limit,
        offset: query.offset
      };
      const result = await this.libraryIndexService.searchLibraries(searchQuery);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        error: 'Invalid search parameters'
      });
    }
  }

  async getLibrary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      const library = await this.libraryIndexService.getLibraryByName(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      // Récupération des informations complémentaires
      const [versions, dependencies, tags, maintainers] = await Promise.all([
        this.libraryIndexService.getLibraryVersions(library.id),
        this.libraryIndexService.getLibraryDependencies(library.id),
        this.libraryIndexService.getLibraryTags(library.id),
        this.libraryIndexService.getLibraryMaintainers(library.id)
      ]);

      return reply.send({
        success: true,
        data: {
          ...library,
          versions,
          dependencies,
          tags,
          maintainers
        }
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
      const library = await this.libraryIndexService.getLibraryByName(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      const versions = await this.libraryIndexService.getLibraryVersions(library.id);
      
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

  async getSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q } = request.query as { q?: string };
      
      if (!q || q.length < 2) {
        return reply.send({
          success: true,
          data: []
        });
      }

      const suggestions = await this.libraryIndexService.getSearchSuggestions(q);
      
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
