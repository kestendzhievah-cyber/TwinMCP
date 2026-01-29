"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveLibraryIdOutputSchema = exports.LibraryResultSchema = exports.ResolveLibraryIdInputSchema = void 0;
const zod_1 = require("zod");
exports.ResolveLibraryIdInputSchema = zod_1.z.object({
    query: zod_1.z.string()
        .min(1, "La requête est requise")
        .max(200, "La requête est trop longue")
        .describe("Nom de la bibliothèque à rechercher (ex: 'react', 'express', 'django')"),
    context: zod_1.z.object({
        language: zod_1.z.string()
            .optional()
            .describe("Langage de programmation (ex: 'javascript', 'python', 'rust')"),
        framework: zod_1.z.string()
            .optional()
            .describe("Framework associé (ex: 'node', 'django', 'spring')"),
        ecosystem: zod_1.z.string()
            .optional()
            .describe("Écosystème (ex: 'npm', 'pip', 'cargo', 'composer')")
    }).optional()
        .describe("Contexte optionnel pour affiner la recherche"),
    limit: zod_1.z.number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Nombre maximum de résultats à retourner"),
    include_aliases: zod_1.z.boolean()
        .default(true)
        .describe("Inclure les alias et variantes dans la recherche")
});
// Schéma de validation de sortie
exports.LibraryResultSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    display_name: zod_1.z.string(),
    description: zod_1.z.string(),
    language: zod_1.z.string(),
    ecosystem: zod_1.z.string(),
    popularity_score: zod_1.z.number().min(0).max(1),
    relevance_score: zod_1.z.number().min(0).max(1),
    aliases: zod_1.z.array(zod_1.z.string()),
    tags: zod_1.z.array(zod_1.z.string()),
    latest_version: zod_1.z.string(),
    homepage: zod_1.z.string().optional(),
    repository: zod_1.z.string().optional(),
    match_details: zod_1.z.object({
        matched_field: zod_1.z.string(),
        match_type: zod_1.z.enum(['exact', 'fuzzy', 'alias', 'partial']),
        confidence: zod_1.z.number().min(0).max(1)
    })
});
exports.ResolveLibraryIdOutputSchema = zod_1.z.object({
    query: zod_1.z.string(),
    results: zod_1.z.array(exports.LibraryResultSchema),
    total_found: zod_1.z.number(),
    processing_time_ms: zod_1.z.number(),
    suggestions: zod_1.z.array(zod_1.z.string()).optional()
});
//# sourceMappingURL=resolve-library-id.schema.js.map