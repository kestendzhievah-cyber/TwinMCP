import { z } from 'zod';

export const ResolveLibraryIdInputSchema = z.object({
  query: z.string()
    .min(1, "La requête est requise")
    .max(200, "La requête est trop longue")
    .describe("Nom de la bibliothèque à rechercher (ex: 'react', 'express', 'django')"),
  
  context: z.object({
    language: z.string()
      .optional()
      .describe("Langage de programmation (ex: 'javascript', 'python', 'rust')"),
    
    framework: z.string()
      .optional()
      .describe("Framework associé (ex: 'node', 'django', 'spring')"),
    
    ecosystem: z.string()
      .optional()
      .describe("Écosystème (ex: 'npm', 'pip', 'cargo', 'composer')")
  }).optional()
  .describe("Contexte optionnel pour affiner la recherche"),
  
  limit: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Nombre maximum de résultats à retourner"),
  
  include_aliases: z.boolean()
    .default(true)
    .describe("Inclure les alias et variantes dans la recherche")
});

export type ResolveLibraryIdInput = z.infer<typeof ResolveLibraryIdInputSchema>;

// Schéma de validation de sortie
export const LibraryResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  language: z.string(),
  ecosystem: z.string(),
  popularity_score: z.number().min(0).max(1),
  relevance_score: z.number().min(0).max(1),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  latest_version: z.string(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  match_details: z.object({
    matched_field: z.string(),
    match_type: z.enum(['exact', 'fuzzy', 'alias', 'partial']),
    confidence: z.number().min(0).max(1)
  })
});

export const ResolveLibraryIdOutputSchema = z.object({
  query: z.string(),
  results: z.array(LibraryResultSchema),
  total_found: z.number(),
  processing_time_ms: z.number(),
  suggestions: z.array(z.string()).optional()
});

export type ResolveLibraryIdOutput = z.infer<typeof ResolveLibraryIdOutputSchema>;
export type LibraryResult = z.infer<typeof LibraryResultSchema>;
