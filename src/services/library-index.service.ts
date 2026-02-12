import { Pool } from 'pg';
import { Library, LibraryVersion, LibrarySearchResult, LibrarySearchQuery, LibraryTag, LibraryDependency, Maintainer, LibraryIndexData } from '../types/library.types';
import { Redis } from 'ioredis';

export class LibraryIndexService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  async searchLibraries(query: LibrarySearchQuery): Promise<LibrarySearchResult> {
    const {
      q,
      tags = [],
      language,
      license,
      status = 'active',
      sort = 'relevance',
      order = 'desc',
      limit = 20,
      offset = 0
    } = query;

    // Construction de la requête
    let sqlQuery = `
      SELECT 
        l.*,
        ts_rank(l.search_vector, plainto_tsquery($1)) as relevance_score
      FROM libraries l
    `;
    
    const params: any[] = [q || ''];
    const joins: string[] = [];
    const whereConditions: string[] = ['l.status = $2'];
    params.push(status);

    // Jointure pour les tags
    if (tags.length > 0) {
      joins.push(`
        JOIN library_tag_associations lta ON l.id = lta.library_id
        JOIN library_tags lt ON lta.tag_id = lt.id
      `);
      whereConditions.push(`lt.name = ANY($${params.length + 1})`);
      params.push(tags);
    }

    // Condition de recherche textuelle
    if (q) {
      whereConditions.push(`l.search_vector @@ plainto_tsquery($1)`);
    }

    // Filtres additionnels
    if (language) {
      whereConditions.push(`l.language = $${params.length + 1}`);
      params.push(language);
    }

    if (license) {
      whereConditions.push(`l.license = $${params.length + 1}`);
      params.push(license);
    }

    // Assemblage de la requête
    if (joins.length > 0) {
      sqlQuery += joins.join(' ');
    }
    
    sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;

    // Tri
    const sortMapping = {
      relevance: 'relevance_score DESC',
      popularity: 'l.popularity_score DESC',
      quality: 'l.quality_score DESC',
      updated: 'l.last_updated_at DESC',
      downloads: 'l.weekly_downloads DESC'
    };

    sqlQuery += ` ORDER BY ${sortMapping[sort]} ${order.toUpperCase()}`;

    // Pagination
    sqlQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Exécution
    const result = await this.db.query(sqlQuery, params);
    
    // Récupération des facets
    const facets = await this.getSearchFacets(query);

