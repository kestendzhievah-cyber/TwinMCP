# E4-Story4-1-Index-Bibliotheques.md

## Epic 4: Library Resolution Engine

### Story 4.1: Index de bibliothèques

**Description**: Création et peuplement de l'index des bibliothèques supportées

---

## Objectif

Créer un index complet et performant des bibliothèques JavaScript/TypeScript supportées, avec leurs métadonnées, dépendances et informations de compatibilité pour permettre une résolution rapide et précise des requêtes.

---

## Prérequis

- Base de données PostgreSQL configurée
- Service de crawling GitHub (Epic 6) partiellement fonctionnel
- API Gateway (Epic 3) avec endpoints CRUD
- Redis pour le cache des requêtes fréquentes

---

## Spécifications Techniques

### 1. Schéma de Base de Données

#### 1.1 Tables Principales

```sql
-- src/db/schema/libraries.sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- Bibliothèques principales
CREATE TABLE libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    github_url TEXT,
    npm_url TEXT,
    homepage_url TEXT,
    repository_url TEXT,
    license VARCHAR(100),
    latest_version VARCHAR(50),
    total_downloads BIGINT DEFAULT 0,
    weekly_downloads BIGINT DEFAULT 0,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    issues INTEGER DEFAULT 0,
    language VARCHAR(50) DEFAULT 'JavaScript',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'archived')),
    quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
    popularity_score DECIMAL(3,2) CHECK (popularity_score >= 0 AND popularity_score <= 1),
    maintenance_score DECIMAL(3,2) CHECK (maintenance_score >= 0 AND maintenance_score <= 1),
    last_updated_at TIMESTAMP WITH TIME ZONE,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index pour la recherche
    search_vector tsvector,
    
    -- Contraintes
    CONSTRAINT unique_library_name UNIQUE (name),
    CONSTRAINT valid_github_url CHECK (github_url ~ '^https://github\.com/[^/]+/[^/]+$' OR github_url IS NULL),
    CONSTRAINT valid_npm_url CHECK (npm_url ~ '^https://www\.npmjs\.com/package/[^/]+$' OR npm_url IS NULL)
);

-- Versions des bibliothèques
CREATE TABLE library_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    is_latest BOOLEAN DEFAULT false,
    is_prerelease BOOLEAN DEFAULT false,
    release_date TIMESTAMP WITH TIME ZONE,
    downloads BIGINT DEFAULT 0,
    deprecated BOOLEAN DEFAULT false,
    deprecation_message TEXT,
    engines JSONB, -- { "node": ">=14", "npm": ">=6" }
    dependencies JSONB, -- { "dependencies": {}, "devDependencies": {}, "peerDependencies": {} }
    dist JSONB, -- { "size": 12345, "unpackedSize": 54321 }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_library_version UNIQUE (library_id, version)
);

-- Tags et catégories
CREATE TABLE library_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),
    description TEXT,
    color VARCHAR(7), -- hex color
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Association bibliothèques-tags
CREATE TABLE library_tag_associations (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
    confidence DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (library_id, tag_id)
);

-- Dépendances entre bibliothèques
CREATE TABLE library_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    dependency_library_id UUID REFERENCES libraries(id) ON DELETE SET NULL,
    dependency_name VARCHAR(255) NOT NULL, -- pour les deps externes
    version_range VARCHAR(100),
    dependency_type VARCHAR(20) NOT NULL CHECK (dependency_type IN ('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies')),
    is_external BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mainteneurs
CREATE TABLE maintainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_username VARCHAR(255) UNIQUE,
    npm_username VARCHAR(255),
    name VARCHAR(255),
    email TEXT,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(255),
    company VARCHAR(255),
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    public_repos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Association bibliothèques-mainteneurs
CREATE TABLE library_maintainers (
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    maintainer_id UUID NOT NULL REFERENCES maintainers(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'maintainer' CHECK (role IN ('owner', 'maintainer', 'contributor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (library_id, maintainer_id)
);

-- Index pour la recherche textuelle
CREATE INDEX idx_libraries_search_vector ON libraries USING GIN(search_vector);
CREATE INDEX idx_libraries_name_trgm ON libraries USING GIN(name gin_trgm_ops);
CREATE INDEX idx_libraries_description_trgm ON libraries USING GIN(description gin_trgm_ops);

-- Index pour les filtres
CREATE INDEX idx_libraries_status ON libraries(status);
CREATE INDEX idx_libraries_language ON libraries(language);
CREATE INDEX idx_libraries_quality_score ON libraries(quality_score DESC);
CREATE INDEX idx_libraries_popularity_score ON libraries(popularity_score DESC);
CREATE INDEX idx_libraries_last_updated ON libraries(last_updated_at DESC);

-- Index pour les versions
CREATE INDEX idx_library_versions_library_latest ON library_versions(library_id, is_latest);
CREATE INDEX idx_library_versions_release_date ON library_versions(release_date DESC);

-- Trigger pour mettre à jour le search_vector
CREATE OR REPLACE FUNCTION update_library_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.display_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(
            ARRAY(SELECT t.name FROM library_tags t 
                  JOIN library_tag_associations a ON t.id = a.tag_id 
                  WHERE a.library_id = NEW.id), ' ', ''
        ), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_library_search_vector
    BEFORE INSERT OR UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();
```

