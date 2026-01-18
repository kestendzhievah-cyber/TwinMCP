import crypto from 'crypto';
import { LLMService } from '../llm.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata: any;
  relevanceScore: number;
  tokens: number;
}

interface AssemblyOptions {
  format?: 'markdown' | 'xml' | 'json';
  compress?: boolean;
  targetTokens?: number;
}

interface AssembledContext {
  content: string;
  items: ContextItem[];
  tokens: number;
  metadata: {
    itemCount: number;
    compressionRatio: number;
  };
}

export class ContextAssemblyService {
  private llmService: LLMService;
  private db: Pool;
  private redis: Redis;
  
  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.llmService = new LLMService(db, redis);
  }
  
  async assemble(
    items: ContextItem[],
    query: string,
    options: AssemblyOptions = {}
  ): Promise<AssembledContext> {
    const deduplicated = this.deduplicate(items);
    
    const grouped = this.groupItems(deduplicated);
    
    const formatted = this.formatForLLM(grouped, options.format);
    
    const withMetadata = this.addMetadata(formatted, query);
    
    const final = options.compress 
      ? await this.compress(withMetadata, options.targetTokens || 4000)
      : withMetadata;
    
    return {
      content: final,
      items: deduplicated,
      tokens: this.estimateTokens(final),
      metadata: {
        itemCount: deduplicated.length,
        compressionRatio: options.compress 
          ? this.estimateTokens(formatted) / this.estimateTokens(final)
          : 1
      }
    };
  }
  
  private deduplicate(items: ContextItem[]): ContextItem[] {
    const seen = new Set<string>();
    const unique: ContextItem[] = [];
    
    for (const item of items) {
      const hash = this.contentHash(item.content);
      
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(item);
      } else {
        const existing = unique.find(i => this.contentHash(i.content) === hash);
        if (existing) {
          existing.metadata = {
            ...existing.metadata,
            ...item.metadata,
            sources: [
              ...(existing.metadata.sources || []),
              ...(item.metadata.sources || [])
            ]
          };
        }
      }
    }
    
    return unique;
  }
  
  private groupItems(items: ContextItem[]): Map<string, ContextItem[]> {
    const grouped = new Map<string, ContextItem[]>();
    
    for (const item of items) {
      const existing = grouped.get(item.type) || [];
      existing.push(item);
      grouped.set(item.type, existing);
    }
    
    return grouped;
  }
  
  private formatForLLM(
    grouped: Map<string, ContextItem[]>,
    format: 'markdown' | 'xml' | 'json' = 'markdown'
  ): string {
    if (format === 'markdown') {
      return this.formatAsMarkdown(grouped);
    } else if (format === 'xml') {
      return this.formatAsXML(grouped);
    } else {
      return JSON.stringify(Array.from(grouped.entries()), null, 2);
    }
  }
  
  private formatAsMarkdown(grouped: Map<string, ContextItem[]>): string {
    let output = '# Context\n\n';
    
    for (const [type, items] of grouped) {
      output += `## ${this.formatTypeName(type)}\n\n`;
      
      for (const item of items) {
        output += `### ${item.metadata.title || 'Untitled'}\n\n`;
        output += `${item.content}\n\n`;
        
        if (item.metadata.source) {
          output += `*Source: ${item.metadata.source}*\n\n`;
        }
        
        output += '---\n\n';
      }
    }
    
    return output;
  }
  
  private formatAsXML(grouped: Map<string, ContextItem[]>): string {
    let output = '<context>\n';
    
    for (const [type, items] of grouped) {
      output += `  <${type}>\n`;
      
      for (const item of items) {
        output += `    <item id="${item.id}">\n`;
        output += `      <content>${this.escapeXML(item.content)}</content>\n`;
        output += `      <metadata>${JSON.stringify(item.metadata)}</metadata>\n`;
        output += `    </item>\n`;
      }
      
      output += `  </${type}>\n`;
    }
    
    output += '</context>';
    return output;
  }
  
  private formatTypeName(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  
  private addMetadata(content: string, query: string): string {
    const metadata = `Query: ${query}\nGenerated: ${new Date().toISOString()}\n\n`;
    return metadata + content;
  }
  
  private async compress(
    content: string,
    targetTokens: number
  ): Promise<string> {
    const currentTokens = this.estimateTokens(content);
    
    if (currentTokens <= targetTokens) {
      return content;
    }
    
    const response = await this.llmService.generateResponse({
      id: crypto.randomUUID(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Compress the following context while preserving all key information.
Target: ~${targetTokens} tokens (currently ${currentTokens} tokens).
Maintain structure and important details.`
      }, {
        role: 'user',
        content
      }],
      options: { temperature: 0.3, maxTokens: targetTokens },
      metadata: {}
    });
    
    return response.content || content;
  }
  
  private contentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
