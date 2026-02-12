import { Pool } from 'pg';
import { RedisClientType } from 'redis';
type Redis = RedisClientType;
import { ResolveLibraryIdInput, ResolveLibraryIdOutput } from '../types/library.types';
export declare class LibraryResolutionService {
    private db;
    private redis;
    private queryParser;
    constructor(db: Pool, redis: Redis);
    resolveLibrary(input: ResolveLibraryIdInput): Promise<ResolveLibraryIdOutput>;
    private searchLibraries;
    private scoreResults;
    private calculateRelevanceScore;
    private getMatchDetails;
    private getLibraryAliases;
    private generateSuggestions;
    private getCacheKey;
}
export {};
//# sourceMappingURL=library-resolution.service.d.ts.map