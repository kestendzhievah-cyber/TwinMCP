import { ParserInterface } from '../interfaces/chunker.interface';
import { 
  ParsedDocument, 
  DocumentSection, 
  CodeBlock, 
  DocumentLink, 
  TableOfContents, 
  TOCEntry,
  ParseOptions,
  ParserResult
} from '../types/indexation.types';
import crypto from 'crypto';

export class MarkdownParser implements ParserInterface {
  async parse(content: string, options: ParseOptions): Promise<ParserResult> {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    const codeBlocks: CodeBlock[] = [];
    const links: DocumentLink[] = [];
    const tocEntries: TOCEntry[] = [];

    let currentSection: DocumentSection | null = null;
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    let codeBlockContent = '';
    let codeBlockStart = 0;
    let position = 0;

    // Analyse du contenu
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();

      // Gestion des blocs de code
      if (trimmedLine.startsWith('```')) {
        if (!inCodeBlock) {
          // Début d'un bloc de code
          inCodeBlock = true;
          codeBlockLanguage = trimmedLine.substring(3).trim();
          codeBlockContent = '';
          codeBlockStart = position;
        } else {
          // Fin d'un bloc de code
          inCodeBlock = false;
          
          const codeBlock: CodeBlock = {
            id: crypto.randomUUID(),
            language: codeBlockLanguage || 'text',
            code: codeBlockContent,
            context: this.extractCodeContext(lines, i),
            position: {
              start: codeBlockStart,
              end: position + line.length
            },
            metadata: {
              lineCount: codeBlockContent.split('\n').length,
              complexity: this.assessCodeComplexity(codeBlockContent),
              imports: this.extractImports(codeBlockContent),
              exports: this.extractExports(codeBlockContent),
              functions: this.extractFunctions(codeBlockContent),
              classes: this.extractClasses(codeBlockContent)
            }
          };
          
          codeBlocks.push(codeBlock);
          codeBlockContent = '';
          codeBlockLanguage = '';
        }
      } else if (inCodeBlock) {
        codeBlockContent += line + '\n';
      } else {
        // Gestion des sections (headers)
        if (trimmedLine.startsWith('#')) {
          // Sauvegarde de la section précédente
          if (currentSection) {
            currentSection.endPosition = position;
            sections.push(currentSection);
          }

          // Nouvelle section
          const match = trimmedLine.match(/^#+/);
    const level = match?.[0]?.length || 1;
          const title = trimmedLine.replace(/^#+\s*/, '');
          
          currentSection = {
            id: crypto.randomUUID(),
            level,
            title,
            content: '',
            startPosition: position,
            endPosition: 0,
            subsections: [],
            metadata: {
              wordCount: 0,
              hasCode: false,
              hasLinks: false,
              estimatedReadingTime: 0
            }
          };

          // Ajout à la table des matières
          const tocEntry: TOCEntry = {
            id: crypto.randomUUID(),
            level,
            title,
            anchor: this.generateAnchor(title),
            children: [],
            position: sections.length
          };
          tocEntries.push(tocEntry);
        }

        // Extraction des liens
        const markdownLinks = this.extractMarkdownLinks(line, position);
        links.push(...markdownLinks);

        // Ajout du contenu à la section courante
        if (currentSection && line) {
          currentSection.content += line + '\n';
        }
      }

      position += line.length + 1; // +1 pour le caractère newline
    }

    // Ajout de la dernière section
    if (currentSection) {
      currentSection.endPosition = position;
      sections.push(currentSection);
    }

    // Mise à jour des métadonnées des sections
    sections.forEach(section => {
      section.metadata.wordCount = this.countWords(section.content);
      section.metadata.hasCode = /```/.test(section.content);
      section.metadata.hasLinks = /\[.*?\]\(.*?\)/.test(section.content);
      section.metadata.estimatedReadingTime = Math.ceil(section.metadata.wordCount / 200); // 200 mots/min
    });

    // Construction de la table des matières hiérarchique
    const toc = this.buildHierarchicalTOC(tocEntries);

    // Nettoyage du contenu (suppression du markdown)
    const cleanContent = this.cleanMarkdownContent(content);

    // Détermination du type de document
    const documentType = this.inferDocumentType(options.filePath, sections);

    return {
      title: this.extractTitle(content, options.filePath),
      type: documentType,
      format: 'markdown',
      metadata: {
        language: 'markdown',
        encoding: options.encoding || 'utf-8',
        size: content.length,
        lastModified: options.lastModified,
        sections,
        codeBlocks,
        links,
        toc
      },
      content: cleanContent,
      rawContent: content
    };
  }

  private extractCodeContext(lines: string[], index: number): string {
    const contextLines = [];
    const start = Math.max(0, index - 3);
    const end = Math.min(lines.length - 1, index + 3);
    
    for (let i = start; i <= end; i++) {
      if (i !== index && lines[i] && !lines[i].trim().startsWith('```')) {
        contextLines.push(lines[i]);
      }
    }
    
    return contextLines.join('\n');
  }

  private assessCodeComplexity(code: string): 'simple' | 'medium' | 'complex' {
    const lines = code.split('\n').length;
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    
    if (lines > 50 || cyclomaticComplexity > 10) return 'complex';
    if (lines > 20 || cyclomaticComplexity > 5) return 'medium';
    return 'simple';
  }

  private calculateCyclomaticComplexity(code: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||'];
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches && matches.length > 0) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private extractImports(code: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
    
    return imports;
  }

  private extractExports(code: string): string[] {
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    const exports = [];
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
    }
    
    return exports;
  }

