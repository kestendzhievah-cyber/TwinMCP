import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';

export interface VectorMetadata {
  libraryId: string;
  version: string;
  contentType: 'snippet' | 'guide' | 'api_ref';
  sourceUrl: string;
  chunkText: string;
  section?: string;
  subsection?: string;
  codeLanguage?: string;
  tokenCount: number;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export class PineconeService {
  private client: Pinecone;
  private indexName: string;
  private index: any;

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }

    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.indexName = process.env.PINECONE_INDEX_NAME || 'twinmcp-docs';
  }

  async initialize(): Promise<void> {
    try {
      // Vérifier si l'index existe
      const existingIndexes = await this.client.listIndexes();
      const indexExists = existingIndexes.indexes?.some(
        (index: any) => index.name === this.indexName
      );

      if (!indexExists) {
        logger.info(`Creating Pinecone index: ${this.indexName}`);
        
        // Créer l'index avec les bonnes dimensions
        await this.client.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI text-embedding-3-small
          metric: 'cosine',
          spec: {
            pod: {
              podType: 'p1.x1', // Commencer petit
              environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
            }
          }
        });

        // Attendre que l'index soit prêt
        await this.waitForIndexReady();
      }

      this.index = this.client.Index(this.indexName);
      logger.info('Pinecone service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const description = await this.client.describeIndex(this.indexName);
        if (description.status?.ready) {
          logger.info('Pinecone index is ready');
          return;
        }
        
        logger.info('Waiting for Pinecone index to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.warn('Error checking index status:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Pinecone index failed to become ready');
  }

  async upsert(vectors: VectorRecord[]): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const pineconeRecords: PineconeRecord[] = vectors.map(vector => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata,
      }));

      // Pinecone a une limite de 1000 vectors par upsert
      const batchSize = 1000;
      for (let i = 0; i < pineconeRecords.length; i += batchSize) {
        const batch = pineconeRecords.slice(i, i + batchSize);
        await this.index.upsert(batch);
        
        logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pineconeRecords.length / batchSize)}`);
      }

      logger.info(`Upserted ${vectors.length} vectors to Pinecone`);
    } catch (error) {
      logger.error('Error upserting vectors to Pinecone:', error);
      throw error;
    }
  }

  async query(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>
  ): Promise<VectorRecord[]> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const queryRequest: any = {
        vector: queryVector,
        topK,
        includeMetadata: true,
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const response = await this.index.query(queryRequest);

      const results: VectorRecord[] = response.matches?.map((match: any) => ({
        id: match.id,
        values: match.values || [],
        metadata: match.metadata as VectorMetadata,
        score: match.score,
      })) || [];

      logger.debug(`Query returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Error querying Pinecone:', error);
      throw error;
    }
  }

  async delete(vectorIds: string[]): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      await this.index.deleteOne(vectorIds);
      logger.info(`Deleted ${vectorIds.length} vectors from Pinecone`);
    } catch (error) {
      logger.error('Error deleting vectors from Pinecone:', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      await this.index.deleteOne(filter);
      logger.info('Deleted vectors by filter from Pinecone');
    } catch (error) {
      logger.error('Error deleting vectors by filter from Pinecone:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error('Error getting Pinecone stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.index) {
        return false;
      }

      await this.index.describeIndexStats();
      return true;
    } catch (error) {
      logger.error('Pinecone health check failed:', error);
      return false;
    }
  }
}
