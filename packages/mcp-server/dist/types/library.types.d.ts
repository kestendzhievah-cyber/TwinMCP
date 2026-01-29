export interface ParsedQuery {
    original: string;
    normalized: string;
    tokens: string[];
    entities: QueryEntity[];
    ecosystem: string | null;
    language: string | null;
    confidence: number;
}
export interface QueryEntity {
    type: 'library' | 'framework' | 'version' | 'language';
    value: string;
    position: number;
    confidence: number;
    category?: string;
}
export interface RawLibraryResult {
    id: string;
    name: string;
    display_name: string;
    description: string;
    language: string;
    ecosystem: string;
    popularity_score: number;
    latest_version: string;
    homepage?: string;
    repository?: string;
    tags: string[];
    created_at: Date;
    updated_at: Date;
}
export interface LibraryResult extends RawLibraryResult {
    relevance_score: number;
    aliases: string[];
    match_details: MatchDetails;
}
export interface MatchDetails {
    matched_field: string;
    match_type: 'exact' | 'fuzzy' | 'alias' | 'partial';
    confidence: number;
}
export interface ResolveLibraryIdInput {
    query: string;
    context?: {
        language?: string;
        framework?: string;
        ecosystem?: string;
    };
    limit?: number;
    include_aliases?: boolean;
}
export interface ResolveLibraryIdOutput {
    query: string;
    results: LibraryResult[];
    total_found: number;
    processing_time_ms: number;
    suggestions?: string[];
}
//# sourceMappingURL=library.types.d.ts.map