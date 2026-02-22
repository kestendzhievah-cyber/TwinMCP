import { Pool } from 'pg';
import { SearchQuery, SearchResult, SearchResponse, SearchFacets, Library } from '../types/search.types';

export class SearchMatchingService {
  constructor(private db: Pool) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // 1. Nettoyage et normalisation de la requête
    const processedQuery = this.preprocessQuery(query.query);
    
    // 2. Génération des variations de recherche
    const searchVariations = this.generateSearchVariations(processedQuery);
    
    // 3. Exécution des différentes stratégies de recherche
    const [exactResults, fuzzyResults, semanticResults] = await Promise.all([
      this.exactSearch(searchVariations.exact, query),
      this.fuzzySearch(searchVariations.fuzzy, query),
      this.semanticSearch(searchVariations.semantic, query)
    ]);
    
    // 4. Fusion et ranking des résultats
    const allResults = this.mergeResults([
      ...exactResults,
      ...fuzzyResults,
      ...semanticResults
    ]);
    
    // 5. Application du ranking personnalisé
    const rankedResults = await this.applyPersonalizedRanking(allResults, query);
    
    // 6. Génération des suggestions et corrections
    const suggestions = await this.generateSuggestions(processedQuery);
    const corrections = await this.generateCorrections(processedQuery);
    const didYouMean = await this.generateDidYouMean(processedQuery);
    
    // 7. Calcul des facets
    const facets = await this.calculateFacets(rankedResults);
    
    const searchTime = Date.now() - startTime;
    
