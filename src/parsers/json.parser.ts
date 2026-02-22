import { logger } from '../utils/logger';
import { ParserInterface } from '../interfaces/chunker.interface';
import { 
  DocumentSection, 
  CodeBlock, 
  DocumentLink, 
  ParseOptions,
  ParserResult
} from '../types/indexation.types';
import crypto from 'crypto';

export class JSONParser implements ParserInterface {
  async parse(content: string, options: ParseOptions): Promise<ParserResult> {
    const sections: DocumentSection[] = [];
    const codeBlocks: CodeBlock[] = [];
    const links: DocumentLink[] = [];

    let parsedContent: any = {};
    let isValidJSON = true;

    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      isValidJSON = false;
      logger.error('Invalid JSON content:', error);
    }

    if (isValidJSON && parsedContent) {
      // Création de sections basées sur la structure JSON
      this.createSectionsFromObject(parsedContent, sections, '', 0);
    }

    // Création du bloc de code principal
    const mainCodeBlock: CodeBlock = {
      id: crypto.randomUUID(),
      language: 'json',
      code: content,
      context: 'JSON configuration file',
      position: {
        start: 0,
        end: content.length
      },
      metadata: {
        lineCount: content.split('\n').length,
        complexity: this.assessJSONComplexity(parsedContent),
        imports: [],
        exports: [],
        functions: [],
        classes: []
      }
    };
    codeBlocks.push(mainCodeBlock);

    return {
      title: this.extractTitle(content, options.filePath, parsedContent),
      type: this.inferDocumentType(options.filePath),
      format: 'json',
      metadata: {
        language: 'json',
        encoding: options.encoding || 'utf-8',
        size: content.length,
        lastModified: options.lastModified,
        sections,
        codeBlocks,
        links
      },
      content: this.cleanJSONContent(content),
      rawContent: content
    };
  }

  private createSectionsFromObject(obj: any, sections: DocumentSection[], parentKey: string, level: number): void {
    if (level > 5) return; // Limite de profondeur

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        const section: DocumentSection = {
          id: crypto.randomUUID(),
          level: level + 1,
          title: key,
          content: JSON.stringify(value, null, 2),
          startPosition: 0,
          endPosition: 0,
          subsections: [],
          metadata: {
            wordCount: this.countWords(JSON.stringify(value)),
            hasCode: typeof value === 'object',
            hasLinks: false,
            estimatedReadingTime: Math.ceil(this.countWords(JSON.stringify(value)) / 200)
          }
        };

        sections.push(section);

        // Récursion pour les objets imbriqués
        if (typeof value === 'object' && value !== null) {
          this.createSectionsFromObject(value, sections, fullKey, level + 1);
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const section: DocumentSection = {
          id: crypto.randomUUID(),
          level: level + 1,
          title: `Item ${index + 1}`,
          content: JSON.stringify(item, null, 2),
          startPosition: 0,
          endPosition: 0,
          subsections: [],
          metadata: {
            wordCount: this.countWords(JSON.stringify(item)),
            hasCode: typeof item === 'object',
            hasLinks: false,
            estimatedReadingTime: Math.ceil(this.countWords(JSON.stringify(item)) / 200)
          }
        };

        sections.push(section);

        // Récursion pour les objets dans le tableau
        if (typeof item === 'object' && item !== null) {
          this.createSectionsFromObject(item, sections, `${parentKey}[${index}]`, level + 1);
        }
      });
    }
  }

  private assessJSONComplexity(obj: any): 'simple' | 'medium' | 'complex' {
    const depth = this.getObjectDepth(obj);
    const propertyCount = this.countProperties(obj);
    
    if (depth > 5 || propertyCount > 50) return 'complex';
    if (depth > 3 || propertyCount > 20) return 'medium';
    return 'simple';
  }

  private getObjectDepth(obj: any, currentDepth = 0): number {
    if (typeof obj !== 'object' || obj === null) return currentDepth;
    
    if (Array.isArray(obj)) {
      return Math.max(...obj.map(item => this.getObjectDepth(item, currentDepth + 1)));
    }
    
    const depths = Object.values(obj).map(value => 
      this.getObjectDepth(value, currentDepth + 1)
    );
    
    return depths.length > 0 ? Math.max(...depths) : currentDepth;
  }

  private countProperties(obj: any): number {
    if (typeof obj !== 'object' || obj === null) return 0;
    
    if (Array.isArray(obj)) {
      return obj.reduce((count, item) => count + this.countProperties(item), 0);
    }
    
    return Object.keys(obj).length + 
           Object.values(obj).reduce((count: number, value: unknown) => count + this.countProperties(value), 0);
  }

  private extractTitle(content: string, filePath: string, parsedContent: any): string {
    // Recherche du titre dans le contenu JSON
    if (parsedContent && typeof parsedContent === 'object') {
      const titleKeys = ['name', 'title', 'description', 'label', 'displayName'];
      for (const key of titleKeys) {
        if (parsedContent[key] && typeof parsedContent[key] === 'string') {
          return parsedContent[key];
        }
      }
    }

    // Extraction depuis le nom de fichier
    const fileName = filePath.split('/').pop() || filePath;
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private cleanJSONContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  private inferDocumentType(filePath: string): ParserResult['type'] {
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('package')) return 'reference';
    if (fileName.includes('config') || fileName.includes('settings')) return 'reference';
    if (fileName.includes('schema')) return 'reference';
    if (fileName.includes('example') || fileName.includes('demo')) return 'example';
    if (fileName.includes('api')) return 'api';
    
    return 'reference';
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}