    return {
      libraries: result.rows,
      total: await this.getSearchCount(query),
      facets,
      suggestions: q ? await this.getSearchSuggestions(q) : []
    };
  }

  async getLibraryByName(name: string): Promise<Library | null> {
    const cacheKey = `library:name:${name}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query(
      'SELECT * FROM libraries WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const library = result.rows[0];
    
    // Cache pour 1 heure
    await this.redis.setex(cacheKey, 3600, JSON.stringify(library));
    
    return library;
  }

  async getLibraryVersions(libraryId: string): Promise<LibraryVersion[]> {
    const cacheKey = `library:versions:${libraryId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query(
      `SELECT * FROM library_versions 
       WHERE library_id = $1 
       ORDER BY release_date DESC, version DESC`,
      [libraryId]
    );

    const versions = result.rows;
    
    // Cache pour 30 minutes
    await this.redis.setex(cacheKey, 1800, JSON.stringify(versions));
    
    return versions;
  }

  async getLibraryDependencies(libraryId: string): Promise<LibraryDependency[]> {
    const result = await this.db.query(
      `SELECT ld.*, l.name as dependency_library_name
       FROM library_dependencies ld
       LEFT JOIN libraries l ON ld.dependency_library_id = l.id
       WHERE ld.library_id = $1
       ORDER BY ld.dependency_type, ld.dependency_name`,
      [libraryId]
    );

    return result.rows;
  }

  async getLibraryTags(libraryId: string): Promise<LibraryTag[]> {
    const result = await this.db.query(
      `SELECT t.* FROM library_tags t
       JOIN library_tag_associations a ON t.id = a.tag_id
       WHERE a.library_id = $1
       ORDER BY t.name`,
      [libraryId]
    );

    return result.rows;
  }

  async getLibraryMaintainers(libraryId: string): Promise<Maintainer[]> {
    const result = await this.db.query(
      `SELECT m.*, lm.role FROM maintainers m
       JOIN library_maintainers lm ON m.id = lm.maintainer_id
       WHERE lm.library_id = $1
       ORDER BY lm.role DESC, m.name`,
      [libraryId]
    );

    return result.rows;
  }

  async indexLibrary(libraryData: LibraryIndexData): Promise<Library> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insertion ou mise à jour de la bibliothèque
      const result = await client.query(`
        INSERT INTO libraries (
          name, display_name, description, github_url, npm_url,
          homepage_url, repository_url, license, latest_version,
          total_downloads, weekly_downloads, stars, forks, issues,
          language, status, quality_score, popularity_score,
          maintenance_score, last_updated_at, last_crawled_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (name) 
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          github_url = EXCLUDED.github_url,
          npm_url = EXCLUDED.npm_url,
          homepage_url = EXCLUDED.homepage_url,
          repository_url = EXCLUDED.repository_url,
          license = EXCLUDED.license,
          latest_version = EXCLUDED.latest_version,
          total_downloads = EXCLUDED.total_downloads,
          weekly_downloads = EXCLUDED.weekly_downloads,
          stars = EXCLUDED.stars,
          forks = EXCLUDED.forks,
          issues = EXCLUDED.issues,
          language = EXCLUDED.language,
          status = EXCLUDED.status,
          quality_score = EXCLUDED.quality_score,
          popularity_score = EXCLUDED.popularity_score,
          maintenance_score = EXCLUDED.maintenance_score,
          last_updated_at = EXCLUDED.last_updated_at,
          last_crawled_at = EXCLUDED.last_crawled_at,
          updated_at = NOW()
        RETURNING *
      `, [
        libraryData.name,
        libraryData.displayName,
        libraryData.description,
        libraryData.githubUrl,
        libraryData.npmUrl,
        libraryData.homepageUrl,
        libraryData.repositoryUrl,
        libraryData.license,
        libraryData.latestVersion,
        libraryData.totalDownloads || 0,
        libraryData.weeklyDownloads || 0,
        libraryData.stars || 0,
        libraryData.forks || 0,
        libraryData.issues || 0,
        libraryData.language || 'JavaScript',
        libraryData.status || 'active',
        libraryData.qualityScore || 0,
        libraryData.popularityScore || 0,
        libraryData.maintenanceScore || 0,
        libraryData.lastUpdatedAt,
        new Date()
      ]);

      const library = result.rows[0];

      // Invalidation du cache
      await this.invalidateLibraryCache(library.name);

      await client.query('COMMIT');
      
      return library;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    const result = await this.db.query(`
      SELECT DISTINCT name
      FROM libraries
      WHERE name % $1 AND status = 'active'
      ORDER BY similarity(name, $1) DESC
      LIMIT 5
    `, [query]);

    return result.rows.map(row => row.name);
  }

  private async getSearchFacets(query: LibrarySearchQuery): Promise<any> {
    const params = [query.status || 'active'];

    // Tags facets
    const tagsQuery = `
      SELECT t.name, COUNT(DISTINCT l.id) as count
      FROM library_tags t
      JOIN library_tag_associations a ON t.id = a.tag_id
      JOIN libraries l ON a.library_id = l.id
      WHERE l.status = $1
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 20
    `;

    const [tagsResult, languagesResult, licensesResult] = await Promise.all([
      this.db.query(tagsQuery, params),
      this.db.query(`
        SELECT language as name, COUNT(*) as count
        FROM libraries
        WHERE status = $1 AND language IS NOT NULL
        GROUP BY language
        ORDER BY count DESC
      `, params),
      this.db.query(`
        SELECT license as name, COUNT(*) as count
        FROM libraries
        WHERE status = $1 AND license IS NOT NULL
        GROUP BY license
        ORDER BY count DESC
      `, params)
    ]);

    return {
      tags: tagsResult.rows,
      languages: languagesResult.rows,
      licenses: licensesResult.rows
    };
  }

  private async getSearchCount(query: LibrarySearchQuery): Promise<number> {
    const {
      q,
      tags = [],
      language,
      license,
      status = 'active'
    } = query;

    let sqlQuery = 'SELECT COUNT(DISTINCT l.id) as count FROM libraries l';
    const joins: string[] = [];
    const whereConditions: string[] = ['l.status = $1'];
    const params: any[] = [status];

    // Jointure pour les tags
    if (tags.length > 0) {
      joins.push(`
        JOIN library_tag_associations lta ON l.id = lta.library_id
        JOIN library_tags lt ON lta.tag_id = lt.id
      `);
      whereConditions.push(`lt.name = ANY($${params.length + 1})`);
      params.push(tags);
    }

    // Condition de recherche textuelle
    if (q) {
      whereConditions.push(`l.search_vector @@ plainto_tsquery($${params.length + 1})`);
      params.push(q);
    }

    // Filtres additionnels
    if (language) {
      whereConditions.push(`l.language = $${params.length + 1}`);
      params.push(language);
    }

    if (license) {
      whereConditions.push(`l.license = $${params.length + 1}`);
      params.push(license);
    }

    // Assemblage de la requête
    if (joins.length > 0) {
      sqlQuery += joins.join(' ');
    }
    
    sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;

    const result = await this.db.query(sqlQuery, params);
    return parseInt(result.rows[0].count);
  }

  private async invalidateLibraryCache(libraryName: string): Promise<void> {
    const patterns = [
      `library:name:${libraryName}`,
      `library:versions:*`,
      'search:*'
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
