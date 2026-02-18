export class TokenCounter {
  countTokens(text: string): number {
    if (!text) return 0;
    
    // Approximation simple: 1 token ≈ 4 caractères
    // En production, utiliser tiktoken ou une bibliothèque spécialisée
    return Math.ceil(text.length / 4);
  }

  countTokensByModel(text: string, model: string): number {
    const baseTokens = this.countTokens(text);
    
    const modelMultipliers: Record<string, number> = {
      'gpt-4o': 1.0,
      'gpt-4o-mini': 1.0,
      'gpt-4-turbo': 1.0,
      'gpt-4': 1.0,
      'gpt-3.5-turbo': 1.0,
      'claude-3': 1.2,
      'llama-2': 1.1,
      'custom': 1.0
    };
    
    const multiplier = modelMultipliers[model] || 1.0;
    return Math.ceil(baseTokens * multiplier);
  }

  estimateTokensFromChunks(chunks: any[]): number {
    return chunks.reduce((total, chunk) => {
      const content = chunk.content || '';
      return total + this.countTokens(content);
    }, 0);
  }

  validateTokenLimit(content: string, maxTokens: number): {
    isValid: boolean;
    actualTokens: number;
    overflow: number;
  } {
    const actualTokens = this.countTokens(content);
    const isValid = actualTokens <= maxTokens;
    const overflow = Math.max(0, actualTokens - maxTokens);
    
    return { isValid, actualTokens, overflow };
  }

  truncateToTokenLimit(text: string, maxTokens: number): string {
    const tokens = this.countTokens(text);
    
    if (tokens <= maxTokens) {
      return text;
    }
    
    // Troncation simple basée sur le ratio de caractères
    const ratio = maxTokens / tokens;
    const targetLength = Math.floor(text.length * ratio * 0.9); // 90% pour être safe
    
    return text.substring(0, targetLength);
  }
}