#### 1.2 TypeScript Interfaces

```typescript
// src/types/library.types.ts
export interface Library {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  githubUrl?: string;
  npmUrl?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  latestVersion?: string;
  totalDownloads: number;
  weeklyDownloads: number;
  stars: number;
  forks: number;
  issues: number;
  language: string;
  status: 'active' | 'deprecated' | 'archived';
  qualityScore: number;
  popularityScore: number;
  maintenanceScore: number;
  lastUpdatedAt?: Date;
  lastCrawledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryVersion {
  id: string;
  libraryId: string;
  version: string;
  isLatest: boolean;
  isPrerelease: boolean;
  releaseDate?: Date;
  downloads: number;
  deprecated: boolean;
  deprecationMessage?: string;
  engines?: {
    node?: string;
    npm?: string;
  };
  dependencies?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  dist?: {
    size: number;
    unpackedSize: number;
  };
  createdAt: Date;
}

export interface LibraryTag {
  id: string;
  name: string;
  category?: string;
  description?: string;
  color?: string;
  createdAt: Date;
}

export interface LibraryDependency {
  id: string;
  libraryId: string;
  dependencyLibraryId?: string;
  dependencyName: string;
  versionRange?: string;
  dependencyType: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  isExternal: boolean;
  createdAt: Date;
}

export interface Maintainer {
  id: string;
  githubUsername?: string;
  npmUsername?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibrarySearchResult {
  libraries: Library[];
  total: number;
  facets: {
    tags: Array<{ name: string; count: number }>;
    languages: Array<{ name: string; count: number }>;
    licenses: Array<{ name: string; count: number }>;
  };
  suggestions?: string[];
}
```

### 2. Service d'Indexation

#### 2.1 Library Index Service

```typescript
// src/services/library-index.service.ts
import { Pool } from 'pg';
import { Library, LibraryVersion, LibrarySearchResult } from '../types/library.types';
import { Redis } from 'ioredis';

export class LibraryIndexService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  async searchLibraries(query: {
    q?: string;
    tags?: string[];
    language?: string;
    license?: string;
    status?: string;
    sort?: 'relevance' | 'popularity' | 'quality' | 'updated' | 'downloads';
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<LibrarySearchResult> {
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
      suggestions: q ? await this.getSearchSuggestions(q) : undefined
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

  async indexLibrary(libraryData: Partial<Library>): Promise<Library> {
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

  private async getSearchFacets(query: any): Promise<any> {
    // Implémentation des facets pour les filtres
    const baseQuery = `
      SELECT COUNT(DISTINCT l.id) as count
      FROM libraries l
      WHERE l.status = $1
    `;
    
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

  private async getSearchCount(query: any): Promise<number> {
    // Implémentation du comptage pour la pagination
    return 0; // Simplifié pour l'exemple
  }

  private async getSearchSuggestions(query: string): Promise<string[]> {
    // Implémentation des suggestions de recherche
    const result = await this.db.query(`
      SELECT DISTINCT name
      FROM libraries
      WHERE name % $1 AND status = 'active'
      ORDER BY similarity(name, $1) DESC
      LIMIT 5
    `, [query]);

    return result.rows.map(row => row.name);
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
```

