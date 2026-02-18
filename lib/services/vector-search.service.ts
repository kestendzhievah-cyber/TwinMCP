import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'
import { z } from 'zod'
import { VectorStoreService, VectorSearchResult } from '../../src/services/vector-store.service'
import { ContextAssembler } from './context-assembler.service'
import { LibraryService } from './library.service'

// Types pour la recherche de documentation
export const QueryDocsInputSchema = z.object({
  library_id: z.string()
    .min(1, "L'ID de bibliothèque est requis")
    .describe("Identifiant unique de la bibliothèque"),
  
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
})

export type QueryDocsInput = z.infer<typeof QueryDocsInputSchema>

export interface DocumentResult {
  content: string
  metadata: {
    source: string
    url: string
    section: string
    type: 'text' | 'code' | 'example'
    relevanceScore: number
  }
}

export interface QueryDocsOutput {
  library: {
    id: string
    name: string
    version: string
    description: string
  }
  query: string
  results: DocumentResult[]
  context: string
  totalTokens: number
  truncated: boolean
}

export class VectorSearchService {
  private db: PrismaClient
  private redis: Redis
  private vectorStoreService: VectorStoreService
  private contextAssembler: ContextAssembler
  private libraryService: LibraryService

  constructor(db: PrismaClient, redis: Redis) {
    this.db = db
    this.redis = redis
    this.vectorStoreService = new VectorStoreService()
    this.contextAssembler = new ContextAssembler()
    this.libraryService = new LibraryService(db)
  }

  async searchDocuments(input: QueryDocsInput): Promise<QueryDocsOutput> {
    const startTime = Date.now()

    try {
      // Valider que la bibliothèque existe
      const library = await this.libraryService.getLibrary(input.library_id)

      if (!library) {
        throw new Error(`Library '${input.library_id}' not found`)
      }

      // Rechercher dans le vector store
      const searchOptions: any = {
        topK: input.max_results,
        libraryId: input.library_id
      }
      
      if (input.version) {
        searchOptions.version = input.version
      }
      
      if (!input.include_code) {
        searchOptions.contentType = 'guide'
      }
      
      const vectorResults = await this.vectorStoreService.search(input.query, searchOptions)

      // Convertir les résultats en DocumentResult
      const documents: DocumentResult[] = vectorResults.map(result => ({
        content: result.content,
        metadata: {
          source: `${result.metadata.libraryId}-docs`,
          url: result.metadata.sourceUrl,
          section: result.metadata.section || 'Documentation',
          type: this.mapContentType(result.metadata.contentType),
          relevanceScore: result.score
        }
      }))

      if (documents.length === 0) {
        return {
          library: {
            id: library.id,
            name: library.name,
            version: input.version || library.defaultVersion || 'latest',
            description: library.description || ''
          },
          query: input.query,
          results: [],
          context: '',
          totalTokens: 0,
          truncated: false
        }
      }

      // Assembler le contexte
      const assembled = this.contextAssembler.assembleContext(documents, input.query, input.context_limit)

      return {
        library: {
          id: library.id,
          name: library.name,
          version: input.version || library.defaultVersion || 'latest',
          description: library.description || ''
        },
        query: input.query,
        results: documents,
        context: assembled.context,
        totalTokens: assembled.totalTokens,
        truncated: assembled.truncated
      }

    } catch (error) {
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private mapContentType(contentType: 'snippet' | 'guide' | 'api_ref'): 'text' | 'code' | 'example' {
    switch (contentType) {
      case 'snippet':
        return 'code'
      case 'guide':
        return 'text'
      case 'api_ref':
        return 'text'
      default:
        return 'text'
    }
  }

  private async mockVectorSearch(input: QueryDocsInput, library: any): Promise<DocumentResult[]> {
    // Simulation de recherche vectorielle
    // Dans une vraie implémentation, il faudrait :
    // 1. Générer l'embedding de la query avec OpenAI
    // 2. Rechercher dans Pinecone/Qdrant
    // 3. Récupérer les documents correspondants

    const mockResults: DocumentResult[] = [
      {
        content: `# ${library.name} Documentation\n\nThis is a sample documentation entry for ${library.name}.`,
        metadata: {
          source: `${library.name}-docs`,
          url: `https://docs.${library.name}.com`,
          section: 'Getting Started',
          type: 'text',
          relevanceScore: 0.95
        }
      },
      {
        content: `## Installation\n\n\`\`\`bash\nnpm install ${library.name}\`\`\``,
        metadata: {
          source: `${library.name}-docs`,
          url: `https://docs.${library.name}.com/installation`,
          section: 'Installation',
          type: 'code',
          relevanceScore: 0.88
        }
      },
      {
        content: `## Basic Usage\n\nHere's how to use ${library.name} in your project:\n\n\`\`\`javascript\nimport ${library.name} from '${library.name}';\n\nconst instance = new ${library.name}();\ninstance.doSomething();\n\`\`\``,
        metadata: {
          source: `${library.name}-docs`,
          url: `https://docs.${library.name}.com/usage`,
          section: 'Usage',
          type: 'example',
          relevanceScore: 0.82
        }
      }
    ]

    // Filtrer par type si nécessaire
    let filteredResults = mockResults
    if (!input.include_code) {
      filteredResults = mockResults.filter(doc => 
        doc.metadata.type === 'text'
      )
    }

    return filteredResults.slice(0, input.max_results)
  }

  private assembleContext(
    documents: DocumentResult[], 
    query: string,
    maxTokens: number = 4000
  ): {
    context: string
    results: DocumentResult[]
    totalTokens: number
    truncated: boolean
  } {
    let context = `# Documentation Query Results\n\n`
    context += `**Query**: ${query}\n\n`
    
    // Estimation simple de tokens (1 token ≈ 4 caractères)
    let currentTokens = Math.ceil(context.length / 4)
    const results: DocumentResult[] = []
    
    for (const doc of documents) {
      const section = this.formatDocumentSection(doc)
      const sectionTokens = Math.ceil(section.length / 4)
      
      if (currentTokens + sectionTokens > maxTokens) {
        break
      }
      
      context += section
      currentTokens += sectionTokens
      
      results.push(doc)
    }
    
    return {
      context,
      results,
      totalTokens: currentTokens,
      truncated: results.length < documents.length
    }
  }

  private formatDocumentSection(doc: DocumentResult): string {
    const meta = doc.metadata
    let section = ''
    
    if (meta.type === 'code') {
      section += `## Code Example\n`
    } else if (meta.type === 'example') {
      section += `## Example\n`
    } else {
      section += `## ${meta.section || 'Documentation'}\n`
    }
    
    section += `**Source**: ${meta.url}\n`
    section += `**Relevance**: ${(meta.relevanceScore * 100).toFixed(1)}%\n\n`
    section += `${doc.content}\n\n`
    section += `---\n\n`
    
    return section
  }

  // Méthodes pour l'implémentation réelle avec vector store
  private async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implémenter avec OpenAI API
    // const response = await openai.embeddings.create({
    //   model: "text-embedding-3-small",
    //   input: text
    // })
    // return response.data[0].embedding
    
    // Simulation pour l'instant
    return new Array(1536).fill(0).map(() => Math.random())
  }

  private async searchInVectorStore(embedding: number[], options: any): Promise<DocumentResult[]> {
    // TODO: Implémenter avec Pinecone ou Qdrant
    // const results = await pineconeIndex.query({
    //   vector: embedding,
    //   topK: options.maxResults,
    //   filter: options.filter,
    //   includeMetadata: true
    // })
    
    // Retourner les résultats pour l'instant
    return []
  }
}
