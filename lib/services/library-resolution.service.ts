import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'
import { z } from 'zod'

// Types pour la résolution de bibliothèque
export const ResolveLibraryIdInputSchema = z.object({
  query: z.string()
    .min(1, "La requête est requise")
    .max(200, "La requête est trop longue")
    .describe("Nom de la bibliothèque à rechercher"),
  
  context: z.object({
    language: z.string().optional(),
    framework: z.string().optional(),
    ecosystem: z.string().optional()
  }).optional(),
  
  limit: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5),
  
  include_aliases: z.boolean()
    .default(true)
})

export type ResolveLibraryIdInput = z.infer<typeof ResolveLibraryIdInputSchema>

export interface LibraryResult {
  id: string
  name: string
  displayName: string
  description: string
  language: string
  ecosystem: string
  popularityScore: number
  relevanceScore: number
  aliases: string[]
  tags: string[]
  latestVersion: string
  homepage?: string
  repository?: string
  matchDetails: {
    matchedField: string
    matchType: 'exact' | 'fuzzy' | 'alias' | 'partial'
    confidence: number
  }
}

export interface ResolveLibraryIdOutput {
  query: string
  results: LibraryResult[]
  totalFound: number
  processingTimeMs: number
  suggestions?: string[]
}

export class LibraryResolutionService {
  private db: PrismaClient
  private redis: Redis

  constructor(db: PrismaClient, redis: Redis) {
    this.db = db
    this.redis = redis
  }