    return {
      results: rankedResults.slice(0, query.options?.suggestions ? 20 : 50),
      total: rankedResults.length,
      facets,
      suggestions: query.options?.suggestions ? suggestions : undefined,
      corrections,
      didYouMean,
      searchTime,
      queryProcessed: processedQuery
    };
  }

  private preprocessQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, ' ') // Garder seulement lettres, chiffres, espaces, tirets
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .replace(/\b(js|javascript)\b/g, 'javascript') // Normaliser JS
      .replace(/\b(ts|typescript)\b/g, 'typescript') // Normaliser TS
      .replace(/\b(node|nodejs)\b/g, 'node'); // Normaliser Node
  }

  private generateSearchVariations(query: string): {
    exact: string[];
    fuzzy: string[];
    semantic: string[];
  } {
    const variations = {
      exact: [query],
      fuzzy: [] as string[],
      semantic: [] as string[]
    };

    // Génération des variations floues
    const words = query.split(' ').filter(w => w.length > 2);
    
    for (const word of words) {
      // Variations avec fautes de frappe possibles
      variations.fuzzy.push(word);
      
      // Levenshtein distance variations
      if (word.length > 3) {
        // Suppression de lettres
        for (let i = 0; i < word.length; i++) {
          variations.fuzzy.push(word.slice(0, i) + word.slice(i + 1));
        }
        
        // Substitution de lettres adjacentes
        for (let i = 0; i < word.length - 1; i++) {
          const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
          variations.fuzzy.push(swapped);
        }
      }
    }

    // Variations sémantiques
    const semanticMappings = {
      'button': ['btn', 'click', 'press'],
      'form': ['input', 'field', 'validation'],
      'http': ['request', 'api', 'fetch', 'axios'],
      'database': ['db', 'sql', 'orm', 'query'],
      'test': ['jest', 'mocha', 'spec', 'unit'],
      'style': ['css', 'sass', 'scss', 'styled'],
      'router': ['routing', 'navigation', 'route'],
      'state': ['store', 'redux', 'mobx', 'state'],
      'auth': ['authentication', 'login', 'passport', 'jwt']
    };

    for (const [key, synonyms] of Object.entries(semanticMappings)) {
      if (query.includes(key)) {
        variations.semantic.push(...synonyms);
      }
    }

    return variations;
  }

  private async exactSearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    const sqlQuery = `
      SELECT 
        l.*,
        ts_rank(l.search_vector, plainto_tsquery($1)) as text_rank,
        CASE 
          WHEN l.name ILIKE $1 THEN 1.0
          WHEN l.display_name ILIKE $1 THEN 0.9
          ELSE 0.0
        END as name_rank,
        similarity(l.name, $1) as name_similarity
      FROM libraries l
      WHERE 
        l.search_vector @@ plainto_tsquery($1)
        OR l.name ILIKE '%' || $1 || '%'
        OR l.display_name ILIKE '%' || $1 || '%'
        ${this.buildFilterClause(query.filters)}
    `;

    const results = await this.db.query(sqlQuery, [terms[0]]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'exact'));
  }

  private async fuzzySearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    if (terms.length === 0) return [];

    const sqlQuery = `
      SELECT 
        l.*,
        similarity(l.name, $1) as name_similarity,
        similarity(l.description, $1) as desc_similarity,
        CASE 
          WHEN l.name % $1 THEN 0.8
          ELSE 0.0
        END as fuzzy_rank
      FROM libraries l
      WHERE 
        l.name % $1 
        OR l.description % $1
        ${this.buildFilterClause(query.filters)}
        HAVING similarity(l.name, $1) > 0.3 OR similarity(l.description, $1) > 0.3
        ORDER BY fuzzy_rank DESC, name_similarity DESC, desc_similarity DESC
        LIMIT 50
    `;

    const results = await this.db.query(sqlQuery, [terms[0]]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'fuzzy'));
  }

  private async semanticSearch(terms: string[], query: SearchQuery): Promise<SearchResult[]> {
    if (terms.length === 0) return [];

    // Recherche basée sur les tags et descriptions sémantiques
    const sqlQuery = `
      SELECT DISTINCT
        l.*,
        COUNT(t.id) as tag_match_count,
        ts_rank(l.search_vector, plainto_tsquery($1)) as semantic_rank
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE 
        t.name ILIKE ANY($2)
        OR l.description ILIKE ANY($2)
      ${this.buildFilterClause(query.filters)}
      GROUP BY l.id
      ORDER BY tag_match_count DESC, semantic_rank DESC
      LIMIT 30
    `;

    const termPatterns = terms.map(term => `%${term}%`);
    const results = await this.db.query(sqlQuery, [terms.join(' '), termPatterns]);
    
    return results.rows.map(row => this.mapToSearchResult(row, 'semantic'));
  }

  private mergeResults(results: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = merged.get(result.library.name);
      
      if (!existing || result.score > existing.score) {
        merged.set(result.library.name, result);
      } else if (existing) {
        // Combiner les scores si même bibliothèque avec matchs différents
        existing.score = Math.max(existing.score, result.score);
        existing.matchDetails = {
          ...existing.matchDetails,
          ...result.matchDetails
        };
      }
    }

    return Array.from(merged.values());
  }

  private async applyPersonalizedRanking(
    results: SearchResult[], 
    query: SearchQuery
  ): Promise<SearchResult[]> {
    if (!query.context) return results;
    const ctx = query.context;

    return results.map(result => {
      let boost = 0;
      const details = result.matchDetails;

      // Boost basé sur les préférences utilisateur
      if (ctx.userPreferences?.languages?.includes(result.library.language || '')) {
        boost += 0.2;
        details.contextMatch = (details.contextMatch || 0) + 0.2;
      }

      // Boost basé sur les tags utilisateur
      if (ctx.userTags) {
        const commonTags = ctx.userTags.filter(tag =>
          result.library.tags?.some(libTag => libTag.name === tag)
        );
        boost += commonTags.length * 0.1;
        details.contextMatch = (details.contextMatch || 0) + commonTags.length * 0.1;
      }

      // Boost basé sur le contexte du projet
      if (ctx.projectContext?.dependencies?.includes(result.library.name)) {
        boost += 0.5; // Fort boost si déjà utilisé
        details.contextMatch = (details.contextMatch || 0) + 0.5;
      }

      // Boost basé sur la qualité minimale requise
      if (ctx.userPreferences?.quality === 'high' && (result.library.qualityScore || 0) > 0.8) {
        boost += 0.15;
        details.qualityBoost = 0.15;
      }

      // Boost pour les bibliothèques récentes
      if (query.options?.boostRecent) {
        const daysSinceUpdate = (Date.now() - new Date(result.library.lastUpdatedAt || 0).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          boost += 0.1;
        }
      }

      result.score += boost;
      return result;
    }).sort((a, b) => b.score - a.score);
  }

  async generateSuggestions(query: string): Promise<string[]> {
    if (query.length < 2) return [];
    const sqlQuery = `
      SELECT name, similarity(name, $1) as similarity
      FROM libraries
      WHERE name % $1 AND similarity(name, $1) > 0.5
      ORDER BY similarity DESC, weekly_downloads DESC
      LIMIT 5
    `;

    const result = await this.db.query(sqlQuery, [query]);
    return result.rows.map(row => row.name);
  }

  private async generateCorrections(query: string): Promise<string[]> {
    // Correction orthographique basée sur les bibliothèques populaires
    const words = query.split(' ');
    const corrections: string[] = [];

    for (const word of words) {
      if (word.length < 3) continue;

      const sqlQuery = `
        SELECT name, similarity(name, $1) as similarity
        FROM libraries
        WHERE name % $1 AND similarity(name, $1) > 0.6
        ORDER BY similarity DESC, weekly_downloads DESC
        LIMIT 1
      `;

      const result = await this.db.query(sqlQuery, [word]);
      if (result.rows.length > 0 && result.rows[0].similarity > 0.8) {
        corrections.push(result.rows[0].name);
      }
    }

    return corrections;
  }

  private async generateDidYouMean(query: string): Promise<string[]> {
    // Suggestions "Did you mean" basées sur les recherches populaires
    const sqlQuery = `
      SELECT DISTINCT query
      FROM search_logs
      WHERE query % $1 
        AND result_count > 0
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY similarity(query, $1) DESC, search_count DESC
      LIMIT 3
    `;

    const result = await this.db.query(sqlQuery, [query]);
    return result.rows.map(row => row.query);
  }

  private async calculateFacets(results: SearchResult[]): Promise<SearchFacets> {
    if (results.length === 0) {
      return { tags: [], languages: [], licenses: [], categories: [] };
    }

    // Agrégation des tags
    const tagCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    const licenseCounts = new Map<string, number>();

    for (const result of results) {
      // Tags
      result.library.tags?.forEach(tag => {
        tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1);
      });

      // Language
      if (result.library.language) {
        languageCounts.set(result.library.language, (languageCounts.get(result.library.language) || 0) + 1);
      }

      // License
      if (result.library.license) {
        licenseCounts.set(result.library.license, (licenseCounts.get(result.library.license) || 0) + 1);
      }
    }

    const total = results.length;

    return {
      tags: this.mapToFacetArray(tagCounts, total),
      languages: this.mapToFacetArray(languageCounts, total),
      licenses: this.mapToFacetArray(licenseCounts, total),
      categories: [] // TODO: Implémenter les catégories
    };
  }

  private mapToFacetArray(counts: Map<string, number>, total: number): Array<{ name: string; count: number; relevance: number }> {
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        relevance: count / total
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private buildFilterClause(filters?: any): string {
    if (!filters) return '';

    const conditions: string[] = [];
    
    if (filters.tags?.length > 0) {
      conditions.push(`l.id IN (
        SELECT library_id FROM library_tag_associations 
        WHERE tag_id IN (SELECT id FROM library_tags WHERE name = ANY('${filters.tags}'))
      )`);
    }

    if (filters.language) {
      conditions.push(`l.language = '${filters.language}'`);
    }

    if (filters.license) {
      conditions.push(`l.license = '${filters.license}'`);
    }

    if (filters.status) {
      conditions.push(`l.status = '${filters.status}'`);
    }

    if (filters.minQuality) {
      conditions.push(`l.quality_score >= ${filters.minQuality}`);
    }

    if (filters.minPopularity) {
      conditions.push(`l.popularity_score >= ${filters.minPopularity}`);
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  private mapToSearchResult(row: any, matchType: SearchResult['matchType']): SearchResult {
    const library = {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      githubUrl: row.github_url,
      npmUrl: row.npm_url,
      homepageUrl: row.homepage_url,
      repositoryUrl: row.repository_url,
      license: row.license,
      latestVersion: row.latest_version,
      totalDownloads: row.total_downloads,
      weeklyDownloads: row.weekly_downloads,
      stars: row.stars,
      forks: row.forks,
      issues: row.issues,
      language: row.language,
      status: row.status,
      qualityScore: row.quality_score,
      popularityScore: row.popularity_score,
      maintenanceScore: row.maintenance_score,
      lastUpdatedAt: row.last_updated_at,
      lastCrawledAt: row.last_crawled_at
    } as Library;

    // Calcul du score composite
    let score = 0;
    const matchDetails: any = {};

    if (row.text_rank) {
      score += row.text_rank * 0.4;
    }

    if (row.name_rank) {
      score += row.name_rank * 0.3;
      matchDetails.nameMatch = row.name_rank;
    }

    if (row.name_similarity) {
      score += row.name_similarity * 0.2;
      matchDetails.nameMatch = row.name_similarity;
    }

    if (row.desc_similarity) {
      score += row.desc_similarity * 0.1;
      matchDetails.descriptionMatch = row.desc_similarity;
    }

    if (row.tag_match_count) {
      score += Math.min(row.tag_match_count * 0.1, 0.3);
      matchDetails.tagMatch = row.tag_match_count * 0.1;
    }

    // Boost de popularité
    if ((row.weekly_downloads || 0) > 10000) {
      score += 0.1;
      matchDetails.popularityBoost = 0.1;
    }

    // Boost de qualité
    if ((row.quality_score || 0) > 0.8) {
      score += 0.1;
      matchDetails.qualityBoost = 0.1;
    }

    return {
      library,
      score: Math.min(score, 1), // Normaliser entre 0 et 1
      matchType,
      matchDetails,
      explanation: this.generateExplanation(matchType, matchDetails)
    };
  }

  private generateExplanation(matchType: string, details: any): string {
    const explanations: string[] = [];

    if (matchType === 'exact') {
      explanations.push('Correspondance exacte du nom ou de la description');
    } else if (matchType === 'fuzzy') {
      explanations.push('Correspondance approximative (faute de frappe possible)');
    } else if (matchType === 'semantic') {
      explanations.push('Correspondance sémantique basée sur les tags');
    }

    if (details.nameMatch > 0.8) {
      explanations.push('Nom de bibliothèque très similaire');
    }

    if (details.popularityBoost) {
      explanations.push('Bibliothèque populaire');
    }

    if (details.qualityBoost) {
      explanations.push('Haute qualité de code');
    }

    return explanations.join(', ') || 'Correspondance trouvée';
  }
}
