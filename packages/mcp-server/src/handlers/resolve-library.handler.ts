import { ToolHandler, MCPContext } from '../types/mcp';
import { ResolveLibraryIdInputSchema, ResolveLibraryIdOutputSchema, ResolveLibraryIdInput, ResolveLibraryIdOutput } from '../schemas/resolve-library-id.schema';
import { LibraryResolutionService } from '../services/library-resolution.service';
import { Pool } from 'pg';
import { createClient } from 'redis';

export class ResolveLibraryHandler implements ToolHandler<ResolveLibraryIdInput, ResolveLibraryIdOutput> {
  name = 'resolve-library-id';
  description = 'Resolve library names and find matching software libraries with advanced search and scoring';
  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Library name to search for (ex: "react", "express", "django")',
        minLength: 1,
        maxLength: 200
      },
      context: {
        type: 'object',
        properties: {
          language: { 
            type: 'string',
            description: 'Programming language (ex: "javascript", "python", "rust")'
          },
          framework: { 
            type: 'string',
            description: 'Associated framework (ex: "node", "django", "spring")'
          },
          ecosystem: { 
            type: 'string',
            description: 'Ecosystem (ex: "npm", "pip", "cargo", "composer")'
          }
        },
        description: 'Optional context to refine search'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        default: 5,
        description: 'Maximum number of results to return'
      },
      include_aliases: {
        type: 'boolean',
        default: true,
        description: 'Include aliases and variants in search'
      }
    },
    required: ['query']
  };

  private resolutionService: LibraryResolutionService;

  constructor(db: Pool, redis: any) {
    this.resolutionService = new LibraryResolutionService(db, redis);
  }

  async handler(params: ResolveLibraryIdInput, context: MCPContext): Promise<ResolveLibraryIdOutput> {
    // Valider l'entrée avec Zod
    const validatedInput = ResolveLibraryIdInputSchema.parse(params);
    
    context.logger.info('Resolving library', { 
      query: validatedInput.query,
      context: validatedInput.context,
      limit: validatedInput.limit,
      include_aliases: validatedInput.include_aliases
    });

    try {
      const result = await this.resolutionService.resolveLibrary(validatedInput || {} as ResolveLibraryIdInput);
      
      // Valider la sortie avec Zod
      const validatedOutput = ResolveLibraryIdOutputSchema.parse(result);
      
      context.logger.info('Library resolved successfully', {
        query: validatedOutput.query,
        resultsCount: validatedOutput.results.length,
        totalFound: validatedOutput.total_found,
        processingTime: validatedOutput.processing_time_ms,
        requestId: context.requestId,
      });

      return validatedOutput;
    } catch (error) {
      context.logger.error('Failed to resolve library', error, { params: validatedInput });
      
      // Gérer les erreurs Zod
      if ((error as any).name === 'ZodError') {
        throw new Error(`Invalid input parameters: ${(error as any).errors.map((e: any) => e.message).join(', ')}`);
      }
      
      throw error;
    }
  }
}