  async resolveLibrary(input: ResolveLibraryIdInput): Promise<ResolveLibraryIdOutput> {
    const startTime = Date.now()
    const normalizedQuery = this.normalizeQuery(input.query)

    try {
      // Vérifier le cache
      const cacheKey = `library_resolution:${Buffer.from(JSON.stringify({
        query: normalizedQuery,
        ecosystem: input.context?.ecosystem,
        language: input.context?.language
      })).toString('base64')}`
      
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // Rechercher dans la base de données
      const results = await this.searchLibraries(normalizedQuery, input)
      
      // Calculer les scores de pertinence
      const scoredResults = await this.scoreResults(results, normalizedQuery, input)
      
      // Trier et limiter
      const finalResults = scoredResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, input.limit)

      // Générer des suggestions si nécessaire
      const suggestions = finalResults.length === 0 
        ? await this.generateSuggestions(normalizedQuery)
        : undefined

      const output: ResolveLibraryIdOutput = {
        query: input.query,
        results: finalResults,
        totalFound: results.length,
        processingTimeMs: Date.now() - startTime,
        suggestions
      }

      // Mettre en cache (5 minutes)
      await this.redis.setex(cacheKey, 300, JSON.stringify(output))

      return output

    } catch (error) {
      throw new Error(`Library resolution failed: ${error.message}`)
    }
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\-@\/\.]/g, '')
      .replace(/[\s_\-]+/g, ' ')
      .replace(/^js /, 'javascript ')
      .replace(/^py /, 'python ')
      .replace(/^ts /, 'typescript ')
  }

  private async searchLibraries(normalizedQuery: string, input: ResolveLibraryIdInput) {
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Recherche principale
    conditions.push(`(
      name ILIKE $${paramIndex} OR
      "displayName" ILIKE $${paramIndex} OR
      description ILIKE $${paramIndex}
    )`)
    params.push(`%${normalizedQuery}%`)
    paramIndex++

    // Recherche dans les aliases si activé
    if (input.include_aliases) {
      conditions.push(`EXISTS (
        SELECT 1 FROM library_aliases 
        WHERE library_id = libraries.id 
        AND alias ILIKE $${paramIndex}
      )`)
      params.push(`%${normalizedQuery}%`)
      paramIndex++
    }

    // Filtrage par écosystème
    if (input.context?.ecosystem) {
      conditions.push(`ecosystem = $${paramIndex}`)
      params.push(input.context.ecosystem)
      paramIndex++
    }

    // Filtrage par langage
    if (input.context?.language) {
      conditions.push(`language = $${paramIndex}`)
      params.push(input.context.language)
      paramIndex++
    }

    const query = `
      SELECT 
        id,
        name,
        "displayName",
        description,
        language,
        ecosystem,
        "popularityScore",
        "defaultVersion" as "latestVersion",
        homepage,
        "repoUrl" as "repository",
        tags,
        created_at,
        updated_at
      FROM libraries
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN name ILIKE $${paramIndex} THEN 1
          WHEN "displayName" ILIKE $${paramIndex} THEN 2
          WHEN name ILIKE $${paramIndex + 1} THEN 3
          ELSE 4
        END,
        "popularityScore" DESC
      LIMIT 50
    `

    params.push(normalizedQuery, `${normalizedQuery}%`)

    const result = await this.db.$queryRawUnsafe(query, ...params)
    return result as any[]
  }

  private async scoreResults(results: any[], normalizedQuery: string, input: ResolveLibraryIdInput): Promise<LibraryResult[]> {
    const scoredResults: LibraryResult[] = []

    for (const result of results) {
      const score = this.calculateRelevanceScore(result, normalizedQuery, input)
      
      scoredResults.push({
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        description: result.description,
        language: result.language,
        ecosystem: result.ecosystem,
        popularityScore: parseFloat(result.popularityScore),
        relevanceScore: score,
        aliases: await this.getLibraryAliases(result.id),
        tags: result.tags || [],
        latestVersion: result.latestVersion,
        homepage: result.homepage,
        repository: result.repository,
        matchDetails: this.getMatchDetails(result, normalizedQuery)
      })
    }

    return scoredResults
  }

  private calculateRelevanceScore(library: any, normalizedQuery: string, input: ResolveLibraryIdInput): number {
    let score = 0

    // Exact name match
    if (library.name.toLowerCase() === normalizedQuery) {
      score += 0.9
    }
    // Exact display name match
    else if (library.displayName.toLowerCase() === normalizedQuery) {
      score += 0.8
    }
    // Partial name match
    else if (library.name.toLowerCase().includes(normalizedQuery)) {
      score += 0.6
    }
    // Partial display name match
    else if (library.displayName.toLowerCase().includes(normalizedQuery)) {
      score += 0.5
    }
    // Description match
    else if (library.description?.toLowerCase().includes(normalizedQuery)) {
      score += 0.3
    }

    // Bonus pour la popularité
    score += parseFloat(library.popularityScore) * 0.1

    // Bonus pour l'écosystème correspondant
    if (input.context?.ecosystem && library.ecosystem === input.context.ecosystem) {
      score += 0.2
    }

    // Bonus pour le langage correspondant
    if (input.context?.language && library.language === input.context.language) {
      score += 0.1
    }

    return Math.min(score, 1.0)
  }

  private getMatchDetails(library: any, normalizedQuery: string) {
    const normalizedName = library.name.toLowerCase()
    const normalizedDisplayName = library.displayName.toLowerCase()

    if (normalizedName === normalizedQuery) {
      return {
        matchedField: 'name',
        matchType: 'exact' as const,
        confidence: 0.9
      }
    }

    if (normalizedDisplayName === normalizedQuery) {
      return {
        matchedField: 'displayName',
        matchType: 'exact' as const,
        confidence: 0.8
      }
    }

    if (normalizedName.includes(normalizedQuery)) {
      return {
        matchedField: 'name',
        matchType: 'partial' as const,
        confidence: 0.6
      }
    }

    if (normalizedDisplayName.includes(normalizedQuery)) {
      return {
        matchedField: 'displayName',
        matchType: 'partial' as const,
        confidence: 0.5
      }
    }

    return {
      matchedField: 'description',
      matchType: 'fuzzy' as const,
      confidence: 0.3
    }
  }

  private async getLibraryAliases(libraryId: string): Promise<string[]> {
    const aliases = await this.db.libraryAlias.findMany({
      where: { libraryId },
      select: { alias: true }
    })
    return aliases.map(a => a.alias)
  }

  private async generateSuggestions(normalizedQuery: string): Promise<string[]> {
    const suggestions: string[] = []

    // Suggestions basées sur les similarités (requête simple pour l'instant)
    const similarLibraries = await this.db.library.findMany({
      where: {
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { displayName: { contains: normalizedQuery, mode: 'insensitive' } }
        ]
      },
      select: { name: true },
      orderBy: { popularityScore: 'desc' },
      take: 5
    })

    suggestions.push(...similarLibraries.map(lib => lib.name))

    return [...new Set(suggestions)].slice(0, 5)
  }
}
