# Story 2.2: Implémentation de l'outil resolve-library-id

## Résumé

**Epic**: 2 - Serveur MCP Core  
**Story**: 2.2 - Implémentation de l'outil resolve-library-id  
**Description**: Développer l'outil MCP pour résoudre les noms de bibliothèques  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Développer l'outil MCP `resolve-library-id` qui permet aux LLM et IDE de résoudre les noms de bibliothèques en identifiant correctement les bibliothèques logicielles à partir de requêtes textuelles variées.

---

## Prérequis

- Story 2.1: Package NPM TwinMCP Server complétée
- Story 4.1: Index de bibliothèques disponible
- Library Resolution Engine implémenté
- Base de données PostgreSQL avec table libraries

---

## Spécifications Techniques

### 1. Schéma d'entrée de l'outil

```typescript
interface ResolveLibraryIdInput {
  query: string;                    // Recherche textuelle de l'utilisateur
  context?: {                       // Contexte optionnel
    language?: string;              // Langage de programmation
    framework?: string;             // Framework associé
    ecosystem?: string;             // Écosystème (npm, pip, cargo, etc.)
  };
  limit?: number;                   // Nombre max de résultats (défaut: 5)
  include_aliases?: boolean;        // Inclure les alias (défaut: true)
}
```

### 2. Schéma de sortie

```typescript
interface ResolveLibraryIdOutput {
  query: string;                    // Recherche originale
  results: Array<{
    id: string;                     // ID unique de la bibliothèque
    name: string;                   // Nom principal
    display_name: string;           // Nom affiché
    description: string;            // Description courte
    language: string;              // Langage principal
    ecosystem: string;              // Écosystème
    popularity_score: number;       // Score de popularité (0-1)
    relevance_score: number;        // Score de pertinence (0-1)
    aliases: string[];              // Alias et variantes
    tags: string[];                 // Tags de catégorisation
    latest_version: string;         // Dernière version
    homepage?: string;              // URL du site officiel
    repository?: string;            // URL du repository
    match_details: {                // Détails du matching
      matched_field: string;        // Champ qui a matché
      match_type: 'exact' | 'fuzzy' | 'alias' | 'partial';
      confidence: number;           // Confiance du match (0-1)
    };
  }>;
  total_found: number;              // Nombre total de résultats
  processing_time_ms: number;       // Temps de traitement
  suggestions?: string[];           // Suggestions si aucun résultat
}
```

---

## Tâches Détaillées

### Étape 1: Définir le schéma d'entrée pour l'outil

**Objectif**: Créer la validation et la documentation des paramètres d'entrée

**Actions**:
1. Créer le fichier `src/schemas/resolve-library-id.schema.ts`
2. Définir les types TypeScript avec Zod
3. Ajouter la validation des paramètres
4. Documenter chaque champ avec exemples

**Implémentation**:
```typescript
// src/schemas/resolve-library-id.schema.ts
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
```

**Validation**:
- Tests unitaires pour la validation
- Vérification des types et contraintes
- Tests des messages d'erreur

---

### Étape 2: Implémenter la logique de parsing de query

**Objectif**: Analyser et normaliser la requête utilisateur

**Actions**:
1. Créer le service `QueryParserService`
2. Implémenter la normalisation de texte
3. Extraire les entités et patterns
4. Gérer les variations et fautes de frappe

