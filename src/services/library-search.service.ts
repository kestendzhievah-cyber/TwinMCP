import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { SearchMatchingService } from './search-matching.service';

export class LibrarySearchService {
  constructor(
    private db: Pool,
    private _redis: Redis, // Préfixé avec _ pour indiquer qu'il est réservé pour utilisation future
    private searchMatchingService: SearchMatchingService
  ) {}

  async search(query: any): Promise<any> {
    // Utiliser le service de matching existant
    const searchQuery = {
      query: query.q,
      context: query.context,
      filters: {
        tags: query.tags,
        language: query.language,
        license: query.license,
        status: query.status,
        minQuality: query.min_quality,
        minPopularity: query.min_popularity
      },
      options: {
        fuzzy: query.fuzzy,
        suggestions: query.suggestions
      }
    };

    const results = await this.searchMatchingService.search(searchQuery);
    
    // Pagination
    const offset = (query.page - 1) * query.limit;
    const paginatedResults = results.results.slice(offset, offset + query.limit);
    
    return {
      ...results,
      results: paginatedResults,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: results.total,
        pages: Math.ceil(results.total / query.limit),
        hasNext: offset + query.limit < results.total,
        hasPrev: query.page > 1
      }
    };
  }

  async autocomplete(query: string, limit: number): Promise<Array<{
    name: string;
    displayName?: string;
    description?: string;
    type: 'exact' | 'partial' | 'suggestion';
  }>> {
    // Recherche exacte d'abord
    const exactResults = await this.db.query(`
      SELECT name, display_name, description
      FROM libraries
      WHERE name ILIKE $1 OR display_name ILIKE $1
      ORDER BY weekly_downloads DESC
      LIMIT $2
    `, [`${query}%`, limit]);

    // Recherche partielle
    const partialResults = await this.db.query(`
      SELECT name, display_name, description
      FROM libraries
      WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
      ORDER BY weekly_downloads DESC
      LIMIT $2
    `, [`%${query}%`, limit]);

    // Fusion et déduplication
    const combined = new Map();
    
    exactResults.rows.forEach(row => {
      combined.set(row.name, { ...row, type: 'exact' as const });
    });
    
    partialResults.rows.forEach(row => {
      if (!combined.has(row.name)) {
        combined.set(row.name, { ...row, type: 'partial' as const });
      }
    });

    return Array.from(combined.values()).slice(0, limit);
  }

  async getLibraryDetails(name: string): Promise<any> {
    const libraryQuery = `
      SELECT 
        l.*,
        json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name,
            'category', t.category,
            'confidence', a.confidence
          )
        ) as tags
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE l.name = $1
      GROUP BY l.id
    `;

    const libraryResult = await this.db.query(libraryQuery, [name]);
    
    if (libraryResult.rows.length === 0) {
      return null;
    }

    const library = libraryResult.rows[0];
    
    // Récupération des informations complémentaires en parallèle
    const [versions, dependencies, maintainers] = await Promise.all([
      this.getLibraryVersions(library.id),
      this.getLibraryDependencies(library.id),
      this.getLibraryMaintainers(library.id)
    ]);

    return {
      ...library,
      versions,
      dependencies,
      maintainers
    };
  }

  async getLibraryVersions(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT * FROM library_versions
      WHERE library_id = $1
      ORDER BY 
        CASE WHEN is_latest THEN 1 ELSE 2 END,
        release_date DESC,
        version DESC
    `, [libraryId]);

    return result.rows;
  }

  async getLibraryDependencies(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        ld.*,
        dl.name as dependency_library_name,
        dl.display_name as dependency_display_name
      FROM library_dependencies ld
      LEFT JOIN libraries dl ON ld.dependency_library_id = dl.id
      WHERE ld.library_id = $1
      ORDER BY ld.dependency_type, ld.dependency_name
    `, [libraryId]);

    return result.rows;
  }

  async getLibraryMaintainers(libraryId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        m.*,
        lm.role
      FROM maintainers m
      JOIN library_maintainers lm ON m.id = lm.maintainer_id
      WHERE lm.library_id = $1
      ORDER BY lm.role DESC, m.name
    `, [libraryId]);

    return result.rows;
  }

  async getContextualSuggestions(context: any): Promise<{
    basedOnDependencies: any[];
    basedOnFramework: any[];
    basedOnPreferences: any[];
    trending: any[];
  }> {
    const suggestions: {
      basedOnDependencies: any[];
      basedOnFramework: any[];
      basedOnPreferences: any[];
      trending: any[];
    } = {
      basedOnDependencies: [],
      basedOnFramework: [],
      basedOnPreferences: [],
      trending: []
    };

    // Suggestions basées sur les dépendances existantes
    if (context.project?.dependencies?.length > 0) {
      const deps = context.project.dependencies;
      suggestions.basedOnDependencies = await this.getRelatedLibraries(deps);
    }

    // Suggestions basées sur le framework
    if (context.project?.framework) {
      suggestions.basedOnFramework = await this.getFrameworkLibraries(context.project.framework);
    }

    // Suggestions basées sur les préférences utilisateur
    if (context.user?.preferences) {
      suggestions.basedOnPreferences = await this.getPreferenceBasedLibraries(context.user.preferences);
    }

    // Bibliothèques tendances
    suggestions.trending = await this.getTrendingLibraries();

    return suggestions;
  }

  private async getRelatedLibraries(dependencies: string[]): Promise<any[]> {
    const result = await this.db.query(`
      WITH deps AS (
        SELECT id FROM libraries WHERE name = ANY($1)
      )
      SELECT DISTINCT l.*, COUNT(*) as common_usage
      FROM libraries l
      JOIN library_dependencies ld ON l.id = ld.library_id
      WHERE ld.dependency_library_id IN (SELECT id FROM deps)
        AND l.name != ALL($1)
      GROUP BY l.id
      ORDER BY common_usage DESC, l.weekly_downloads DESC
      LIMIT 10
    `, [dependencies]);

    return result.rows;
  }

  private async getFrameworkLibraries(framework: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT l.*
      FROM libraries l
      JOIN library_tag_associations a ON l.id = a.library_id
      JOIN library_tags t ON a.tag_id = t.id
      WHERE t.name ILIKE $1 OR l.description ILIKE $1
      ORDER BY l.weekly_downloads DESC
      LIMIT 10
    `, [`%${framework}%`]);

    return result.rows;
  }

  private async getPreferenceBasedLibraries(preferences: any): Promise<any[]> {
    let query = `
      SELECT l.*, 
        SUM(
          CASE 
            WHEN l.language = ANY($1) THEN 0.3
            WHEN t.name = ANY($2) THEN 0.2
            ELSE 0
          END
        ) as preference_score
      FROM libraries l
      LEFT JOIN library_tag_associations a ON l.id = a.library_id
      LEFT JOIN library_tags t ON a.tag_id = t.id
      WHERE 1=1
    `;

    const params: any[] = [];
    
    if (preferences.languages?.length > 0) {
      params.push(preferences.languages);
    } else {
      params.push([]);
    }

    if (preferences.tags?.length > 0) {
      params.push(preferences.tags);
    } else {
      params.push([]);
    }

    query += `
      GROUP BY l.id
      HAVING preference_score > 0
      ORDER BY preference_score DESC, l.weekly_downloads DESC
      LIMIT 10
    `;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  private async getTrendingLibraries(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT *
      FROM libraries
      WHERE last_updated_at > NOW() - INTERVAL '30 days'
        AND status = 'active'
      ORDER BY 
        (weekly_downloads / NULLIF(total_downloads, 0)) DESC,
        weekly_downloads DESC
      LIMIT 10
    `);

    return result.rows;
  }
}