### 3. API Endpoints

#### 3.1 Library Controller

```typescript
// src/controllers/library.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { LibraryIndexService } from '../services/library-index.service';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'archived']).optional(),
  sort: z.enum(['relevance', 'popularity', 'quality', 'updated', 'downloads']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

export class LibraryController {
  constructor(private libraryIndexService: LibraryIndexService) {}

  async searchLibraries(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = searchQuerySchema.parse(request.query);
      const result = await this.libraryIndexService.searchLibraries(query);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        error: 'Invalid search parameters'
      });
    }
  }

  async getLibrary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      const library = await this.libraryIndexService.getLibraryByName(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      // Récupération des informations complémentaires
      const [versions, dependencies, tags, maintainers] = await Promise.all([
        this.libraryIndexService.getLibraryVersions(library.id),
        this.libraryIndexService.getLibraryDependencies(library.id),
        this.libraryIndexService.getLibraryTags(library.id),
        this.libraryIndexService.getLibraryMaintainers(library.id)
      ]);

      return reply.send({
        success: true,
        data: {
          ...library,
          versions,
          dependencies,
          tags,
          maintainers
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLibraryVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.params as { name: string };
      const library = await this.libraryIndexService.getLibraryByName(name);
      
      if (!library) {
        return reply.code(404).send({
          success: false,
          error: 'Library not found'
        });
      }

      const versions = await this.libraryIndexService.getLibraryVersions(library.id);
      
      return reply.send({
        success: true,
        data: versions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { q } = request.query as { q?: string };
      
      if (!q || q.length < 2) {
        return reply.send({
          success: true,
          data: []
        });
      }

      const suggestions = await this.libraryIndexService.getSearchSuggestions(q);
      
      return reply.send({
        success: true,
        data: suggestions
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}
```

### 4. Population Initiale

#### 4.1 Script d'Import

