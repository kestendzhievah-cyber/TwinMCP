# Story 2.3: Implémentation de l'outil query-docs

## Résumé

**Epic**: 2 - Serveur MCP Core  
**Story**: 2.3 - Implémentation de l'outil query-docs  
**Description**: Développer l'outil MCP pour interroger la documentation  
**Auteur**: TwinMCP Team  
**Date de création**: 2025-01-10  
**Statut**: À faire  
**Priorité**: Haute  

---

## Objectif

Développer l'outil MCP `query-docs` qui permet aux LLM et IDE d'interroger la documentation des bibliothèques logicielles en utilisant la recherche vectorielle et d'assembler le contexte optimisé pour la génération de réponses.

---

## Prérequis

- Story 2.1: Package NPM TwinMCP Server complétée
- Story 5.1: Génération d'embeddings fonctionnelle
- Story 5.2: Recherche vectorielle opérationnelle
- Vector Store (Pinecone/Qdrant) configuré
- Base de données PostgreSQL avec métadonnées

---

## Spécifications Techniques

### 1. Schéma d'entrée de l'outil

```typescript
interface QueryDocsInput {
  library_id: string;           // ID unique de la bibliothèque
  query: string;               // Question ou recherche de l'utilisateur
  version?: string;            // Version spécifique (optionnel)
  max_results?: number;        // Nombre max de résultats (défaut: 5)
  include_code?: boolean;      // Inclure les snippets de code
  context_limit?: number;      // Limite de tokens (défaut: 4000)
}
```

### 2. Schéma de sortie

```typescript
interface QueryDocsOutput {
  library: {
    id: string;
    name: string;
    version: string;
    description: string;
  };
  query: string;
  results: Array<{
    content: string;
    metadata: {
      source: string;
      url: string;
      section: string;
      type: 'text' | 'code' | 'example';
      relevance_score: number;
    };
  }>;
  context: string;             // Assemblage optimisé pour LLM
  total_tokens: number;
  truncated: boolean;
}
```

---

## Tâches Détaillées

### Étape 1: Définir le schéma d'entrée pour l'outil

**Objectif**: Créer la validation et la documentation des paramètres d'entrée

**Actions**:
1. Créer le fichier `src/schemas/query-docs.schema.ts`
2. Définir les types TypeScript avec Zod
3. Ajouter la validation des paramètres
4. Documenter chaque champ avec exemples

**Implémentation**:
```typescript
// src/schemas/query-docs.schema.ts
import { z } from 'zod';

export const QueryDocsInputSchema = z.object({
  library_id: z.string()
    .min(1, "L'ID de bibliothèque est requis")
    .describe("Identifiant unique de la bibliothèque (ex: 'react', 'nodejs')"),
  
  query: z.string()
    .min(1, "La requête est requise")
    .max(1000, "La requête est trop longue")
    .describe("Question ou recherche sur la documentation"),
  
  version: z.string()
    .optional()
    .describe("Version spécifique de la bibliothèque"),
  
  max_results: z.number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Nombre maximum de résultats à retourner"),
  
  include_code: z.boolean()
    .default(true)
    .describe("Inclure les snippets de code dans les résultats"),
  
  context_limit: z.number()
    .int()
    .min(1000)
    .max(8000)
    .default(4000)
    .describe("Limite de tokens pour le contexte")
});

export type QueryDocsInput = z.infer<typeof QueryDocsInputSchema>;
```

**Validation**:
- Tests unitaires pour la validation
- Vérification des types et contraintes
- Tests des messages d'erreur

---

### Étape 2: Implémenter la logique de recherche vectorielle

**Objectif**: Intégrer la recherche sémantique dans le vector store

**Actions**:
1. Créer le service `VectorSearchService`
2. Implémenter la génération d'embedding pour la query
3. Intégrer avec Pinecone/Qdrant
4. Ajouter le filtrage par bibliothèque et version

**Implémentation**:
```typescript
// src/services/vector-search.service.ts
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Document } from '@langchain/core/documents';

export class VectorSearchService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: PineconeStore;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small'
    });
    
    this.vectorStore = new PineconeStore(this.embeddings, {
      pineconeIndex: process.env.PINECONE_INDEX!,
      namespace: 'documentation'
    });
  }

  async searchDocuments(query: string, options: {
    libraryId: string;
    version?: string;
    maxResults?: number;
    includeCode?: boolean;
  }): Promise<Document[]> {
    // Générer l'embedding de la query
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Construire le filtre
    const filter = {
      library_id: options.libraryId,
      ...(options.version && { version: options.version }),
      ...(options.includeCode !== undefined && { 
        type: options.includeCode ? { $ne: 'metadata' } : 'text' 
      })
    };
    
    // Rechercher dans le vector store
    const results = await this.vectorStore.similaritySearchWithScore(
      queryEmbedding,
      options.maxResults || 5,
      filter
    );
    
    return results.map(([doc, score]) => {
      doc.metadata.relevance_score = score;
      return doc;
    });
  }
}
```