**Implémentation**:
```typescript
// src/services/query-parser.service.ts
import { levenshtein } from 'fast-levenshtein';

export class QueryParserService {
  private readonly COMMON_PATTERNS = {
    js_frameworks: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'],
    python_frameworks: ['django', 'flask', 'fastapi', 'tornado'],
    rust_crates: ['tokio', 'serde', 'axum', 'warp', 'rocket'],
    node_libraries: ['express', 'koa', 'fastify', 'hapi', 'nest'],
    php_frameworks: ['laravel', 'symfony', 'codeigniter', 'yii']
  };

  private readonly ECOSYSTEM_PATTERNS = {
    npm: /^(npm|node|js|javascript)/i,
    pip: /^(pip|python|py)/i,
    cargo: /^(cargo|rust|rs)/i,
    composer: /^(composer|php)/i,
    maven: /^(maven|java|jar)/i,
    gem: /^(gem|ruby|rb)/i
  };

  parseQuery(query: string, context?: any): ParsedQuery {
    const normalized = this.normalizeQuery(query);
    const tokens = this.tokenize(normalized);
    const entities = this.extractEntities(tokens);
    const ecosystem = this.detectEcosystem(normalized, context);
    const language = this.detectLanguage(normalized, context, ecosystem);

    return {
      original: query,
      normalized,
      tokens,
      entities,
      ecosystem,
      language,
      confidence: this.calculateConfidence(normalized, entities)
    };
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      // Remplacer les caractères spéciaux
      .replace(/[^\w\s\-@\/\.]/g, '')
      // Normaliser les séparateurs
      .replace(/[\s_\-]+/g, ' ')
      // Gérer les cas courants
      .replace(/^js /, 'javascript ')
      .replace(/^py /, 'python ')
      .replace(/^ts /, 'typescript ');
  }

  private tokenize(query: string): string[] {
    return query
      .split(' ')
      .filter(token => token.length > 0)
      .filter(token => !this.isStopWord(token));
  }

  private extractEntities(tokens: string[]): QueryEntity[] {
    const entities: QueryEntity[] = [];

    tokens.forEach((token, index) => {
      // Vérifier les patterns connus
      for (const [category, patterns] of Object.entries(this.COMMON_PATTERNS)) {
        if (patterns.includes(token)) {
          entities.push({
            type: 'framework',
            value: token,
            category,
            position: index,
            confidence: 1.0
          });
        }
      }

      // Extraire les versions
      const versionMatch = token.match(/^(\d+\.)*\d+$/);
      if (versionMatch) {
        entities.push({
          type: 'version',
          value: token,
          position: index,
          confidence: 0.9
        });
      }

      // Extraire les noms de bibliothèques potentiels
      if (this.looksLikeLibraryName(token)) {
        entities.push({
          type: 'library',
          value: token,
          position: index,
          confidence: this.calculateTokenConfidence(token)
        });
      }
    });

    return entities;
  }

  private detectEcosystem(query: string, context?: any): string | null {
    // Vérifier le contexte explicite
    if (context?.ecosystem) {
      return context.ecosystem;
    }

    // Détecter depuis la requête
    for (const [ecosystem, pattern] of Object.entries(this.ECOSYSTEM_PATTERNS)) {
      if (pattern.test(query)) {
        return ecosystem;
      }
    }

    return null;
  }

  private detectLanguage(query: string, context?: any, ecosystem?: string | null): string | null {
    // Vérifier le contexte explicite
    if (context?.language) {
      return context.language;
    }

    // Déduire depuis l'écosystème
    const ecosystemLanguageMap: Record<string, string> = {
      npm: 'javascript',
      pip: 'python',
      cargo: 'rust',
      composer: 'php',
      maven: 'java',
      gem: 'ruby'
    };

    if (ecosystem && ecosystemLanguageMap[ecosystem]) {
      return ecosystemLanguageMap[ecosystem];
    }

    // Détecter depuis les patterns dans la requête
    if (query.includes('javascript') || query.includes('js') || query.includes('node')) {
      return 'javascript';
    }
    if (query.includes('python') || query.includes('py')) {
      return 'python';
    }
    if (query.includes('rust') || query.includes('rs')) {
      return 'rust';
    }

    return null;
  }

  private calculateConfidence(normalized: string, entities: QueryEntity[]): number {
    let confidence = 0.5; // Base confidence

    // Bonus pour les entités reconnues
    const recognizedEntities = entities.filter(e => e.confidence > 0.8);
    confidence += recognizedEntities.length * 0.1;

    // Bonus pour la longueur appropriée
    if (normalized.length >= 3 && normalized.length <= 50) {
      confidence += 0.1;
    }

    // Bonus pour les formats standards
    if (/^[a-z][a-z0-9\-_]*$/.test(normalized)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private isStopWord(token: string): boolean {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return stopWords.includes(token);
  }

  private looksLikeLibraryName(token: string): boolean {
    // Au moins 2 caractères, commence par une lettre
    if (token.length < 2 || !/^[a-zA-Z]/.test(token)) {
      return false;
    }

    // Contient uniquement des caractères valides pour les noms de package
    return /^[a-zA-Z0-9\-_\.]+$/.test(token);
  }

  private calculateTokenConfidence(token: string): number {
    let confidence = 0.5;

    // Bonus pour la longueur appropriée
    if (token.length >= 3 && token.length <= 20) {
      confidence += 0.2;
    }

    // Bonus pour les formats courants
    if (/^[a-z][a-z0-9]*$/.test(token)) {
      confidence += 0.2;
    }

    // Bonus pour les mots connus
    if (this.isKnownLibrary(token)) {
      confidence += 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  private isKnownLibrary(token: string): boolean {
    // Pour l'instant, placeholder - sera implémenté avec la base de données
    return false;
  }
}

interface ParsedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  entities: QueryEntity[];
  ecosystem: string | null;
  language: string | null;
  confidence: number;
}

interface QueryEntity {
  type: 'library' | 'framework' | 'version' | 'language';
  value: string;
  position: number;
  confidence: number;
  category?: string;
}
```