```typescript
// src/scripts/populate-libraries.ts
import { Pool } from 'pg';
import { LibraryIndexService } from '../services/library-index.service';
import Redis from 'ioredis';

const POPULAR_LIBRARIES = [
  'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
  'express', 'fastify', 'koa', 'hapi', 'nestjs',
  'lodash', 'axios', 'moment', 'dayjs', 'date-fns',
  'typescript', 'babel', 'webpack', 'vite', 'rollup',
  'jest', 'mocha', 'vitest', 'cypress', 'playwright',
  'eslint', 'prettier', 'husky', 'lint-staged',
  'react-router', 'redux', 'mobx', 'zustand', 'recoil',
  'mongoose', 'prisma', 'sequelize', 'typeorm',
  'passport', 'jsonwebtoken', 'bcrypt', 'argon2'
];

export class LibraryPopulator {
  constructor(
    private libraryIndexService: LibraryIndexService,
    private npmClient: any,
    private githubClient: any
  ) {}

  async populateInitialLibraries(): Promise<void> {
    console.log('Starting initial library population...');
    
    for (const libraryName of POPULAR_LIBRARIES) {
      try {
        await this.populateLibrary(libraryName);
        console.log(`✓ Populated ${libraryName}`);
      } catch (error) {
        console.error(`✗ Failed to populate ${libraryName}:`, error);
      }
    }
    
    console.log('Initial population completed');
  }

  private async populateLibrary(name: string): Promise<void> {
    // Récupération des données depuis NPM
    const npmData = await this.npmClient.getPackage(name);
    
    // Récupération des données depuis GitHub
    let githubData = null;
    if (npmData.repository?.url?.includes('github.com')) {
      const githubUrl = this.extractGithubUrl(npmData.repository.url);
      githubData = await this.githubClient.getRepo(githubUrl);
    }

    // Calcul des scores
    const qualityScore = this.calculateQualityScore(npmData, githubData);
    const popularityScore = this.calculatePopularityScore(npmData, githubData);
    const maintenanceScore = this.calculateMaintenanceScore(npmData, githubData);

    // Indexation
    await this.libraryIndexService.indexLibrary({
      name: npmData.name,
      displayName: npmData.name,
      description: npmData.description,
      githubUrl: githubData?.html_url,
      npmUrl: `https://www.npmjs.com/package/${npmData.name}`,
      homepageUrl: npmData.homepage,
      repositoryUrl: npmData.repository?.url,
      license: npmData.license,
      latestVersion: npmData['dist-tags']?.latest,
      totalDownloads: npmData.downloads || 0,
      weeklyDownloads: npmData.weeklyDownloads || 0,
      stars: githubData?.stargazers_count || 0,
      forks: githubData?.forks_count || 0,
      issues: githubData?.open_issues_count || 0,
      language: githubData?.language || 'JavaScript',
      status: this.determineStatus(npmData, githubData),
      qualityScore,
      popularityScore,
      maintenanceScore,
      lastUpdatedAt: new Date(npmData.modified),
      lastCrawledAt: new Date()
    });
  }

  private extractGithubUrl(repositoryUrl: string): string {
    // Extraction du URL GitHub depuis various formats
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\)]+)/);
    return match ? `${match[1]}/${match[2]}` : '';
  }

  private calculateQualityScore(npmData: any, githubData: any): number {
    let score = 0;
    
    // Tests (25%)
    if (npmData.scripts?.test) score += 0.25;
    
    // Documentation (20%)
    if (npmData.readme || npmData.homepage) score += 0.20;
    
    // Build system (15%)
    if (npmData.scripts?.build) score += 0.15;
    
    // Linting (10%)
    if (npmData.devDependencies?.eslint || npmData.devDependencies?.prettier) score += 0.10;
    
    // TypeScript support (15%)
    if (npmData.types || npmData.tsconfig) score += 0.15;
    
    // CI/CD (15%)
    if (githubData?.has_ci) score += 0.15;
    
    return Math.min(1, score);
  }

  private calculatePopularityScore(npmData: any, githubData: any): number {
    const downloads = npmData.downloads || 0;
    const stars = githubData?.stargazers_count || 0;
    
    // Normalisation sur une échelle logarithmique
    const downloadScore = Math.log10(Math.max(1, downloads)) / 7; // Max ~10M downloads
    const starScore = Math.log10(Math.max(1, stars)) / 5; // Max ~100K stars
    
    return Math.min(1, (downloadScore + starScore) / 2);
  }

  private calculateMaintenanceScore(npmData: any, githubData: any): number {
    let score = 0.5; // Base score
    
    // Recent activity (30%)
    const lastUpdate = new Date(npmData.modified);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) score += 0.30;
    else if (daysSinceUpdate < 90) score += 0.20;
    else if (daysSinceUpdate < 365) score += 0.10;
    
    // Open issues (20%)
    const openIssues = githubData?.open_issues_count || 0;
    if (openIssues < 10) score += 0.20;
    else if (openIssues < 50) score += 0.10;
    
    // Contributors (20%)
    const contributors = githubData?.contributors_count || 0;
    if (contributors > 10) score += 0.20;
    else if (contributors > 3) score += 0.10;
    
    // License (10%)
    if (npmData.license) score += 0.10;
    
    return Math.min(1, score);
  }

  private determineStatus(npmData: any, githubData: any): string {
    if (npmData.deprecated) return 'deprecated';
    if (githubData?.archived) return 'archived';
    return 'active';
  }
}

