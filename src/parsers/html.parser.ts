import { ParserInterface } from '../interfaces/chunker.interface';
import { 
  DocumentSection, 
  CodeBlock, 
  DocumentLink, 
  ParseOptions,
  ParserResult
} from '../types/indexation.types';
import crypto from 'crypto';

export class HTMLParser implements ParserInterface {
  async parse(content: string, options: ParseOptions): Promise<ParserResult> {
    const sections: DocumentSection[] = [];
    const codeBlocks: CodeBlock[] = [];
    const links: DocumentLink[] = [];

    // Extraction du titre
    const title = this.extractTitle(content, options.filePath);

    // Extraction des sections principales (headers)
    const headerMatches = content.matchAll(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi);
    let position = 0;

    for (const match of headerMatches) {
      const level = parseInt(match[1]);
      const headerContent = match[2];
      const startPos = match.index || 0;
      const endPos = startPos + match[0].length;

      // Nettoyage du contenu du header
      const cleanTitle = this.cleanHTMLContent(headerContent);

      const section: DocumentSection = {
        id: crypto.randomUUID(),
        level,
        title: cleanTitle,
        content: headerContent,
        startPosition: startPos,
        endPosition: endPos,
        subsections: [],
        metadata: {
          wordCount: this.countWords(cleanTitle),
          hasCode: /<code|<pre/.test(headerContent),
          hasLinks: /<a\s+href/.test(headerContent),
          estimatedReadingTime: Math.ceil(this.countWords(cleanTitle) / 200)
        }
      };

      sections.push(section);
    }

    // Extraction des blocs de code
    const codeMatches = content.matchAll(/<(?:code|pre)[^>]*>(.*?)<\/(?:code|pre)>/gis);
    for (const match of codeMatches) {
      const code = match[1];
      const startPos = match.index || 0;
      const endPos = startPos + match[0].length;
      const language = this.detectCodeLanguage(code);

      const codeBlock: CodeBlock = {
        id: crypto.randomUUID(),
        language,
        code: this.cleanHTMLContent(code),
        context: this.extractCodeContext(content, startPos),
        position: {
          start: startPos,
          end: endPos
        },
        metadata: {
          lineCount: code.split('\n').length,
          complexity: this.assessCodeComplexity(code),
          imports: this.extractImports(code),
          exports: this.extractExports(code),
          functions: this.extractFunctions(code),
          classes: this.extractClasses(code)
        }
      };

      codeBlocks.push(codeBlock);
    }

    // Extraction des liens
    const linkMatches = content.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
    for (const match of linkMatches) {
      const url = match[1] || '';
      const text = match[2] || '';
      const startPos = match.index || 0;
      const endPos = startPos + match[0].length;

      const link: DocumentLink = {
        id: crypto.randomUUID(),
        url,
        text: this.cleanHTMLContent(text),
        type: url.startsWith('#') ? 'anchor' : url.startsWith('http') ? 'external' : 'internal',
        position: {
          start: startPos,
          end: endPos
        }
      };

      if (url.startsWith('#')) {
        link.target = url.substring(1);
      }

      links.push(link);
    }

    return {
      title,
      type: this.inferDocumentType(options.filePath),
      format: 'html',
      metadata: {
        language: 'html',
        encoding: options.encoding || 'utf-8',
        size: content.length,
        lastModified: options.lastModified,
        sections,
        codeBlocks,
        links
      },
      content: this.cleanHTMLContent(content),
      rawContent: content
    };
  }

  private extractTitle(content: string, filePath: string): string {
    // Recherche du titre dans les balises <title>
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return this.cleanHTMLContent(titleMatch[1]);
    }

    // Recherche du premier header H1
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return this.cleanHTMLContent(h1Match[1]);
    }

    // Extraction depuis le nom de fichier
    const fileName = filePath.split('/').pop() || filePath;
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private cleanHTMLContent(content: string): string {
    return content
      // Suppression des balises HTML
      .replace(/<[^>]*>/g, '')
      // Décodage des entités HTML courantes
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Suppression des espaces multiples
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectCodeLanguage(code: string): string {
    // Détection basique du langage
    if (code.includes('function') || code.includes('const') || code.includes('let')) {
      return code.includes(':') && code.includes('interface') ? 'typescript' : 'javascript';
    }
    if (code.includes('def ') || code.includes('import ')) return 'python';
    if (code.includes('class ') && code.includes('public:')) return 'cpp';
    if (code.includes('public class')) return 'java';
    if (code.includes('<?php')) return 'php';
    if (code.includes('<%') || code.includes('%>')) return 'asp';
    return 'text';
  }

  private extractCodeContext(content: string, position: number): string {
    const before = content.substring(Math.max(0, position - 200), position);
    const after = content.substring(position + 1, Math.min(content.length, position + 200));
    
    return this.cleanHTMLContent(before + ' ... ' + after);
  }

  private assessCodeComplexity(code: string): 'simple' | 'medium' | 'complex' {
    const lines = code.split('\n').length;
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    
    if (lines > 50 || cyclomaticComplexity > 10) return 'complex';
    if (lines > 20 || cyclomaticComplexity > 5) return 'medium';
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

  private extractImports(code: string): string[] {
    const importRegex = /(?:import|require)\s+['"`]([^'"`]+)['"`]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
    
    return [...new Set(imports)];
  }

  private extractExports(code: string): string[] {
    const exportRegex = /(?:export|module\.exports)\s+(?:\{([^}]+)\}|(\w+))/g;
    const exports: string[] = [];
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      if (match[1]) {
        const names = match[1].split(',').map(name => name.trim().split(' as ')[0]).filter(Boolean);
        exports.push(...names);
      } else if (match[2]) {
        exports.push(match[2]);
      }
    }
    
    return [...new Set(exports)];
  }

  private extractFunctions(code: string): string[] {
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
    const functions: string[] = [];
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
    const classRegex = /(?:class)\s+(\w+)/g;
    const classes: string[] = [];
    let match;
    
    while ((match = classRegex.exec(code)) !== null) {
      if (match[1]) {
        classes.push(match[1]);
      }
    }
    
    return [...new Set(classes)];
  }

  private inferDocumentType(filePath: string): ParserResult['type'] {
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('readme')) return 'readme';
    if (fileName.includes('example') || fileName.includes('demo')) return 'example';
    if (fileName.includes('guide') || fileName.includes('tutorial')) return 'guide';
    if (fileName.includes('api')) return 'api';
    
    return 'reference';
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}
