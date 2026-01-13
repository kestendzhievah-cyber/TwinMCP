import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { z } from 'zod';
export declare const ResolveLibraryIdInputSchema: z.ZodObject<{
    query: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        language: z.ZodOptional<z.ZodString>;
        framework: z.ZodOptional<z.ZodString>;
        ecosystem: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    }, {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    }>>;
    limit: z.ZodDefault<z.ZodNumber>;
    include_aliases: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    query: string;
    include_aliases: boolean;
    context?: {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    } | undefined;
}, {
    query: string;
    limit?: number | undefined;
    context?: {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    } | undefined;
    include_aliases?: boolean | undefined;
}>;
export type ResolveLibraryIdInput = z.infer<typeof ResolveLibraryIdInputSchema>;
export interface LibraryResult {
    id: string;
    name: string;
    displayName: string;
    description: string;
    language: string;
    ecosystem: string;
    popularityScore: number;
    relevanceScore: number;
    aliases: string[];
    tags: string[];
    latestVersion: string;
    homepage?: string;
    repository?: string;
    matchDetails: {
        matchedField: string;
        matchType: 'exact' | 'fuzzy' | 'alias' | 'partial';
        confidence: number;
    };
}
export interface ResolveLibraryIdOutput {
    query: string;
    results: LibraryResult[];
    totalFound: number;
    processingTimeMs: number;
    suggestions?: string[];
}
export declare class LibraryResolutionService {
    private db;
    private redis;
    constructor(db: PrismaClient, redis: Redis);
    resolveLibrary(input: ResolveLibraryIdInput): Promise<ResolveLibraryIdOutput>;
    private normalizeQuery;
    private searchLibraries;
    private scoreResults;
    private calculateRelevanceScore;
    private getMatchDetails;
    private getLibraryAliases;
    private generateSuggestions;
}
//# sourceMappingURL=library-resolution.service.d.ts.map