// Exécution
if (require.main === module) {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL);
  
  const libraryIndexService = new LibraryIndexService(db, redis);
  const populator = new LibraryPopulator(
    libraryIndexService,
    null, // npm client
    null  // github client
  );
  
  populator.populateInitialLibraries()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
```

---

## Tâches Détaillées

### 1. Création du Schéma
- [ ] Créer les tables PostgreSQL avec extensions
- [ ] Définir les index et triggers
- [ ] Implémenter les contraintes et validations

### 2. Service d'Indexation
- [ ] Développer LibraryIndexService
- [ ] Implémenter la recherche textuelle avec tsvector
- [ ] Ajouter le support des facets et filtres

### 3. API Endpoints
- [ ] Créer les endpoints de recherche et récupération
- [ ] Implémenter la validation avec Zod
- [ ] Ajouter le cache Redis

### 4. Population Initiale
- [ ] Développer le script d'import
- [ ] Intégrer les APIs NPM et GitHub
- [ ] Implémenter les algorithmes de scoring

---

## Validation

### Tests du Service

```typescript
// __tests__/library-index.service.test.ts
describe('LibraryIndexService', () => {
  let service: LibraryIndexService;
  let db: Pool;
  let redis: Redis;

  beforeEach(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    redis = new Redis(process.env.TEST_REDIS_URL);
    service = new LibraryIndexService(db, redis);
  });

  describe('searchLibraries', () => {
    it('should return relevant results for text search', async () => {
      const result = await service.searchLibraries({
        q: 'react',
        limit: 10
      });

      expect(result.libraries).toHaveLength(10);
      expect(result.total).toBeGreaterThan(0);
      expect(result.facets).toBeDefined();
    });

    it('should filter by tags', async () => {
      const result = await service.searchLibraries({
        tags: ['frontend', 'react'],
        limit: 5
      });

      expect(result.libraries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getLibraryByName', () => {
    it('should return library with caching', async () => {
      // First call
      const library1 = await service.getLibraryByName('react');
      expect(library1).toBeDefined();

      // Second call should use cache
      const library2 = await service.getLibraryByName('react');
      expect(library2).toEqual(library1);
    });
  });
});
```

---

## Architecture

### Composants

1. **PostgreSQL**: Stockage principal avec recherche textuelle
2. **Redis**: Cache des requêtes fréquentes
3. **LibraryIndexService**: Logique de recherche et indexation
4. **LibraryController**: Endpoints API
5. **LibraryPopulator**: Script d'import initial

### Flux de Données

```
NPM/GitHub API → LibraryPopulator → LibraryIndexService → PostgreSQL
                                                    ↓
Client ← API Gateway ← LibraryController ← Redis Cache
```

---

## Performance

### Optimisations

- **Index GIN**: Pour la recherche textuelle rapide
- **Cache Redis**: Pour les requêtes fréquentes
- **Connection Pooling**: PostgreSQL pool optimisé
- **Pagination**: Limitation des résultats

### Métriques Cibles

- **Recherche**: < 100ms pour 90% des requêtes
- **Indexation**: 1000 bibliothèques/minute
- **Cache Hit Rate**: > 80%

---

## Monitoring

### Métriques

- `library.search.requests_total`: Nombre de recherches
- `library.search.latency`: Latence des recherches
- `library.index.total`: Bibliothèques indexées
- `library.cache.hit_rate`: Taux de cache hits

---

## Livrables

1. **Schéma DB**: Tables et index PostgreSQL
2. **Services**: LibraryIndexService complet
3. **API**: Endpoints de recherche et récupération
4. **Scripts**: Population initiale
5. **Tests**: Suite de tests complète

---

## Critères de Succès

- [ ] Index de 1000+ bibliothèques populaires
- [ ] Recherche textuelle < 100ms
- [ ] Cache hit rate > 80%
- [ ] API REST complète et documentée
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Monitoring**: Surveillance des performances
2. **Enrichissement**: Ajout de nouvelles bibliothèques
3. **Optimisation**: Ajustement des algorithmes de scoring
4. **Documentation**: Mise à jour continue
