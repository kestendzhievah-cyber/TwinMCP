import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { z } from 'zod';
export declare const QueryDocsInputSchema: z.ZodObject<{
    library_id: z.ZodString;
    query: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    max_results: z.ZodDefault<z.ZodNumber>;
    include_code: z.ZodDefault<z.ZodBoolean>;
    context_limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    library_id: string;
    max_results: number;
    include_code: boolean;
    context_limit: number;
    version?: string | undefined;
}, {
    query: string;
    library_id: string;
    version?: string | undefined;
    max_results?: number | undefined;
    include_code?: boolean | undefined;
    context_limit?: number | undefined;
}>;
export type QueryDocsInput = z.infer<typeof QueryDocsInputSchema>;
export interface DocumentResult {
    content: string;
    metadata: {
        source: string;
        url: string;
        section: string;
        type: 'text' | 'code' | 'example';
        relevanceScore: number;
    };
}
export interface QueryDocsOutput {
    library: {
        id: string;
        name: string;
        version: string;
        description: string;
    };
    query: string;
    results: DocumentResult[];
    context: string;
    totalTokens: number;
    truncated: boolean;
}
export declare class VectorSearchService {
    private db;
    private redis;
    constructor(db: PrismaClient, redis: Redis);
    searchDocuments(input: QueryDocsInput): Promise<QueryDocsOutput>;
    private mockVectorSearch;
    private assembleContext;
    private formatDocumentSection;
    private generateEmbedding;
    private searchInVectorStore;
}
//# sourceMappingURL=vector-search.service.d.ts.map