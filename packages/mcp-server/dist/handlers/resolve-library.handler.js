"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveLibraryHandler = void 0;
class ResolveLibraryHandler {
    constructor(client) {
        this.client = client;
        this.name = 'resolve-library-id';
        this.description = 'Resolve library names and find matching software libraries with advanced search and scoring';
        this.inputSchema = {
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
    }
    async handler(params, context) {
        if (!params.query || params.query.trim().length === 0) {
            throw new Error('Invalid input parameters: query is required');
        }
        context.logger.info('Resolving library', {
            query: params.query,
            libraryName: params.libraryName,
            version: params.version,
        });
        try {
            const result = await this.client.resolveLibrary(params);
            context.logger.info('Library resolved successfully', {
                libraryId: result.libraryId,
                confidence: result.confidence,
                requestId: context.requestId,
            });
            return result;
        }
        catch (error) {
            context.logger.error('Failed to resolve library', error, { params });
            throw error;
        }
    }
}
exports.ResolveLibraryHandler = ResolveLibraryHandler;
//# sourceMappingURL=resolve-library.handler.js.map