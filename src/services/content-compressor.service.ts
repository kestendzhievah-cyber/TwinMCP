import { ContextSection, ContentCompressionOptions } from '../types/context-assembly.types';
import { TokenCounter } from './token-counter.service';

export class ContentCompressor {
  private tokenCounter: TokenCounter;

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async compress(
    sections: ContextSection[], 
    options: ContentCompressionOptions
  ): Promise<ContextSection[]> {
    const compressedSections: ContextSection[] = [];
    let totalTokens = 0;
    const targetTokens = sections.reduce((sum, s) => sum + s.tokenCount, 0) * options.targetRatio;
    
    // Tri par importance si nécessaire
    const sortedSections = options.prioritizeImportant 
      ? sections.sort((a, b) => b.priority - a.priority)
      : sections;
    
    for (const section of sortedSections) {
      if (totalTokens + section.tokenCount <= targetTokens) {
        compressedSections.push(section);
        totalTokens += section.tokenCount;
      } else {
        // Compression partielle de la section
        const remainingTokens = targetTokens - totalTokens;
        if (remainingTokens > 100) { // Minimum pour une section utile
          const compressedSection = await this.compressSection(section, remainingTokens, options);
          if (compressedSection) {
            compressedSections.push(compressedSection);
            break;
          }
        }
      }
    }
    
    return compressedSections;
  }

  private async compressSection(
    section: ContextSection, 
    maxTokens: number, 
    options: ContentCompressionOptions
  ): Promise<ContextSection | null> {
    if (options.preserveStructure) {
      return this.compressWithStructure(section, maxTokens);
    } else {
      return this.compressBySentences(section, maxTokens);
    }
  }

  private compressWithStructure(section: ContextSection, maxTokens: number): ContextSection | null {
    const content = section.content;
    const lines = content.split('\n');
    let compressedContent = '';
    let currentTokens = 0;
    
    for (const line of lines) {
      const lineTokens = this.tokenCounter.countTokens(line);
      
      if (currentTokens + lineTokens <= maxTokens) {
        compressedContent += line + '\n';
        currentTokens += lineTokens;
      } else {
        // Ajouter une indication de troncature
        if (compressedContent.trim()) {
          compressedContent += '\n... [content truncated]';
        }
        break;
      }
    }
    
    if (compressedContent.trim().length === 0) {
      return null;
    }
    
    return {
      ...section,
      content: compressedContent.trim(),
      tokenCount: currentTokens
    };
  }

  private compressBySentences(section: ContextSection, maxTokens: number): ContextSection | null {
    const sentences = section.content.split(/[.!?]+/);
    let compressedContent = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceText = sentence.trim();
      if (!sentenceText) continue;
      
      const sentenceTokens = this.tokenCounter.countTokens(sentenceText + '.');
      
      if (currentTokens + sentenceTokens <= maxTokens) {
        compressedContent += sentenceText + '. ';
        currentTokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    if (compressedContent.trim().length === 0) {
      return null;
    }
    
    return {
      ...section,
      content: compressedContent.trim(),
      tokenCount: currentTokens
    };
  }

  async compressAggressively(sections: ContextSection[], targetRatio: number): Promise<ContextSection[]> {
    return sections.map(section => {
      const targetTokens = Math.floor(section.tokenCount * targetRatio);
      const compressed = this.compressBySentences(section, targetTokens);
      return compressed || section;
    }).filter(section => section.content.trim().length > 0);
  }

  async smartCompression(
    sections: ContextSection[], 
    maxTokens: number,
    preserveImportant: boolean = true
  ): Promise<ContextSection[]> {
    if (preserveImportant) {
      // Garder les sections à haute priorité intactes
      const highPriority = sections.filter(s => s.priority <= 2);
      const lowPriority = sections.filter(s => s.priority > 2);
      
      const highPriorityTokens = highPriority.reduce((sum, s) => sum + s.tokenCount, 0);
      const remainingTokens = maxTokens - highPriorityTokens;
      
      if (remainingTokens > 0) {
        const compressedLow = await this.compress(lowPriority, {
          targetRatio: remainingTokens / lowPriority.reduce((sum, s) => sum + s.tokenCount, 1),
          preserveStructure: true,
          prioritizeImportant: false
        });
        
        return [...highPriority, ...compressedLow];
      }
      
      return highPriority.slice(0, Math.floor(maxTokens / 200)); // Approximation
    }
    
    return this.compress(sections, {
      targetRatio: maxTokens / sections.reduce((sum, s) => sum + s.tokenCount, 1),
      preserveStructure: true,
      prioritizeImportant: true
    });
  }

  calculateCompressionRatio(original: ContextSection[], compressed: ContextSection[]): number {
    const originalTokens = original.reduce((sum, s) => sum + s.tokenCount, 0);
    const compressedTokens = compressed.reduce((sum, s) => sum + s.tokenCount, 0);
    
    return originalTokens > 0 ? compressedTokens / originalTokens : 1;
  }
}
