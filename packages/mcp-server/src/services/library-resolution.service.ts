import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';

type Redis = RedisClientType;
import { 
  ResolveLibraryIdInput, 
  ResolveLibraryIdOutput, 
  ParsedQuery, 
  RawLibraryResult, 
  LibraryResult, 
  MatchDetails 
} from '../types/library.types';
import { QueryParserService } from './query-parser.service';
import { TextUtils } from '../utils/text-utils';

export class LibraryResolutionService {
  private db: Pool;
  private redis: Redis;
  private queryParser: QueryParserService;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.queryParser = new QueryParserService();
  }

  async resolveLibrary(input: ResolveLibraryIdInput): Promise<ResolveLibraryIdOutput> {
    const startTime = Date.now();

    try {
      // Parser la requête
      const parsed = this.queryParser.parseQuery(input.query, input.context);

      // Vérifier le cache
      const cacheKey = this.getCacheKey(parsed);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Rechercher dans la base de données
      const results = await this.searchLibraries(parsed, input);

      // Calculer les scores de pertinence
      const scoredResults = await this.scoreResults(results, parsed);

      // Trier et limiter
      const finalResults = scoredResults
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, input.limit || 5);

      // Générer des suggestions si nécessaire
      const suggestions = finalResults.length === 0 
        ? await this.generateSuggestions(parsed)
        : [];

      const output: ResolveLibraryIdOutput = {
        query: input.query,
        results: finalResults,
        total_found: results.length,
        processing_time_ms: Date.now() - startTime,
        suggestions
      };

      // Mettre en cache
      await this.redis.setEx(cacheKey, 300, JSON.stringify(output));

      return output;

    } catch (error) {
      throw new Error(`Library resolution failed: ${(error as Error).message}`);
    }
  }

  private async searchLibraries(parsed: ParsedQuery, input: ResolveLibraryIdInput): Promise<RawLibraryResult[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Recherche principale
    conditions.push(`(
      name ILIKE $${paramIndex} OR
      display_name ILIKE $${paramIndex} OR
      description ILIKE $${paramIndex}
    )`);
    params.push(`%${parsed.normalized}%`);
    paramIndex++;

    // Recherche dans les aliases si activé
    if (input.include_aliases !== false) {
      conditions.push(`EXISTS (
        SELECT 1 FROM library_aliases 
        WHERE library_id = libraries.id 
        AND alias ILIKE $${paramIndex}
      )`);
      params.push(`%${parsed.normalized}%`);
      paramIndex++;
    }

    // Filtrage par écosystème
    if (parsed.ecosystem) {
      conditions.push(`ecosystem = $${paramIndex}`);
      params.push(parsed.ecosystem);
      paramIndex++;
    }

    // Filtrage par langage
    if (parsed.language) {
      conditions.push(`language = $${paramIndex}`);
      params.push(parsed.language);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        name,
        display_name,
        description,
        language,
        ecosystem,
        popularity_score,
        latest_version,
        homepage,
        repository,
        tags,
        created_at,
        updated_at
      FROM libraries
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE 
          WHEN name ILIKE $${paramIndex} THEN 1
          WHEN display_name ILIKE $${paramIndex} THEN 2
          WHEN name ILIKE $${paramIndex + 1} THEN 3
          ELSE 4
        END,
        popularity_score DESC
      LIMIT 50
    `;

    params.push(parsed.normalized, `${parsed.normalized}%`);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  private async scoreResults(results: RawLibraryResult[], parsed: ParsedQuery): Promise<LibraryResult[]> {
    const scoredResults: LibraryResult[] = [];

    for (const result of results) {
      const score = await this.calculateRelevanceScore(result, parsed);
      
      scoredResults.push({
        ...result,
        relevance_score: score,
        aliases: await this.getLibraryAliases(result.id),
        match_details: this.getMatchDetails(result, parsed)
      });
    }

    return scoredResults;
  }

  private async calculateRelevanceScore(library: RawLibraryResult, parsed: ParsedQuery): Promise<number> {
    let score = 0;

    // Exact name match
    if (library.name.toLowerCase() === parsed.normalized) {
      score += 0.9;
    }
    // Exact display name match
    else if (library.display_name.toLowerCase() === parsed.normalized) {
      score += 0.8;
    }
    // Partial name match
    else if (library.name.toLowerCase().includes(parsed.normalized)) {
      score += 0.6;
    }
    // Partial display name match
    else if (library.display_name.toLowerCase().includes(parsed.normalized)) {
      score += 0.5;
    }
    // Description match
    else if (library.description.toLowerCase().includes(parsed.normalized)) {
      score += 0.3;
    }

    // Bonus pour la popularité
    score += library.popularity_score * 0.1;

    // Bonus pour l'écosystème correspondant
    if (parsed.ecosystem && library.ecosystem === parsed.ecosystem) {
      score += 0.2;
    }

    // Bonus pour le langage correspondant
    if (parsed.language && library.language === parsed.language) {
      score += 0.1;
    }

    // Bonus pour la confiance du parsing
    score += parsed.confidence * 0.05;

    return Math.min(score, 1.0);
  }

  private getMatchDetails(library: RawLibraryResult, parsed: ParsedQuery): MatchDetails {
    const normalizedName = library.name.toLowerCase();
    const normalizedDisplayName = library.display_name.toLowerCase();

    if (normalizedName === parsed.normalized) {
      return {
        matched_field: 'name',
        match_type: 'exact',
        confidence: 0.9
      };
    }

    if (normalizedDisplayName === parsed.normalized) {
      return {
        matched_field: 'display_name',
        match_type: 'exact',
        confidence: 0.8
      };
    }

    if (normalizedName.includes(parsed.normalized)) {
      return {
        matched_field: 'name',
        match_type: 'partial',
        confidence: 0.6
      };
    }

    if (normalizedDisplayName.includes(parsed.normalized)) {
      return {
        matched_field: 'display_name',
        match_type: 'partial',
        confidence: 0.5
      };
    }

    return {
      matched_field: 'description',
      match_type: 'fuzzy',
      confidence: 0.3
    };
  }

  private async getLibraryAliases(libraryId: string): Promise<string[]> {
    const result = await this.db.query(
      'SELECT alias FROM library_aliases WHERE library_id = $1',
      [libraryId]
    );
    return result.rows.map((row: { alias: string }) => row.alias);
  }

  private async generateSuggestions(parsed: ParsedQuery): Promise<string[]> {
    const suggestions: string[] = [];

    // Suggestions basées sur les similarités
    const similarQuery = `
      SELECT DISTINCT name
      FROM libraries
      WHERE name ILIKE $1
      ORDER BY popularity_score DESC
      LIMIT 5
    `;

    const result = await this.db.query(similarQuery, [`${parsed.normalized}%`]);
    suggestions.push(...result.rows.map((row: { name: string }) => row.name));

    // Suggestions basées sur les tokens
    for (const token of parsed.tokens) {
      if (token.length >= 3) {
        const tokenQuery = `
          SELECT DISTINCT name
          FROM libraries
          WHERE name ILIKE $1
          ORDER BY popularity_score DESC
          LIMIT 2
        `;
        
        const tokenResult = await this.db.query(tokenQuery, [`${token}%`]);
        suggestions.push(...tokenResult.rows.map((row: { name: string }) => row.name));
      }
    }

    return [...new Set(suggestions)].slice(0, 5);
  }

  private getCacheKey(parsed: ParsedQuery): string {
    return `library_resolution:${Buffer.from(JSON.stringify({
      query: parsed.normalized,
      ecosystem: parsed.ecosystem,
      language: parsed.language
    })).toString('base64')}`;
  }
}