**Validation**:
- Tests de parsing avec différentes requêtes
- Validation de la détection d'entités
- Tests de normalisation

---

### Étape 3: Intégrer avec le Library Resolution Engine

**Objectif**: Connecter avec le moteur de recherche de bibliothèques

**Actions**:
1. Créer le service `LibraryResolutionService`
2. Implémenter la recherche dans PostgreSQL
3. Ajouter le scoring et ranking
4. Gérer le cache des résultats

**Implémentation**:
```typescript
// src/services/library-resolution.service.ts
import { Pool } from 'pg';
import { Redis } from 'redis';

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
        .slice(0, input.limit);

      // Générer des suggestions si nécessaire
      const suggestions = finalResults.length === 0 
        ? await this.generateSuggestions(parsed)
        : undefined;

      const output: ResolveLibraryIdOutput = {
        query: input.query,
        results: finalResults,
        total_found: results.length,
        processing_time_ms: Date.now() - startTime,
        suggestions
      };

      // Mettre en cache
      await this.redis.setex(cacheKey, 300, JSON.stringify(output));

      return output;

    } catch (error) {
      throw new Error(`Library resolution failed: ${error.message}`);
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
    if (input.include_aliases) {
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
    return result.rows.map(row => row.alias);
  }

  private async generateSuggestions(parsed: ParsedQuery): Promise<string[]> {
    const suggestions: string[] = [];

    // Suggestions basées sur les similarités
    const similarQuery = `
      SELECT DISTINCT name
      FROM libraries
      WHERE levenshtein(name, $1) <= 2
      ORDER BY popularity_score DESC
      LIMIT 5
    `;

    const result = await this.db.query(similarQuery, [parsed.normalized]);
    suggestions.push(...result.rows.map(row => row.name));

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
        suggestions.push(...tokenResult.rows.map(row => row.name));
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

interface RawLibraryResult {
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

interface LibraryResult extends RawLibraryResult {
  relevance_score: number;
  aliases: string[];
  match_details: MatchDetails;
}

interface MatchDetails {
  matched_field: string;
  match_type: 'exact' | 'fuzzy' | 'alias' | 'partial';
  confidence: number;
}
```

**Validation**:
- Tests de recherche avec différentes requêtes
- Validation du scoring
- Tests du cache

---

### Étape 4: Ajouter la validation et la gestion des erreurs

**Objectif**: Créer l'outil MCP complet avec gestion robuste des erreurs

**Actions**:
1. Créer la classe `ResolveLibraryIdTool`
2. Implémenter la validation complète
3. Ajouter la gestion des erreurs détaillée
4. Intégrer avec le SDK MCP

