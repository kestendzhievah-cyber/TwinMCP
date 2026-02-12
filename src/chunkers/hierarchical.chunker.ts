import { DocumentChunker } from '../interfaces/chunker.interface';
import { ParsedDocument, DocumentChunk, IndexerConfig } from '../types/indexation.types';
import crypto from 'crypto';

export class HierarchicalChunker implements DocumentChunker {
  async chunk(document: ParsedDocument, config: IndexerConfig): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    // Utilisation des sections du document pour le découpage hiérarchique
    const sections = document.metadata.sections;
    
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, document, config);
      chunks.push(...sectionChunks);
    }
    
    return chunks;
  }

  private chunkSection(section: any, document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = section.content;
    
    // Si la section est petite, un seul chunk
    if (content.length <= config.maxChunkSize) {
      chunks.push(this.createChunk(content, 0, content.length, 0, 1, section, document));
      return chunks;
    }
    
    // Découpage récursif pour les sous-sections
    if (section.subsections && section.subsections.length > 0) {
      for (const subsection of section.subsections) {
        const subsectionChunks = this.chunkSection(subsection, document, config);
        chunks.push(...subsectionChunks);
      }
    } else {
      // Découpage par paragraphes
      const paragraphs = content.split(/\n\n+/);
      let currentChunk = '';
      let chunkIndex = 0;
      let position = 0;
      
      for (const paragraph of paragraphs) {
        const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
        
        if (potentialChunk.length <= config.maxChunkSize) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk.trim()) {
            chunks.push(this.createChunk(
              currentChunk.trim(),
              position,
              position + currentChunk.length,
              chunkIndex,
              Math.ceil(content.length / config.maxChunkSize),
              section,
              document
            ));
            chunkIndex++;
            position += currentChunk.length;
          }
          currentChunk = paragraph;
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
    }
    
    return chunks;
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
        sectionLevel: section.level,
        hasCode: /```/.test(content),
        hasLinks: /https?:\/\//.test(content),
        language: document.metadata.language,
        complexity: this.assessComplexity(content),
        tags: this.extractTags(content)
      },
      context: {
        documentTitle: document.title,
        documentType: document.type,
        sectionContext: section.title
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
    
    if (/react|component|jsx/.test(content.toLowerCase())) tags.push('react');
    if (/typescript|interface|type/.test(content.toLowerCase())) tags.push('typescript');
    if (/api|endpoint|request/.test(content.toLowerCase())) tags.push('api');
    if (/example|demo|sample/.test(content.toLowerCase())) tags.push('example');
    if (/tutorial|guide|how/.test(content.toLowerCase())) tags.push('tutorial');
    
    return [...new Set(tags)];
  }
}
