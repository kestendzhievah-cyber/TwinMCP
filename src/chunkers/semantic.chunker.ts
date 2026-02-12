import { DocumentChunker } from '../interfaces/chunker.interface';
import { ParsedDocument, DocumentChunk, IndexerConfig } from '../types/indexation.types';
import crypto from 'crypto';

export class SemanticChunker implements DocumentChunker {
  async chunk(document: ParsedDocument, config: IndexerConfig): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    
    // Analyse sémantique du contenu
    const semanticSections = this.identifySemanticSections(content);
    
    for (const section of semanticSections) {
      // Découpage basé sur la cohérence sémantique
      const sectionChunks = this.chunkSemanticSection(section, config, document);
      chunks.push(...sectionChunks);
    }

    return chunks;
  }

  private identifySemanticSections(content: string): Array<{
    title: string;
    content: string;
    startPosition: number;
    endPosition: number;
    type: 'introduction' | 'explanation' | 'code' | 'example' | 'conclusion';
  }> {
    const sections: Array<{ title: string; content: string; startPosition: number; endPosition: number; type: 'introduction' | 'explanation' | 'code' | 'example' | 'conclusion'; }> = [];
    
    // Identification basée sur les patterns markdown et la structure
    const lines = content.split('\n');
    let currentSection: {
      title: string;
      content: string;
      startPosition: number;
      endPosition: number;
      type: 'introduction' | 'explanation' | 'code' | 'example' | 'conclusion';
    } = {
      title: '',
      content: '',
      startPosition: 0,
      endPosition: 0,
      type: 'explanation'
    };
    
    let position = 0;

    for (const line of lines) {
      if (!line) continue;
      const trimmedLine = line.trim();
      
      // Détection de nouvelles sections
      if (trimmedLine.startsWith('#')) {
        // Sauvegarde de la section précédente
        if (currentSection.content.trim()) {
          currentSection.endPosition = position;
          sections.push({ ...currentSection });
        }
        
        // Nouvelle section
        currentSection = {
          title: trimmedLine.replace(/^#+\s*/, ''),
          content: '',
          startPosition: position,
          endPosition: 0,
          type: this.inferSectionType(trimmedLine)
        };
      } else if (trimmedLine.startsWith('```')) {
        // Bloc de code
        currentSection.type = 'code';
      }
      
      currentSection.content += line + '\n';
      position += line.length + 1;
    }
    
    // Ajout de la dernière section
    if (currentSection.content.trim()) {
      currentSection.endPosition = position;
      sections.push(currentSection);
    }
    
    return sections;
  }

  private inferSectionType(header: string): 'introduction' | 'explanation' | 'code' | 'example' | 'conclusion' {
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('intro') || lowerHeader.includes('overview')) {
      return 'introduction';
    } else if (lowerHeader.includes('example') || lowerHeader.includes('demo')) {
      return 'example';
    } else if (lowerHeader.includes('conclusion') || lowerHeader.includes('summary')) {
      return 'conclusion';
    } else if (lowerHeader.includes('code') || lowerHeader.includes('implementation')) {
      return 'code';
    }
    
    return 'explanation';
  }

  private chunkSemanticSection(
    section: any, 
    config: IndexerConfig, 
    document: ParsedDocument
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = section.content;
    
    // Si la section est petite, on la garde intacte
    if (content.length <= config.maxChunkSize) {
      chunks.push(this.createChunk(section.content, 0, content.length, 0, 1, section, document));
      return chunks;
    }
    
    // Découpage intelligent basé sur la cohérence sémantique
    const sentences = this.splitIntoSentences(content);
    let currentChunk = '';
    let chunkIndex = 0;
    let position = 0;
    
    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length <= config.maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Création du chunk
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(
            currentChunk.trim(), 
            position, 
            position + currentChunk.length, 
            chunkIndex, 
            Math.ceil(sentences.length / (config.maxChunkSize / 100)), // Estimation
            section, 
            document
          ));
          chunkIndex++;
          position += currentChunk.length;
        }
        
        currentChunk = sentence;
      }
    }
    
    // Dernier chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        currentChunk.trim(), 
        position, 
        position + currentChunk.length, 
        chunkIndex, 
        chunkIndex + 1, 
        section, 
        document
      ));
    }
    
    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Découpage intelligent en phrases
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  }

  private createChunk(
    content: string,
    startPosition: number,
    endPosition: number,
    index: number,
    total: number,
    section: any,
    document: ParsedDocument
  ): DocumentChunk {
    return {
      id: crypto.randomUUID(),
      documentId: document.id,
      content: content.trim(),
      type: this.inferChunkType(content),
      position: {
        start: startPosition,
        end: endPosition,
        index,
        total
      },
      metadata: {
        wordCount: content.split(/\s+/).length,
        sectionTitle: section.title,
        sectionLevel: this.getSectionLevel(section.title),
        hasCode: /```/.test(content),
        hasLinks: /https?:\/\//.test(content),
        language: document.metadata.language,
        complexity: this.assessComplexity(content),
        tags: this.extractTags(content)
      },
      context: {
        documentTitle: document.title,
        documentType: document.type
      },
      createdAt: new Date()
    };
  }

  private inferChunkType(content: string): DocumentChunk['type'] {
    if (/```/.test(content)) return 'mixed';
    if (/function|class|const|let|var/.test(content)) return 'code';
    if (content.length < 200) return 'metadata';
    return 'text';
  }

  private getSectionLevel(title: string): number {
    const match = title.match(/^(#+)/);
    return match ? match[1]?.length || 1 : 1;
  }

  private assessComplexity(content: string): 'simple' | 'medium' | 'complex' {
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    const technicalTerms = content.split(/\s+/).filter(word => 
      /algorithm|implementation|optimization|architecture/.test(word.toLowerCase())
    ).length;
    
    if (codeBlocks > 2 || technicalTerms > 3) return 'complex';
    if (codeBlocks > 0 || technicalTerms > 0) return 'medium';
    return 'simple';
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extraction de tags basée sur le contenu
    if (/react|component|jsx/.test(content.toLowerCase())) tags.push('react');
    if (/typescript|interface|type/.test(content.toLowerCase())) tags.push('typescript');
    if (/api|endpoint|request/.test(content.toLowerCase())) tags.push('api');
    if (/example|demo|sample/.test(content.toLowerCase())) tags.push('example');
    if (/tutorial|guide|how/.test(content.toLowerCase())) tags.push('tutorial');
    
    return [...new Set(tags)];
  }
}
