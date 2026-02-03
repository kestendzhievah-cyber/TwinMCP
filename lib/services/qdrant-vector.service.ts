import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COLLECTION_NAME = 'twinmcp_docs';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

export interface DocumentChunk {
  id: string;
  libraryId: string;
  libraryName: string;
  version: string;
  content: string;
  contentType: 'snippet' | 'guide' | 'api_ref';
  title: string;
  section: string;
  sourceUrl: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: {
    libraryId: string;
    libraryName: string;
    version: string;
    contentType: string;
    title: string;
    section: string;
    sourceUrl: string;
    tokenCount: number;
  };
}

export interface SearchOptions {
  libraryId?: string;
  version?: string;
  contentType?: 'snippet' | 'guide' | 'api_ref';
  topK?: number;
  scoreThreshold?: number;
}

export class QdrantVectorService {
  private qdrant: QdrantClient;
  private openai: OpenAI;
  private initialized: boolean = false;

  constructor() {
    this.qdrant = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });

    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  // Initialize the collection if it doesn't exist
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

      if (!exists) {
        await this.qdrant.createCollection(COLLECTION_NAME, {
          vectors: {
            size: EMBEDDING_DIMENSION,
            distance: 'Cosine',
          },
          optimizers_config: {
            indexing_threshold: 20000,
          },
        });

        // Create payload indexes for filtering
        await this.qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'libraryId',
          field_schema: 'keyword',
        });

        await this.qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'version',
          field_schema: 'keyword',
        });

        await this.qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'contentType',
          field_schema: 'keyword',
        });

        console.log(`[Qdrant] Created collection: ${COLLECTION_NAME}`);
      }

      this.initialized = true;
      console.log('[Qdrant] Initialized successfully');
    } catch (error) {
      console.error('[Qdrant] Initialization failed:', error);
      throw error;
    }
  }

  // Generate embedding using OpenAI
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[Qdrant] Embedding generation failed:', error);
      throw error;
    }
  }

  // Index a document chunk
  async indexDocument(doc: DocumentChunk): Promise<void> {
    await this.initialize();

    const embedding = await this.generateEmbedding(doc.content);

    await this.qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: doc.id,
          vector: embedding,
          payload: {
            libraryId: doc.libraryId,
            libraryName: doc.libraryName,
            version: doc.version,
            content: doc.content,
            contentType: doc.contentType,
            title: doc.title,
            section: doc.section,
            sourceUrl: doc.sourceUrl,
            tokenCount: doc.tokenCount,
            metadata: doc.metadata || {},
            indexedAt: new Date().toISOString(),
          },
        },
      ],
    });

    console.log(`[Qdrant] Indexed document: ${doc.id}`);
  }

  // Batch index multiple documents
  async indexDocuments(docs: DocumentChunk[]): Promise<void> {
    await this.initialize();

    const batchSize = 100;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      
      const points = await Promise.all(
        batch.map(async (doc) => {
          const embedding = await this.generateEmbedding(doc.content);
          return {
            id: doc.id,
            vector: embedding,
            payload: {
              libraryId: doc.libraryId,
              libraryName: doc.libraryName,
              version: doc.version,
              content: doc.content,
              contentType: doc.contentType,
              title: doc.title,
              section: doc.section,
              sourceUrl: doc.sourceUrl,
              tokenCount: doc.tokenCount,
              metadata: doc.metadata || {},
              indexedAt: new Date().toISOString(),
            },
          };
        })
      );

      await this.qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });

      console.log(`[Qdrant] Indexed batch ${i / batchSize + 1}/${Math.ceil(docs.length / batchSize)}`);
    }
  }

  // Search for documents
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize();

    const {
      libraryId,
      version,
      contentType,
      topK = 10,
      scoreThreshold = 0.7,
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Build filter
    const filter: any = { must: [] };
    
    if (libraryId) {
      filter.must.push({
        key: 'libraryId',
        match: { value: libraryId },
      });
    }
    
    if (version) {
      filter.must.push({
        key: 'version',
        match: { value: version },
      });
    }
    
    if (contentType) {
      filter.must.push({
        key: 'contentType',
        match: { value: contentType },
      });
    }

    // Execute search
    const results = await this.qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: topK,
      filter: filter.must.length > 0 ? filter : undefined,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    return results.map((result) => ({
      id: result.id as string,
      score: result.score,
      content: (result.payload?.content as string) || '',
      metadata: {
        libraryId: (result.payload?.libraryId as string) || '',
        libraryName: (result.payload?.libraryName as string) || '',
        version: (result.payload?.version as string) || '',
        contentType: (result.payload?.contentType as string) || '',
        title: (result.payload?.title as string) || '',
        section: (result.payload?.section as string) || '',
        sourceUrl: (result.payload?.sourceUrl as string) || '',
        tokenCount: (result.payload?.tokenCount as number) || 0,
      },
    }));
  }

  // Delete documents by library
  async deleteByLibrary(libraryId: string): Promise<void> {
    await this.initialize();

    await this.qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'libraryId',
            match: { value: libraryId },
          },
        ],
      },
    });

    console.log(`[Qdrant] Deleted documents for library: ${libraryId}`);
  }

  // Get collection stats
  async getStats(): Promise<{
    totalDocuments: number;
    libraries: number;
    indexedAt: string;
  }> {
    await this.initialize();

    const info = await this.qdrant.getCollection(COLLECTION_NAME);
    
    return {
      totalDocuments: info.points_count || 0,
      libraries: 0, // Would need separate query
      indexedAt: new Date().toISOString(),
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.qdrant.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const qdrantService = new QdrantVectorService();