**Implémentation**:
```typescript
// src/tools/resolve-library-id.tool.ts
import { Tool } from '@modelcontextprotocol/sdk/tools';
import { ResolveLibraryIdInputSchema, ResolveLibraryIdOutputSchema } from '../schemas/resolve-library-id.schema';
import { LibraryResolutionService } from '../services/library-resolution.service';

export class ResolveLibraryIdTool extends Tool {
  name = 'resolve-library-id';
  description = 'Resolve library names and find matching software libraries';
  
  private resolutionService: LibraryResolutionService;

  constructor(resolutionService: LibraryResolutionService) {
    super();
    this.resolutionService = resolutionService;
  }

  async run(input: unknown): Promise<any> {
    try {
      // Valider l'entrée
      const validatedInput = ResolveLibraryIdInputSchema.parse(input);
      
      // Log de la requête
      console.log(`[ResolveLibraryId] Processing query: "${validatedInput.query}"`);
      
      // Résoudre la bibliothèque
      const result = await this.resolutionService.resolveLibrary(validatedInput);
      
      // Valider la sortie
      const validatedOutput = ResolveLibraryIdOutputSchema.parse(result);
      
      // Log du résultat
      console.log(`[ResolveLibraryId] Found ${validatedOutput.results.length} results in ${validatedOutput.processing_time_ms}ms`);
      
      return validatedOutput;
      
    } catch (error) {
      // Gestion des erreurs
      if (error.name === 'ZodError') {
        return {
          success: false,
          error: 'Invalid input parameters',
          details: error.errors,
          timestamp: new Date().toISOString()
        };
      }
      
      console.error(`[ResolveLibraryId] Error: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: 'Library resolution failed',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getInputSchema(): any {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Library name to search for',
          minLength: 1,
          maxLength: 200
        },
        context: {
          type: 'object',
          properties: {
            language: { type: 'string' },
            framework: { type: 'string' },
            ecosystem: { type: 'string' }
          },
          description: 'Optional context to refine the search'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Maximum number of results to return'
        },
        include_aliases: {
          type: 'boolean',
          default: true,
          description: 'Include aliases and variants in search'
        }
      },
      required: ['query']
    };
  }
}
```

**Validation**:
- Tests E2E de l'outil complet
- Validation des erreurs
- Tests de performance

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── tools/
│   └── resolve-library-id.tool.ts
├── services/
│   ├── query-parser.service.ts
│   └── library-resolution.service.ts
├── schemas/
│   └── resolve-library-id.schema.ts
├── types/
│   └── library.types.ts
└── utils/
    └── text-utils.ts
```

### Flux de données

1. **Input Validation** → Schéma Zod
2. **Query Parsing** → QueryParserService
3. **Database Search** → PostgreSQL
4. **Scoring & Ranking** → Algorithmes de pertinence
5. **Cache Layer** → Redis
6. **Response Formatting** → Output structuré

---

## Tests

### Tests unitaires