**Validation**:
- Tests de recherche avec différentes queries
- Validation des filtres
- Tests de performance

---

### Étape 3: Assembler le contexte optimisé pour LLM

**Objectif**: Formater les résultats pour une utilisation optimale par les LLM

**Actions**:
1. Créer le service `ContextAssembler`
2. Implémenter la concaténation intelligente
3. Ajouter les métadonnées structurées
4. Gérer la limite de tokens

**Implémentation**:
```typescript
// src/services/context-assembler.service.ts
import { Document } from '@langchain/core/documents';
import { tiktoken } from '@tiktoken/core';

export class ContextAssembler {
  private encoder: any;

  constructor() {
    this.encoder = tiktoken('cl100k_base');
  }

  assembleContext(
    documents: Document[], 
    query: string,
    maxTokens: number = 4000
  ): {
    context: string;
    metadata: any;
    totalTokens: number;
    truncated: boolean;
  } {
    let context = `# Documentation Query Results\n\n`;
    context += `**Query**: ${query}\n\n`;
    
    let currentTokens = this.encoder.encode(context).length;
    const results = [];
    
    for (const doc of documents) {
      const section = this.formatDocumentSection(doc);
      const sectionTokens = this.encoder.encode(section).length;
      
      if (currentTokens + sectionTokens > maxTokens) {
        break;
      }
      
      context += section;
      currentTokens += sectionTokens;
      
      results.push({
        content: doc.pageContent,
        metadata: doc.metadata,
        relevance_score: doc.metadata.relevance_score
      });
    }
    
    return {
      context,
      metadata: {
        query,
        total_documents: documents.length,
        included_documents: results.length,
        library: documents[0]?.metadata?.library_id,
        version: documents[0]?.metadata?.version
      },
      totalTokens: currentTokens,
      truncated: results.length < documents.length
    };
  }

  private formatDocumentSection(doc: Document): string {
    const meta = doc.metadata;
    let section = '';
    
    if (meta.type === 'code') {
      section += `## Code Example\n`;
    } else if (meta.type === 'example') {
      section += `## Example\n`;
    } else {
      section += `## ${meta.section || 'Documentation'}\n`;
    }
    
    section += `**Source**: ${meta.url}\n`;
    section += `**Relevance**: ${(meta.relevance_score * 100).toFixed(1)}%\n\n`;
    section += `${doc.pageContent}\n\n`;
    section += `---\n\n`;
    
    return section;
  }
}
```

**Validation**:
- Tests de comptage de tokens
- Validation du formatage
- Tests de troncature

---

### Étape 4: Formater la réponse avec métadonnées

**Objectif**: Créer une réponse structurée et complète

**Actions**:
1. Définir le format de réponse final
2. Ajouter les métadonnées enrichies
3. Implémenter la gestion des erreurs
4. Ajouter le logging et monitoring

**Implémentation**:
```typescript
// src/tools/query-docs.tool.ts
import { Tool } from '@modelcontextprotocol/sdk/tools';
import { QueryDocsInputSchema } from '../schemas/query-docs.schema';
import { VectorSearchService } from '../services/vector-search.service';
import { ContextAssembler } from '../services/context-assembler.service';
import { LibraryService } from '../services/library.service';

export class QueryDocsTool extends Tool {
  name = 'query-docs';
  description = 'Search documentation for a specific library';
  
  private vectorSearch: VectorSearchService;
  private contextAssembler: ContextAssembler;
  private libraryService: LibraryService;

  constructor() {
    super();
    this.vectorSearch = new VectorSearchService();
    this.contextAssembler = new ContextAssembler();
    this.libraryService = new LibraryService();
  }

