import { DocumentChunker } from '../interfaces/chunker.interface';
import { ParsedDocument, DocumentChunk, IndexerConfig } from '../types/indexation.types';
import crypto from 'crypto';

export class MixedChunker implements DocumentChunker {
  async chunk(document: ParsedDocument, config: IndexerConfig): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    
    // Analyse du contenu pour déterminer la meilleure stratégie
    const hasStructure = document.metadata.sections.length > 0;
    const hasCodeBlocks = document.metadata.codeBlocks.length > 0;
    const isLongDocument = content.length > config.maxChunkSize * 2;
    
    if (hasStructure && hasCodeBlocks) {
      // Stratégie mixte : structure + code séparé
      chunks.push(...this.chunkMixedStructure(document, config));
    } else if (hasStructure) {
      // Stratégie hiérarchique
      chunks.push(...this.chunkHierarchical(document, config));
    } else if (isLongDocument) {
      // Stratégie par taille fixe
      chunks.push(...this.chunkFixedSize(document, config));
    } else {
      // Un seul chunk
      chunks.push(this.createSingleChunk(document));
    }
    
    return chunks;
  }

  private chunkMixedStructure(document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = document.metadata.sections;
    
    for (const section of sections) {
      // Séparation du texte et du code
      const textParts = this.extractTextParts(section.content);
      const codeParts = this.extractCodeParts(section.content);
      
      // Chunk pour le texte
      if (textParts.length > 0) {
        const textContent = textParts.join('\n\n');
        if (textContent.length > config.minChunkSize) {
          const textChunks = this.chunkTextContent(textContent, section, document, config);
          chunks.push(...textChunks);
        }
      }
      
      // Chunks séparés pour le code
      for (const codePart of codeParts) {
        const codeChunk = this.createCodeChunk(codePart, section, document);
        chunks.push(codeChunk);
      }
    }
    
    return chunks;
  }

  private chunkHierarchical(document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = document.metadata.sections;
    
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, document, config);
      chunks.push(...sectionChunks);
    }
    
    return chunks;
  }

  private chunkFixedSize(document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    
    const chunkSize = config.maxChunkSize;
    const overlap = config.overlapSize;
    
    let start = 0;
    let chunkIndex = 0;
    
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunkContent = content.substring(start, end);
      
      // Ajustement pour ne pas couper au milieu d'un mot
      if (end < content.length && chunkContent.length === chunkSize) {
        const lastSpace = chunkContent.lastIndexOf(' ');
        if (lastSpace > chunkSize * 0.8) {
          chunkContent = chunkContent.substring(0, lastSpace);
        }
      }
      
      const chunk = this.createChunk(chunkContent, start, start + chunkContent.length, chunkIndex, 
        Math.ceil((content.length - overlap) / (chunkSize - overlap)), null, document);
      chunks.push(chunk);
      
      start = Math.min(start + chunkSize - overlap, content.length);
      chunkIndex++;
    }
    
    return chunks;
  }

  private createSingleChunk(document: ParsedDocument): DocumentChunk {
    return this.createChunk(document.content, 0, document.content.length, 0, 1, null, document);
  }

  private extractTextParts(content: string): string[] {
    const parts: string[] = [];
    let cleanContent = content;
    
    // Suppression des blocs de code
    cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
    
    // Découpage par paragraphes
    const paragraphs = cleanContent.split(/\n\n+/);
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed.length > 50) { // Ignorer les paragraphes trop courts
        parts.push(trimmed);
      }
    }
    
    return parts;
  }

  private extractCodeParts(content: string): Array<{code: string, language: string}> {
    const codeParts: Array<{code: string, language: string}> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match[1] && match[2]) {
        codeParts.push({
          language: match[1],
          code: match[2]
        });
      }
    }
    
    return codeParts;
  }

  private chunkTextContent(text: string, section: any, document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let chunkIndex = 0;
    let position = 0;
    
    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length <= config.maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(
            currentChunk.trim(),
            position,
            position + currentChunk.length,
            chunkIndex,
            Math.ceil(text.length / config.maxChunkSize),
            section,
            document
          ));
          chunkIndex++;
          position += currentChunk.length;
        }
        currentChunk = sentence;
      }
    }
    
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

  private createCodeChunk(codePart: {code: string, language: string}, section: any, document: ParsedDocument): DocumentChunk {
    return {
      id: crypto.randomUUID(),
      documentId: document.id,
      content: codePart.code,
      type: 'code',
      position: {
        start: 0,
        end: codePart.code.length,
        index: 0,
        total: 1
      },
      metadata: {
        wordCount: codePart.code.split(/\s+/).length,
        sectionTitle: section?.title,
        sectionLevel: section?.level,
        hasCode: true,
        hasLinks: false,
        language: codePart.language || 'text',
        complexity: this.assessCodeComplexity(codePart.code),
        tags: [(codePart.language || 'text'), 'code']
      },
      context: {
        documentTitle: document.title,
        documentType: document.type,
        sectionContext: section?.title
      },
      createdAt: new Date()
    };
  }

  private chunkSection(section: any, document: ParsedDocument, config: IndexerConfig): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = section.content;
    
    if (content.length <= config.maxChunkSize) {
      chunks.push(this.createChunk(content, 0, content.length, 0, 1, section, document));
      return chunks;
    }
    
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
        sectionTitle: section?.title,
        sectionLevel: section?.level,
        hasCode: /```/.test(content),
        hasLinks: /https?:\/\//.test(content),
        language: document.metadata.language,
        complexity: this.assessComplexity(content),
        tags: this.extractTags(content)
      },
      context: {
        documentTitle: document.title,
        documentType: document.type,
        sectionContext: section?.title
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

  private assessCodeComplexity(code: string): 'simple' | 'medium' | 'complex' {
    const lines = code.split('\n').length;
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch'];
    let complexity = 1;
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches && matches.length > 0) {
        complexity += matches.length;
      }
    });
    
    if (lines > 50 || complexity > 10) return 'complex';
    if (lines > 20 || complexity > 5) return 'medium';
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
