import { OpenAI } from 'openai';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

export class EmbeddingsService {
  private openai: OpenAI | null = null;
  private model: string = process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small';

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env['OPENAI_API_KEY'];
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured. Set OPENAI_API_KEY environment variable.');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Vérifier le cache d'abord
      const cacheKey = `embedding:${this.hashText(text)}`;
      const cached = await CacheService.get<number[]>(cacheKey);
      if (cached) {
        logger.debug('Embedding cache hit');
        return cached;
      }

      const response = await this.getOpenAI().embeddings.create({
        model: this.model,
        input: text.trim(),
      });

      const embedding = response.data[0].embedding;

      // Mettre en cache pour 24 heures
      await CacheService.set(cacheKey, embedding, 86400);

      logger.debug(`Generated embedding for text (${text.length} chars)`);
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI supporte jusqu'à 2048 inputs par batch
      const batchSize = 2048;
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        // Vérifier le cache pour chaque texte
        const uncachedTexts: string[] = [];
        const uncachedIndices: number[] = [];
        
        batch.forEach((text, index) => {
          const cacheKey = `embedding:${this.hashText(text)}`;
          // Pour l'instant, on ne vérifie pas le cache en batch pour simplifier
          uncachedTexts.push(text);
          uncachedIndices.push(i + index);
        });

        if (uncachedTexts.length > 0) {
          const response = await this.getOpenAI().embeddings.create({
            model: this.model,
            input: uncachedTexts,
          });

          // Mettre en cache les résultats
          for (let j = 0; j < response.data.length; j++) {
            const embedding = response.data[j].embedding;
            const text = uncachedTexts[j];
            const cacheKey = `embedding:${this.hashText(text)}`;
            
            await CacheService.set(cacheKey, embedding, 86400);
            allEmbeddings[uncachedIndices[j]] = embedding;
          }
        }
      }

      logger.info(`Generated batch embeddings for ${texts.length} texts`);
      return allEmbeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  async generateEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateEmbedding(text);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Embedding generation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  async getEmbeddingInfo(): Promise<{ model: string; dimensions: number }> {
    try {
      const response = await this.getOpenAI().embeddings.create({
        model: this.model,
        input: 'test',
      });

      return {
        model: this.model,
        dimensions: response.data[0].embedding.length,
      };
    } catch (error) {
      logger.error('Error getting embedding info:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding('health check');
      return true;
    } catch (error) {
      logger.error('Embeddings service health check failed:', error);
      return false;
    }
  }
}