```typescript
// __tests__/services/query-parser.service.test.ts
describe('QueryParserService', () => {
  let parser: QueryParserService;

  beforeEach(() => {
    parser = new QueryParserService();
  });

  test('should normalize query correctly', () => {
    const result = parser.parseQuery('React.js');
    expect(result.normalized).toBe('react js');
  });

  test('should detect JavaScript ecosystem', () => {
    const result = parser.parseQuery('npm react');
    expect(result.ecosystem).toBe('npm');
    expect(result.language).toBe('javascript');
  });

  test('should extract framework entities', () => {
    const result = parser.parseQuery('react hooks');
    const frameworks = result.entities.filter(e => e.type === 'framework');
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0].value).toBe('react');
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/resolve-library-id.integration.test.ts
describe('Resolve Library ID Integration', () => {
  let tool: ResolveLibraryIdTool;
  let mockDB: Pool;
  let mockRedis: Redis;

  beforeEach(() => {
    mockDB = createMockDatabase();
    mockRedis = createMockRedis();
    const resolutionService = new LibraryResolutionService(mockDB, mockRedis);
    tool = new ResolveLibraryIdTool(resolutionService);
  });

  test('should resolve React library correctly', async () => {
    const input = {
      query: 'react',
      limit: 5
    };
    
    const result = await tool.run(input);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('react');
    expect(result.results[0].language).toBe('javascript');
    expect(result.results[0].ecosystem).toBe('npm');
  });

  test('should handle misspelled queries', async () => {
    const input = {
      query: 'reack', // Faute de frappe
      limit: 5
    };
    
    const result = await tool.run(input);
    
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.suggestions).toContain('react');
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de réponse**: < 200ms
- **Précision**: > 90% pour les requêtes exactes
- **Cache hit rate**: > 60%
- **Memory usage**: < 50MB

### Optimisations

1. **Index PostgreSQL** optimisés pour la recherche textuelle
2. **Cache Redis** avec TTL de 5 minutes
3. **Levenshtein distance** pour les fautes de frappe
4. **Connection pooling** pour la base de données

---

## Monitoring et Logging

### Logs structurés

```typescript
logger.info('Library resolution request', {
  query: input.query,
  normalized: parsed.normalized,
  ecosystem: parsed.ecosystem,
  language: parsed.language,
  results_count: results.length,
  processing_time_ms: output.processing_time_ms,
  cache_hit: cached
});
```

### Métriques

```typescript
export const LibraryResolutionMetrics = {
  requestsTotal: new Counter('library_resolution_requests_total'),
  responseTime: new Histogram('library_resolution_response_time_seconds'),
  cacheHitRate: new Gauge('library_resolution_cache_hit_rate'),
  accuracyRate: new Gauge('library_resolution_accuracy_rate')
};
```

---

## Dépendances

### Packages requis

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "zod": "^3.22.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "fast-levenshtein": "^3.0.0"
  }
}
```

### Base de données

```sql
-- Table principale des bibliothèques
CREATE TABLE libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  language VARCHAR(50) NOT NULL,
  ecosystem VARCHAR(50) NOT NULL,
  popularity_score DECIMAL(3,2) DEFAULT 0.0,
  latest_version VARCHAR(50),
  homepage VARCHAR(500),
  repository VARCHAR(500),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des aliases
CREATE TABLE library_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID REFERENCES libraries(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(library_id, alias)
);

-- Index pour la recherche
CREATE INDEX idx_libraries_name ON libraries USING gin(to_tsvector('english', name));
CREATE INDEX idx_libraries_display_name ON libraries USING gin(to_tsvector('english', display_name));
CREATE INDEX idx_libraries_description ON libraries USING gin(to_tsvector('english', description));
CREATE INDEX idx_libraries_ecosystem ON libraries(ecosystem);
CREATE INDEX idx_libraries_language ON libraries(language);
CREATE INDEX idx_library_aliases_alias ON library_aliases USING gin(to_tsvector('english', alias));

-- Extension pour Levenshtein (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

---

## Risques et Mitigations

### Risques identifiés

1. **Performance dégradée** → Cache et indexation
2. **Résultats non pertinents** → Scoring avancé
3. **Timeout base de données** → Connection pooling
4. **Memory leak** → Monitoring et cleanup

### Stratégies de mitigation

1. **Cache multi-niveaux** (Redis + mémoire)
2. **Fallback vers recherche simple**
3. **Timeout configurables**
4. **Monitoring temps réel**

---

## Livrables

1. **Outil MCP resolve-library-id** complet et testé
2. **Service de parsing** robuste
3. **Service de résolution** performant
4. **Cache Redis** optimisé
5. **Documentation** complète avec exemples
6. **Tests** unitaires et d'intégration

---

## Critères d'Achèvement

✅ L'outil accepte et valide les entrées correctement  
✅ Le parsing normalise les requêtes efficacement  
✅ La recherche retourne des résultats pertinents  
✅ Le scoring classe les résultats correctement  
✅ Le cache améliore les performances  
✅ Les erreurs sont gérées proprement  
✅ Les tests passent avec > 90% de couverture  
✅ La documentation est complète  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 4-5 jours
- **Assigné à**: À définir
- **Réviseur**: À définir