  private extractFunctions(code: string): string[] {
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
    const functions = [];
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1] || match[2];
      if (functionName) {
        functions.push(functionName);
      }
    }
    
    return [...new Set(functions)];
  }

  private extractClasses(code: string): string[] {
    const classRegex = /class\s+(\w+)/g;
    const classes = [];
    let match;
    
    while ((match = classRegex.exec(code)) !== null) {
      if (match[1]) {
        classes.push(match[1]);
      }
    }
    
    return classes;
  }

  private extractMarkdownLinks(line: string, position: number): DocumentLink[] {
    const links: DocumentLink[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let linePosition = position;

    while ((match = linkRegex.exec(line)) !== null) {
      const text = match[1] || '';
      const url = match[2] || '';
      const startPos = linePosition + (match.index || 0);
      const endPos = startPos + (match[0]?.length || 0);

      const linkData: DocumentLink = {
        id: crypto.randomUUID(),
        url,
        text,
        type: url.startsWith('#') ? 'anchor' : url.startsWith('http') ? 'external' : 'internal',
        position: {
          start: startPos,
          end: endPos
        }
      };
      
      if (url.startsWith('#')) {
        linkData.target = url.substring(1);
      }
      
      links.push(linkData);
    }

    return links;
  }

  private generateAnchor(title: string): string {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private buildHierarchicalTOC(entries: TOCEntry[]): TableOfContents {
    const root: TOCEntry[] = [];
    const stack: TOCEntry[] = [];
    
    entries.forEach(entry => {
      while (stack.length > 0 && stack[stack.length - 1]?.level >= entry.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        root.push(entry);
      } else {
        const parent = stack[stack.length - 1];
        if (parent && parent.children) {
          parent.children.push(entry);
        }
      }
      
      stack.push(entry);
    });

    const maxDepth = entries.length > 0 ? Math.max(...entries.map(e => e.level), 0) : 0;
    
    return {
      entries: root,
      maxDepth
    };
  }

  private cleanMarkdownContent(content: string): string {
    return content
      // Suppression des headers markdown
      .replace(/^#{1,6}\s+/gm, '')
      // Suppression des blocs de code
      .replace(/```[\s\S]*?```/g, '[CODE BLOCK]')
      // Suppression du code inline
      .replace(/`[^`]+`/g, '$1')
      // Suppression des liens markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Suppression du formatage
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Suppression des listes
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Nettoyage des lignes vides multiples
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractTitle(content: string, filePath: string): string {
    // Recherche du premier header H1
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }

    // Extraction depuis le nom de fichier
    const fileName = filePath.split('/').pop() || filePath;
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private inferDocumentType(filePath: string, sections: DocumentSection[]): ParsedDocument['type'] {
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('readme')) return 'readme';
    if (fileName.includes('license')) return 'license';
    if (fileName.includes('changelog') || fileName.includes('history')) return 'changelog';
    if (fileName.includes('example') || fileName.includes('demo')) return 'example';
    if (fileName.includes('guide') || fileName.includes('tutorial')) return 'guide';
    if (fileName.includes('api') || sections.some(s => s.title.toLowerCase().includes('api'))) return 'api';
    
    return 'reference';
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}
