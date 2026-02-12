import { VectorSearchResult } from '../types/embeddings.types';
import * as crypto from 'crypto';

export class ContentDeduplicator {
  async deduplicate(results: VectorSearchResult[]): Promise<VectorSearchResult[]> {
    const seen = new Set<string>();
    const deduplicated: VectorSearchResult[] = [];
    
    for (const result of results) {
      const contentHash = this.generateContentHash(result.chunk.content);
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        deduplicated.push(result);
      }
    }
    
    return deduplicated;
  }

  async deduplicateWithSimilarity(
    results: VectorSearchResult[], 
    similarityThreshold: number = 0.9
  ): Promise<VectorSearchResult[]> {
    const deduplicated: VectorSearchResult[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const currentResult = results[i];
      if (!currentResult) continue;
      
      let isDuplicate = false;
      
      // Vérifier la similarité avec les résultats déjà ajoutés
      for (const existingResult of deduplicated) {
        const similarity = this.calculateContentSimilarity(
          currentResult.chunk.content,
          existingResult.chunk.content
        );
        
        if (similarity >= similarityThreshold) {
          isDuplicate = true;
          // Garder le résultat avec le meilleur score
          if (currentResult.score > existingResult.score) {
            const index = deduplicated.indexOf(existingResult);
            deduplicated[index] = currentResult;
          }
          break;
        }
      }
      
      if (!isDuplicate) {
        deduplicated.push(currentResult);
      }
    }
    
    return deduplicated;
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Similarité de Jaccard simplifiée sur les mots
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  async removeNearDuplicates(
    results: VectorSearchResult[],
    threshold: number = 0.85
  ): Promise<VectorSearchResult[]> {
    const deduplicated: VectorSearchResult[] = [];
    
    for (const result of results) {
      let isDuplicate = false;
      
      for (const existing of deduplicated) {
        const similarity = this.calculateContentSimilarity(
          result.chunk.content,
          existing.chunk.content
        );
        
        if (similarity >= threshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        deduplicated.push(result);
      }
    }
    
    return deduplicated;
  }

  async groupSimilarContent(
    results: VectorSearchResult[],
    threshold: number = 0.7
  ): Promise<VectorSearchResult[][]> {
    const groups: VectorSearchResult[][] = [];
    const processed = new Set<string>();
    
    for (const result of results) {
      if (processed.has(result.chunk.id)) continue;
      
      const group = [result];
      processed.add(result.chunk.id);
      
      // Trouver tous les contenus similaires
      for (const otherResult of results) {
        if (processed.has(otherResult.chunk.id)) continue;
        
        const similarity = this.calculateContentSimilarity(
          result.chunk.content,
          otherResult.chunk.content
        );
        
        if (similarity >= threshold) {
          group.push(otherResult);
          processed.add(otherResult.chunk.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
}
