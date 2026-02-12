import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../utils/logger';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    libraryId: string;
    version: string;
    contentType: 'snippet' | 'guide' | 'api_ref';
    sourceUrl: string;
    chunkText: string;
    section?: string;
    subsection?: string;
    codeLanguage?: string;
    tokenCount: number;
  };
}

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;

  constructor() {
    const url = process.env['QDRANT_URL'] || 'http://localhost:6333';
    const apiKey = process.env['QDRANT_API_KEY'];

    this.client = new QdrantClient({
      url,
      ...(apiKey && { apiKey }),
    });

    this.collectionName = process.env['QDRANT_COLLECTION_NAME'] || 'twinmcp-docs';
  }

  async initialize(): Promise<void> {
    try {
      // Vérifier si la collection existe
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections?.some(
        (collection: any) => collection.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`Creating Qdrant collection: ${this.collectionName}`);
        
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536, // OpenAI text-embedding-3-small
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        logger.info('Qdrant collection created successfully');
      }

      logger.info('Qdrant service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    try {
      // Qdrant a une limite de 1000 points par upsert
      const batchSize = 1000;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, {
          points: batch,
        });
        
        logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
      }

      logger.info(`Upserted ${points.length} points to Qdrant`);
    } catch (error) {
      logger.error('Error upserting points to Qdrant:', error);
      throw error;
    }
  }

  async query(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<QdrantPoint[]> {
    try {
      const queryRequest: any = {
        vector: {
          name: '', // vector par défaut
          vector: queryVector,
        },
        limit: topK,
        with_payload: true,
        with_vector: false,
      };

      if (filter) {
        queryRequest.filter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      const response = await this.client.search(this.collectionName, queryRequest);

      const results: QdrantPoint[] = (response as any[])?.map((point: any) => ({
        id: point.id,
        vector: point.vector || [],
        payload: point.payload,
        score: point.score,
      })) || [];

      logger.debug(`Query returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Error querying Qdrant:', error);
      throw error;
    }
  }

  async delete(pointIds: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: pointIds,
      });
      logger.info(`Deleted ${pointIds.length} points from Qdrant`);
    } catch (error) {
      logger.error('Error deleting points from Qdrant:', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      const qdrantFilter = {
        must: Object.entries(filter).map(([key, value]) => ({
          key,
          match: { value },
        })),
      };

      await this.client.delete(this.collectionName, {
        filter: qdrantFilter,
      });
      logger.info('Deleted points by filter from Qdrant');
    } catch (error) {
      logger.error('Error deleting points by filter from Qdrant:', error);
      throw error;
    }
  }

  async getCollectionInfo(): Promise<any> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return info;
    } catch (error) {
      logger.error('Error getting Qdrant collection info:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error('Qdrant health check failed:', error);
      return false;
    }
  }
}
