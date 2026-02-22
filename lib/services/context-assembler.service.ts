import { DocumentResult } from './vector-search.service'
import { logger } from '@/lib/logger'

export interface AssembledContext {
  context: string
  metadata: {
    query: string
    total_documents: number
    included_documents: number
    library?: string
    version?: string
  }
  totalTokens: number
  truncated: boolean
}

export class ContextAssembler {
  private encoder: any

  constructor() {
    // Initialize tiktoken encoder
    this.initEncoder()
  }

  private async initEncoder() {
    try {
      // Dynamic import to avoid bundling issues
      const tiktokenModule = await import('tiktoken')
      this.encoder = tiktokenModule.get_encoding('cl100k_base')
    } catch (error) {
      logger.warn('Failed to initialize tiktoken, using fallback token counting')
      this.encoder = null
    }
  }

  assembleContext(
    documents: DocumentResult[], 
    query: string,
    maxTokens: number = 4000
  ): AssembledContext {
    let context = `# Documentation Query Results\n\n`
    context += `**Query**: ${query}\n\n`
    
    let currentTokens = this.countTokens(context)
    const results: DocumentResult[] = []
    
    for (const doc of documents) {
      const section = this.formatDocumentSection(doc)
      const sectionTokens = this.countTokens(section)
      
      if (currentTokens + sectionTokens > maxTokens) {
        break
      }
      
      context += section
      currentTokens += sectionTokens
      
      results.push(doc)
    }
    
    return {
      context,
      metadata: {
        query,
        total_documents: documents.length,
        included_documents: results.length,
        ...(documents[0]?.metadata?.source?.split('-')[0] && { 
          library: documents[0].metadata.source.split('-')[0] 
        }),
        ...(documents[0]?.metadata?.url?.match(/\/v?(\d+\.\d+)/)?.[1] && { 
          version: documents[0].metadata.url.match(/\/v?(\d+\.\d+)/)![1] 
        })
      },
      totalTokens: currentTokens,
      truncated: results.length < documents.length
    }
  }

  private formatDocumentSection(doc: DocumentResult): string {
    const meta = doc.metadata
    let section = ''
    
    if (meta.type === 'code') {
      section += `## Code Example\n`
    } else if (meta.type === 'example') {
      section += `## Example\n`
    } else {
      section += `## ${meta.section || 'Documentation'}\n`
    }
    
    section += `**Source**: ${meta.url}\n`
    section += `**Relevance**: ${(meta.relevanceScore * 100).toFixed(1)}%\n\n`
    section += `${doc.content}\n\n`
    section += `---\n\n`
    
    return section
  }

  private countTokens(text: string): number {
    if (this.encoder) {
      try {
        const tokens = this.encoder.encode(text)
        return tokens.length
      } catch (error) {
        logger.warn('Token counting failed, using fallback')
      }
    }
    
    // Fallback: rough estimation (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4)
  }

  // Cleanup method to free encoder resources
  cleanup(): void {
    if (this.encoder && this.encoder.free) {
      this.encoder.free()
    }
  }
}
