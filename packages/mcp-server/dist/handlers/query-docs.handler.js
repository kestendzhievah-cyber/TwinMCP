"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryDocsHandler = void 0;
class QueryDocsHandler {
    constructor(client) {
        this.client = client;
        this.name = 'query-docs';
        this.description = 'Search documentation for a specific library using natural language queries';
        this.inputSchema = {
            type: 'object',
            properties: {
                libraryId: {
                    type: 'string',
                    description: 'The canonical library identifier (e.g., /mongodb/docs)',
                    minLength: 3,
                    maxLength: 200,
                },
                query: {
                    type: 'string',
                    description: 'Natural language query for searching documentation',
                    minLength: 1,
                    maxLength: 500,
                },
                version: {
                    type: 'string',
                    description: 'Optional specific version of the library',
                    pattern: '^\\d+\\.\\d+(\\.\\d+)?(-[a-zA-Z0-9]+)?$',
                },
                contentType: {
                    type: 'string',
                    description: 'Filter results by content type',
                    enum: ['snippet', 'guide', 'api_ref'],
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of results to return',
                    minimum: 1,
                    maximum: 50,
                    default: 10,
                },
                maxTokens: {
                    type: 'number',
                    description: 'Maximum total tokens in response',
                    minimum: 100,
                    maximum: 8000,
                    default: 4000,
                },
            },
            required: ['libraryId', 'query'],
        };
    }
    async handler(params, context) {
        context.logger.info('Querying documentation', {
            libraryId: params.libraryId,
            query: params.query,
            version: params.version,
        });
        try {
            const result = await this.client.queryDocs(params);
            context.logger.info('Documentation query successful', {
                libraryId: result.libraryId,
                totalResults: result.totalResults,
                totalTokens: result.totalTokens,
                requestId: context.requestId,
            });
            return result;
        }
        catch (error) {
            context.logger.error('Failed to query documentation', error, { params });
            throw error;
        }
    }
}
exports.QueryDocsHandler = QueryDocsHandler;
//# sourceMappingURL=query-docs.handler.js.map