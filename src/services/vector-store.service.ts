import { PineconeService, VectorRecord } from '../config/pinecone';
import { QdrantService, QdrantPoint } from '../config/qdrant';
import { EmbeddingsService } from './embeddings.service';
import { logger } from '../utils/logger';

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: {
    libraryId: string;
    version: string;
    contentType: 'snippet' | 'guide' | 'api_ref';
    sourceUrl: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    tokenCount: number;
  };
  score: number;
}

export class VectorStoreService {
  private pineconeService: PineconeService;
  private qdrantService: QdrantService;
  private embeddingsService: EmbeddingsService;
  private provider: 'pinecone' | 'qdrant';

  constructor() {
    this.provider = (process.env['VECTOR_STORE_PROVIDER'] as 'pinecone' | 'qdrant') || 'pinecone';
    
    this.pineconeService = new PineconeService();
    this.qdrantService = new QdrantService();
    this.embeddingsService = new EmbeddingsService();
  }

  async initialize(): Promise<void> {
    try {
      await this.embeddingsService.healthCheck();

      if (this.provider === 'pinecone') {
        await this.pineconeService.initialize();
      } else {
        await this.qdrantService.initialize();
      }

      logger.info(`Vector store service initialized with ${this.provider}`);
    } catch (error) {
      logger.error('Failed to initialize vector store service:', error);
      throw error;
    }
  }

  async addDocument(
    content: string,
    metadata: {
      libraryId: string;
      version: string;
      contentType: 'snippet' | 'guide' | 'api_ref';
      sourceUrl: string;
      section?: string;
      subsection?: string;
      codeLanguage?: string;
      tokenCount: number;
    }
  ): Promise<string> {
    try {
      const embedding = await this.embeddingsService.generateEmbedding(content);
      const id = this.generateId(metadata);

      if (this.provider === 'pinecone') {
        await this.pineconeService.upsert([{
          id,
          values: embedding,
          metadata: {
            ...metadata,
            chunkText: content,
          },
        }]);
      } else {
        await this.qdrantService.upsert([{
          id,
          vector: embedding,
          payload: {
            ...metadata,
            chunkText: content,
          },
        }]);
      }

      logger.debug(`Added document to vector store: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding document to vector store:', error);
      throw error;
    }
  }

  async addDocumentsBatch(
    documents: Array<{
      content: string;
      metadata: {
        libraryId: string;
        version: string;
        contentType: 'snippet' | 'guide' | 'api_ref';
        sourceUrl: string;
        section?: string;
        subsection?: string;
        codeLanguage?: string;
        tokenCount: number;
      };
    }>
  ): Promise<string[]> {
    try {
      const contents = documents.map(doc => doc.content);
      const embeddings = await this.embeddingsService.generateBatchEmbeddings(contents);

      const vectors = documents.map((doc, index) => {
        const id = this.generateId(doc.metadata);
        
        if (this.provider === 'pinecone') {
          return {
            id,
            values: embeddings[index],
            metadata: {
              ...doc.metadata,
              chunkText: doc.content,
            },
          } as VectorRecord;
        } else {
          return {
            id,
            vector: embeddings[index],
            payload: {
              ...doc.metadata,
              chunkText: doc.content,
            },
          } as QdrantPoint;
        }
      });

      if (this.provider === 'pinecone') {
        await this.pineconeService.upsert(vectors as VectorRecord[]);
      } else {
        await this.qdrantService.upsert(vectors as QdrantPoint[]);
      }

      const ids = documents.map(doc => this.generateId(doc.metadata));
      logger.info(`Added ${documents.length} documents to vector store`);
      return ids;
    } catch (error) {
      logger.error('Error adding documents batch to vector store:', error);
      throw error;
    }
  }

  async search(
    query: string,
    options: {
      topK?: number;
      libraryId?: string;
      version?: string;
      contentType?: 'snippet' | 'guide' | 'api_ref';
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const queryVector = await this.embeddingsService.generateEmbedding(query);
      const topK = options.topK || 10;

      // Construire le filtre
      const filter: Record<string, any> = {};
      if (options.libraryId) filter['libraryId'] = options.libraryId;
      if (options.version) filter['version'] = options.version;
      if (options.contentType) filter['contentType'] = options.contentType;

      let results;
      if (this.provider === 'pinecone') {
        results = await this.pineconeService.query(queryVector, topK, filter);
      } else {
        results = await this.qdrantService.query(queryVector, topK, filter);
      }

      return results.map(result => {
        const metadata = this.provider === 'pinecone' 
          ? (result as any).metadata 
          : (result as any).payload;
        
        return {
          id: result.id,
          content: metadata.chunkText,
          metadata: {
            libraryId: metadata.libraryId,
            version: metadata.version,
            contentType: metadata.contentType,
            sourceUrl: metadata.sourceUrl,
            section: metadata.section,
            subsection: metadata.subsection,
            codeLanguage: metadata.codeLanguage,
            tokenCount: metadata.tokenCount,
          },
          score: (result as any).score || 0,
        };
      });
    } catch (error) {
      logger.error('Error searching vector store:', error);
      throw error;
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      if (this.provider === 'pinecone') {
        await this.pineconeService.delete(ids);
      } else {
        await this.qdrantService.delete(ids);
      }

      logger.info(`Deleted ${ids.length} documents from vector store`);
    } catch (error) {
      logger.error('Error deleting documents from vector store:', error);
      throw error;
    }
  }

  async deleteByLibrary(libraryId: string): Promise<void> {
    try {
      if (this.provider === 'pinecone') {
        await this.pineconeService.deleteByFilter({ libraryId });
      } else {
        await this.qdrantService.deleteByFilter({ libraryId });
      }

      logger.info(`Deleted all documents for library: ${libraryId}`);
    } catch (error) {
      logger.error('Error deleting documents by library:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      if (this.provider === 'pinecone') {
        return await this.pineconeService.getStats();
      } else {
        return await this.qdrantService.getCollectionInfo();
      }
    } catch (error) {
      logger.error('Error getting vector store stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const embeddingsHealthy = await this.embeddingsService.healthCheck();
      
      let vectorStoreHealthy = false;
      if (this.provider === 'pinecone') {
        vectorStoreHealthy = await this.pineconeService.healthCheck();
      } else {
        vectorStoreHealthy = await this.qdrantService.healthCheck();
      }

      return embeddingsHealthy && vectorStoreHealthy;
    } catch (error) {
      logger.error('Vector store service health check failed:', error);
      return false;
    }
  }

  private generateId(metadata: {
    libraryId: string;
    version: string;
    sourceUrl: string;
    section?: string;
  }): string {
    const parts = [
      metadata.libraryId,
      metadata.version,
      metadata.sourceUrl,
      metadata.section || '',
    ].filter(Boolean);
    
    return parts.join(':').replace(/[^a-zA-Z0-9:-]/g, '_');
  }
}
