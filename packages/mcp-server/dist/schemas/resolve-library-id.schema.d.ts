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
    query: string;
    limit: number;
    include_aliases: boolean;
    context?: {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    } | undefined;
}, {
    query: string;
    context?: {
        language?: string | undefined;
        framework?: string | undefined;
        ecosystem?: string | undefined;
    } | undefined;
    limit?: number | undefined;
    include_aliases?: boolean | undefined;
}>;
export type ResolveLibraryIdInput = z.infer<typeof ResolveLibraryIdInputSchema>;
export declare const LibraryResultSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    display_name: z.ZodString;
    description: z.ZodString;
    language: z.ZodString;
    ecosystem: z.ZodString;
    popularity_score: z.ZodNumber;
    relevance_score: z.ZodNumber;
    aliases: z.ZodArray<z.ZodString, "many">;
    tags: z.ZodArray<z.ZodString, "many">;
    latest_version: z.ZodString;
    homepage: z.ZodOptional<z.ZodString>;
    repository: z.ZodOptional<z.ZodString>;
    match_details: z.ZodObject<{
        matched_field: z.ZodString;
        match_type: z.ZodEnum<["exact", "fuzzy", "alias", "partial"]>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        matched_field: string;
        match_type: "exact" | "fuzzy" | "alias" | "partial";
        confidence: number;
    }, {
        matched_field: string;
        match_type: "exact" | "fuzzy" | "alias" | "partial";
        confidence: number;
    }>;
}, "strip", z.ZodTypeAny, {
    description: string;
    name: string;
    id: string;
    language: string;
    ecosystem: string;
    display_name: string;
    popularity_score: number;
    relevance_score: number;
    aliases: string[];
    tags: string[];
    latest_version: string;
    match_details: {
        matched_field: string;
        match_type: "exact" | "fuzzy" | "alias" | "partial";
        confidence: number;
    };
    homepage?: string | undefined;
    repository?: string | undefined;
}, {
    description: string;
    name: string;
    id: string;
    language: string;
    ecosystem: string;
    display_name: string;
    popularity_score: number;
    relevance_score: number;
    aliases: string[];
    tags: string[];
    latest_version: string;
    match_details: {
        matched_field: string;
        match_type: "exact" | "fuzzy" | "alias" | "partial";
        confidence: number;
    };
    homepage?: string | undefined;
    repository?: string | undefined;
}>;
export declare const ResolveLibraryIdOutputSchema: z.ZodObject<{
    query: z.ZodString;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        display_name: z.ZodString;
        description: z.ZodString;
        language: z.ZodString;
        ecosystem: z.ZodString;
        popularity_score: z.ZodNumber;
        relevance_score: z.ZodNumber;
        aliases: z.ZodArray<z.ZodString, "many">;
        tags: z.ZodArray<z.ZodString, "many">;
        latest_version: z.ZodString;
        homepage: z.ZodOptional<z.ZodString>;
        repository: z.ZodOptional<z.ZodString>;
        match_details: z.ZodObject<{
            matched_field: z.ZodString;
            match_type: z.ZodEnum<["exact", "fuzzy", "alias", "partial"]>;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        }, {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        name: string;
        id: string;
        language: string;
        ecosystem: string;
        display_name: string;
        popularity_score: number;
        relevance_score: number;
        aliases: string[];
        tags: string[];
        latest_version: string;
        match_details: {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        };
        homepage?: string | undefined;
        repository?: string | undefined;
    }, {
        description: string;
        name: string;
        id: string;
        language: string;
        ecosystem: string;
        display_name: string;
        popularity_score: number;
        relevance_score: number;
        aliases: string[];
        tags: string[];
        latest_version: string;
        match_details: {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        };
        homepage?: string | undefined;
        repository?: string | undefined;
    }>, "many">;
    total_found: z.ZodNumber;
    processing_time_ms: z.ZodNumber;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    query: string;
    results: {
        description: string;
        name: string;
        id: string;
        language: string;
        ecosystem: string;
        display_name: string;
        popularity_score: number;
        relevance_score: number;
        aliases: string[];
        tags: string[];
        latest_version: string;
        match_details: {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        };
        homepage?: string | undefined;
        repository?: string | undefined;
    }[];
    total_found: number;
    processing_time_ms: number;
    suggestions?: string[] | undefined;
}, {
    query: string;
    results: {
        description: string;
        name: string;
        id: string;
        language: string;
        ecosystem: string;
        display_name: string;
        popularity_score: number;
        relevance_score: number;
        aliases: string[];
        tags: string[];
        latest_version: string;
        match_details: {
            matched_field: string;
            match_type: "exact" | "fuzzy" | "alias" | "partial";
            confidence: number;
        };
        homepage?: string | undefined;
        repository?: string | undefined;
    }[];
    total_found: number;
    processing_time_ms: number;
    suggestions?: string[] | undefined;
}>;
export type ResolveLibraryIdOutput = z.infer<typeof ResolveLibraryIdOutputSchema>;
export type LibraryResult = z.infer<typeof LibraryResultSchema>;
//# sourceMappingURL=resolve-library-id.schema.d.ts.map