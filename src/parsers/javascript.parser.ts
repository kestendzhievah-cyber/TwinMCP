import { ParserInterface } from '../interfaces/chunker.interface';
import { 
  DocumentSection, 
  CodeBlock, 
  DocumentLink, 
  ParseOptions,
  ParserResult
} from '../types/indexation.types';
import crypto from 'crypto';

export class JavaScriptParser implements ParserInterface {
  async parse(content: string, options: ParseOptions): Promise<ParserResult> {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    const codeBlocks: CodeBlock[] = [];
    const links: DocumentLink[] = [];

    let currentSection: DocumentSection | null = null;
    let position = 0;
    let inComment = false;
    let commentContent = '';
    let commentStart = 0;

    // Analyse du contenu JavaScript
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();

      // Gestion des commentaires JSDoc
      if (trimmedLine.startsWith('/**')) {
        inComment = true;
        commentContent = line;
        commentStart = position;
      } else if (inComment && trimmedLine.endsWith('*/')) {
        commentContent += line;
        inComment = false;
        
        // Création d'une section de documentation
        if (currentSection) {
          currentSection.endPosition = position;
          sections.push(currentSection);
        }
        
        currentSection = {
          id: crypto.randomUUID(),
          level: 1,
          title: this.extractJSDocTitle(commentContent),
          content: commentContent,
          startPosition: commentStart,
          endPosition: position + line.length,
          subsections: [],
          metadata: {
            wordCount: this.countWords(commentContent),
            hasCode: false,
            hasLinks: /\[.*?\]\(.*?\)/.test(commentContent),
            estimatedReadingTime: Math.ceil(this.countWords(commentContent) / 200)
          }
        };
      } else if (inComment) {
        commentContent += line + '\n';
      } else {
        // Détection des sections principales (classes, fonctions)
        if (this.isSectionHeader(trimmedLine)) {
          if (currentSection) {
            currentSection.endPosition = position;
            sections.push(currentSection);
          }

          const title = this.extractSectionTitle(trimmedLine);
          
          currentSection = {
            id: crypto.randomUUID(),
            level: 1,
            title,
            content: '',
            startPosition: position,
            endPosition: 0,
            subsections: [],
            metadata: {
              wordCount: 0,
              hasCode: true,
              hasLinks: false,
              estimatedReadingTime: 0
            }
          };
        }

        // Ajout du contenu à la section courante
        if (currentSection && line) {
          currentSection.content += line + '\n';
        }
      }

      position += line.length + 1;
    }

    // Ajout de la dernière section
    if (currentSection) {
      currentSection.endPosition = position;
      sections.push(currentSection);
    }

    // Création du bloc de code principal
    const mainCodeBlock: CodeBlock = {
      id: crypto.randomUUID(),
      language: 'javascript',
      code: content,
      context: 'JavaScript source file',
      position: {
        start: 0,
        end: content.length
      },
      metadata: {
        lineCount: lines.length,
        complexity: this.assessCodeComplexity(content),
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        functions: this.extractFunctions(content),
        classes: this.extractClasses(content)
      }
    };
    codeBlocks.push(mainCodeBlock);

    // Mise à jour des métadonnées des sections
    sections.forEach(section => {
      section.metadata.wordCount = this.countWords(section.content);
      section.metadata.hasCode = /function|class|const|let|var/.test(section.content);
      section.metadata.hasLinks = /\[.*?\]\(.*?\)/.test(section.content);
      section.metadata.estimatedReadingTime = Math.ceil(section.metadata.wordCount / 200);
    });