  async run(input: unknown): Promise<any> {
    try {
      const validatedInput = QueryDocsInputSchema.parse(input);
      
      // Valider que la bibliothèque existe
      const library = await this.libraryService.getLibrary(validatedInput.library_id);
      if (!library) {
        throw new Error(`Library '${validatedInput.library_id}' not found`);
      }
      
      // Rechercher les documents pertinents
      const documents = await this.vectorSearch.searchDocuments(
        validatedInput.query,
        {
          libraryId: validatedInput.library_id,
          version: validatedInput.version,
          maxResults: validatedInput.max_results,
          includeCode: validatedInput.include_code
        }
      );
      
      if (documents.length === 0) {
        return {
          success: false,
          error: 'No documentation found for this query',
          suggestions: ['Try different keywords', 'Check library name spelling']
        };
      }
      
      // Assembler le contexte
      const assembled = this.contextAssembler.assembleContext(
        documents,
        validatedInput.query,
        validatedInput.context_limit
      );
      
      // Formater la réponse
      return {
        success: true,
        library: {
          id: library.id,
          name: library.name,
          version: validatedInput.version || library.latest_version,
          description: library.description
        },
        query: validatedInput.query,
        results: assembled.metadata.included_documents,
        context: assembled.context,
        total_tokens: assembled.totalTokens,
        truncated: assembled.truncated,
        metadata: assembled.metadata
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

**Validation**:
- Tests E2E de l'outil complet
- Validation des réponses
- Tests d'erreur handling

---

## Architecture et Composants

### Structure des fichiers

```
src/
├── tools/
│   └── query-docs.tool.ts
├── services/
│   ├── vector-search.service.ts
│   ├── context-assembler.service.ts
│   └── library.service.ts
├── schemas/
│   └── query-docs.schema.ts
└── types/
    └── query-docs.types.ts
```

### Flux de données

1. **Input Validation** → Schéma Zod
2. **Library Check** → PostgreSQL
3. **Vector Search** → Pinecone/Qdrant
4. **Context Assembly** → Service dédié
5. **Response Formatting** → Output structuré

---

## Tests

### Tests unitaires

```typescript
// __tests__/tools/query-docs.tool.test.ts
describe('QueryDocsTool', () => {
  let tool: QueryDocsTool;
  let mockVectorSearch: jest.Mocked<VectorSearchService>;
  let mockContextAssembler: jest.Mocked<ContextAssembler>;

  beforeEach(() => {
    tool = new QueryDocsTool();
    mockVectorSearch = createMockVectorSearch();
    mockContextAssembler = createMockContextAssembler();
  });

  test('should validate input correctly', async () => {
    const input = {
      library_id: 'react',
      query: 'How to use hooks?',
      max_results: 5
    };
    
    const result = await tool.run(input);
    expect(result.success).toBe(true);
  });

  test('should handle invalid library', async () => {
    const input = {
      library_id: 'nonexistent',
      query: 'test'
    };
    
    const result = await tool.run(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
```

### Tests d'intégration

```typescript
// __tests__/integration/query-docs.integration.test.ts
describe('QueryDocs Integration', () => {
  test('should search React documentation', async () => {
    const result = await queryDocs({
      library_id: 'react',
      query: 'useState hook example',
      max_results: 3
    });
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.context).toContain('useState');
  });
});
```

---

## Performance et Optimisation

### Métriques cibles

- **Temps de réponse**: < 500ms
- **Précision**: > 85% de pertinence
- **Tokens**: < 4000 par requête
- **Cache hit rate**: > 70%

### Optimisations

1. **Cache Redis** pour les queries fréquentes
2. **Batch processing** pour les embeddings
3. **Indexation optimisée** dans le vector store
4. **Compression** des réponses

---

## Monitoring et Logging

### Métriques à tracker

```typescript
// src/metrics/query-docs.metrics.ts
export const QueryDocsMetrics = {
  requestCount: new Counter('query_docs_requests_total'),
  responseTime: new Histogram('query_docs_response_time_seconds'),
  errorRate: new Counter('query_docs_errors_total'),
  cacheHitRate: new Gauge('query_docs_cache_hit_rate'),
  tokenUsage: new Histogram('query_docs_tokens_used')
};
```

### Logs structurés

```typescript
logger.info('Query docs request', {
  library_id: input.library_id,
  query: input.query,
  results_count: documents.length,
  tokens_used: assembled.totalTokens,
  response_time_ms: Date.now() - startTime
});
```

---

## Dépendances

### Packages requis

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "@langchain/openai": "^0.1.0",
    "@langchain/pinecone": "^0.1.0",
    "zod": "^3.22.0",
    "tiktoken": "^1.0.0"
  }
}
```

### Services externes

- **OpenAI API**: Pour les embeddings
- **Pinecone/Qdrant**: Vector store
- **PostgreSQL**: Métadonnées des bibliothèques
- **Redis**: Cache et sessions

---

## Risques et Mitigations

### Risques identifiés

1. **Performance dégradée** → Cache et monitoring
2. **Coût OpenAI élevé** → Cache des embeddings
3. **Résultats non pertinents** → Scoring avancé
4. **Timeout** → Timeout configurables

### Stratégies de mitigation

1. **Cache multi-niveaux** (Redis + mémoire)
2. **Fallback vers recherche textuelle**
3. **Monitoring temps réel**
4. **Rate limiting par utilisateur**

---

## Livrables

1. **Outil MCP query-docs** complet et testé
2. **Documentation** complète avec exemples
3. **Tests unitaires et d'intégration**
4. **Monitoring** et métriques
5. **Performance optimisée** avec cache

---

## Critères d'Achèvement

✅ L'outil accepte et valide les entrées correctement  
✅ La recherche vectorielle retourne des résultats pertinents  
✅ Le contexte est assemblé dans la limite de tokens  
✅ Les métadonnées sont complètes et structurées  
✅ Les erreurs sont gérées proprement  
✅ Les tests passent avec > 90% de couverture  
✅ Les performances respectent les cibles  
✅ Le monitoring est en place  

---

## Suivi

- **Date de début**: À définir
- **Durée estimée**: 3-4 jours
- **Assigné à**: À définir
- **Réviseur**: À définir