    return {
      title: this.extractTitle(content, options.filePath),
      type: 'reference',
      format: 'javascript',
      metadata: {
        language: 'javascript',
        encoding: options.encoding || 'utf-8',
        size: content.length,
        lastModified: options.lastModified,
        sections,
        codeBlocks,
        links
      },
      content: this.cleanJavaScriptContent(content),
      rawContent: content
    };
  }

  private isSectionHeader(line: string): boolean {
    const sectionPatterns = [
      /^(export\s+)?(class)\s+\w+/,
      /^(export\s+)?(async\s+)?function\s+\w+/,
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(function|\([^)]*\)\s*=>)/,
      /^(export\s+)?default\s+(class|function)/
    ];
    
    return sectionPatterns.some(pattern => pattern.test(line));
  }

  private extractSectionTitle(line: string): string {
    const classMatch = line.match(/(?:class)\s+(\w+)/);
    if (classMatch && classMatch[1]) return classMatch[1];
    
    const functionMatch = line.match(/(?:function)\s+(\w+)/);
    if (functionMatch && functionMatch[1]) return functionMatch[1];
    
    const constMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
    if (constMatch && constMatch[1]) return constMatch[1];
    
    return 'Unknown Section';
  }

  private extractJSDocTitle(comment: string): string {
    const titleMatch = comment.match(/\*\s+@(?:class|function|description)\s+(.+)/);
    if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    
    const lines = comment.split('\n');
    const firstLine = lines[0];
    if (firstLine) {
      return firstLine.replace(/[\/\*\s]/g, '').trim() || 'Documentation';
    }
    
    return 'Documentation';
  }

  private assessCodeComplexity(code: string): 'simple' | 'medium' | 'complex' {
    const lines = code.split('\n').length;
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    const nestingDepth = this.calculateNestingDepth(code);
    
    if (lines > 200 || cyclomaticComplexity > 15 || nestingDepth > 4) return 'complex';
    if (lines > 50 || cyclomaticComplexity > 7 || nestingDepth > 2) return 'medium';
    return 'simple';
  }

  private calculateCyclomaticComplexity(code: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1;
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches && matches.length > 0) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private calculateNestingDepth(code: string): number {
    const lines = code.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('{')) {
        currentDepth += trimmedLine.split('{').length - 1;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      
      if (trimmedLine.includes('}')) {
        currentDepth -= trimmedLine.split('}').length - 1;
        currentDepth = Math.max(0, currentDepth);
      }
    });
    
    return maxDepth;
  }

  private extractImports(content: string): string[] {
    const importRegexes = [
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      /import\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ];
    
    const imports: string[] = [];
    
    importRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
          imports.push(match[1]);
        }
      }
    });
    
    return [...new Set(imports)];
  }

  private extractExports(content: string): string[] {
    const exportRegexes = [
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
      /export\s*{\s*([^}]+)\s*}/g,
      /module\.exports\s*=\s*(\w+)/g,
      /exports\.(\w+)\s*=/g
    ];
    
    const exports: string[] = [];
    
    exportRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
          if (regex.source.includes('{')) {
            // Export { name1, name2 }
            const names = match[1].split(',').map(name => name.trim().split(' as ')[0]).filter(Boolean);
            exports.push(...names);
          } else {
            exports.push(match[1]);
          }
        }
      }
    });
    
    return [...new Set(exports)];
  }

  private extractFunctions(content: string): string[] {
    const functionRegexes = [
      /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g
    ];
    
    const functions: string[] = [];
    
    functionRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const functionName = match[1] || match[2];
        if (functionName) {
          functions.push(functionName);
        }
      }
    });
    
    return [...new Set(functions)];
  }

  private extractClasses(content: string): string[] {
    const classRegex = /(?:class)\s+(\w+)/g;
    const classes: string[] = [];
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      if (match[1]) {
        classes.push(match[1]);
      }
    }
    
    return [...new Set(classes)];
  }

  private cleanJavaScriptContent(content: string): string {
    return content
      // Suppression des commentaires multi-lignes
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Suppression des commentaires mono-ligne
      .replace(/\/\/.*$/gm, '')
      // Suppression des espaces multiples
      .replace(/\s+/g, ' ')
      // Suppression des lignes vides
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private extractTitle(content: string, filePath: string): string {
    // Recherche des exports principaux
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:class|function)\s+(\w+)/);
    if (exportMatches && exportMatches[1]) {
      return exportMatches[1];
    }

    // Extraction depuis le nom de fichier
    const fileName = filePath.split('/').pop() || filePath;
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}
