# E6-Story6-3-Indexation-Documentation.md

## Epic 6: Crawling Service

### Story 6.3: Indexation de la documentation

**Description**: Parsing et découpage intelligent de la documentation

---

## Objectif

Développer un service d'indexation intelligent qui parse, découpe et structure la documentation des bibliothèques en chunks optimisés pour la recherche vectorielle et le traitement par LLM.

---

## Prérequis

- Service de téléchargement (Story 6.2) opérationnel
- Service de génération d'embeddings (Story 5.1) disponible
- Stockage vectoriel (Story 5.2) configuré
- Parseurs pour différents formats de fichiers

---

## Spécifications Techniques

### 1. Architecture d'Indexation

#### 1.1 Types et Interfaces

```typescript
// src/types/indexation.types.ts
export interface DocumentIndexer {
  id: string;
  name: string;
  supportedFormats: string[];
  priority: number;
  config: IndexerConfig;
}

export interface IndexerConfig {
  maxChunkSize: number;
  overlapSize: number;
  minChunkSize: number;
  preserveStructure: boolean;
  includeCodeBlocks: boolean;
  includeMetadata: boolean;
  chunkingStrategy: 'semantic' | 'fixed' | 'hierarchical' | 'mixed';
}

export interface ParsedDocument {
  id: string;
  libraryId: string;
  sourcePath: string;
  title: string;
  type: 'readme' | 'api' | 'guide' | 'example' | 'reference' | 'changelog' | 'license';
  format: 'markdown' | 'html' | 'json' | 'typescript' | 'javascript' | 'other';
  metadata: {
    language: string;
    encoding: string;
    size: number;
    lastModified: Date;
    sections: DocumentSection[];
    codeBlocks: CodeBlock[];
    links: DocumentLink[];
    toc?: TableOfContents;
  };
  content: string;
  rawContent: string;
  chunks: DocumentChunk[];
  createdAt: Date;
  processedAt: Date;
}

export interface DocumentSection {
  id: string;
  level: number; // 1-6 pour headers
  title: string;
  content: string;
  startPosition: number;
  endPosition: number;
  subsections: DocumentSection[];
  metadata: {
    wordCount: number;
    hasCode: boolean;
    hasLinks: boolean;
    estimatedReadingTime: number;
  };
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  explanation?: string;
  context: string;
  position: {
    start: number;
    end: number;
  };
  metadata: {
    lineCount: number;
    complexity: 'simple' | 'medium' | 'complex';
    imports: string[];
    exports: string[];
    functions: string[];
    classes: string[];
  };
}

export interface DocumentLink {
  id: string;
  url: string;
  text: string;
  type: 'internal' | 'external' | 'anchor';
  target?: string;
  position: {
    start: number;
    end: number;
  };
}

export interface TableOfContents {
  entries: TOCEntry[];
  maxDepth: number;
}

export interface TOCEntry {
  id: string;
  level: number;
  title: string;
  anchor: string;
  children: TOCEntry[];
  position: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  type: 'text' | 'code' | 'mixed' | 'metadata';
  position: {
    start: number;
    end: number;
    index: number;
    total: number;
  };
  metadata: {
    wordCount: number;
    sectionTitle?: string;
    sectionLevel?: number;
    hasCode: boolean;
    hasLinks: boolean;
    language?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    tags: string[];
  };
  context: {
    previousChunk?: string;
    nextChunk?: string;
    sectionContext?: string;
    documentTitle: string;
    documentType: string;
  };
  embedding?: number[];
  embeddingModel?: string;
  createdAt: Date;
}

export interface IndexingTask {
  id: string;
  libraryId: string;
  sourcePath: string;
  status: 'pending' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'failed';
  progress: {
    phase: string;
    completed: number;
    total: number;
    percentage: number;
    currentFile: string;
  };
  config: IndexerConfig;
  results: {
    documentsParsed: number;
    chunksCreated: number;
    embeddingsGenerated: number;
    errors: string[];
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface IndexingStats {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  averageChunkSize: number;
  processingTime: number;
  errorRate: number;
  formatDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}
```

#### 1.2 Configuration des Indexers

```typescript
// src/config/indexation.config.ts
export const INDEXATION_CONFIG = {
  default: {
    maxChunkSize: 1000,
    overlapSize: 100,
    minChunkSize: 200,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'semantic'
  },
  markdown: {
    maxChunkSize: 1500,
    overlapSize: 150,
    minChunkSize: 300,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'hierarchical'
  },
  code: {
    maxChunkSize: 800,
    overlapSize: 50,
    minChunkSize: 100,
    preserveStructure: false,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'semantic'
  },
  api: {
    maxChunkSize: 600,
    overlapSize: 100,
    minChunkSize: 150,
    preserveStructure: true,
    includeCodeBlocks: true,
    includeMetadata: true,
    chunkingStrategy: 'mixed'
  }
};

export const PARSER_REGISTRY: Record<string, DocumentIndexer> = {
  markdown: {
    id: 'markdown-parser',
    name: 'Markdown Parser',
    supportedFormats: ['.md', '.markdown'],
    priority: 1,
    config: INDEXATION_CONFIG.markdown
  },
  typescript: {
    id: 'typescript-parser',
    name: 'TypeScript Parser',
    supportedFormats: ['.ts', '.tsx'],
    priority: 2,
    config: INDEXATION_CONFIG.code
  },
  javascript: {
    id: 'javascript-parser',
    name: 'JavaScript Parser',
    supportedFormats: ['.js', '.jsx'],
    priority: 2,
    config: INDEXATION_CONFIG.code
  },
  html: {
    id: 'html-parser',
    name: 'HTML Parser',
    supportedFormats: ['.html', '.htm'],
    priority: 3,
    config: INDEXATION_CONFIG.default
  },
  json: {
    id: 'json-parser',
    name: 'JSON Parser',
    supportedFormats: ['.json'],
    priority: 4,
    config: INDEXATION_CONFIG.default
  }
};
```

### 2. Service d'Indexation Principal

#### 2.1 Document Indexation Service

```typescript
// src/services/document-indexation.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  ParsedDocument,
  DocumentChunk,
  IndexingTask,
  IndexingStats,
  DocumentIndexer,
  IndexerConfig
} from '../types/indexation.types';
import { MarkdownParser } from '../parsers/markdown.parser';
import { TypeScriptParser } from '../parsers/typescript.parser';
import { JavaScriptParser } from '../parsers/javascript.parser';
import { HTMLParser } from '../parsers/html.parser';
import { JSONParser } from '../parsers/json.parser';
import { EmbeddingGenerationService } from './embedding-generation.service';

export class DocumentIndexationService {
  private parsers: Map<string, any> = new Map();
  private activeTasks: Map<string, IndexingTask> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private embeddingService: EmbeddingGenerationService
  ) {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    this.parsers.set('markdown', new MarkdownParser());
    this.parsers.set('typescript', new TypeScriptParser());
    this.parsers.set('javascript', new JavaScriptParser());
    this.parsers.set('html', new HTMLParser());
    this.parsers.set('json', new JSONParser());
  }

  async startIndexing(libraryId: string, sourcePath: string, config?: Partial<IndexerConfig>): Promise<string> {
    const taskId = crypto.randomUUID();
    
    const task: IndexingTask = {
      id: taskId,
      libraryId,
      sourcePath,
      status: 'pending',
      progress: {
        phase: 'initialization',
        completed: 0,
        total: 0,
        percentage: 0,
        currentFile: ''
      },
      config: { ...INDEXATION_CONFIG.default, ...config },
      results: {
        documentsParsed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        errors: []
      },
      createdAt: new Date()
    };

    // Sauvegarde de la tâche
    await this.saveIndexingTask(task);
    this.activeTasks.set(taskId, task);

    // Démarrage du traitement
    this.processIndexingTask(task).catch(error => {
      console.error(`Indexing task ${taskId} failed:`, error);
      this.handleTaskError(task, error);
    });

    return taskId;
  }

  async getIndexingStatus(taskId: string): Promise<IndexingTask | null> {
    // Vérification dans la mémoire active
    if (this.activeTasks.has(taskId)) {
      return this.activeTasks.get(taskId)!;
    }

    // Recherche en base
    const result = await this.db.query(
      'SELECT * FROM indexing_tasks WHERE id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  }

  private async processIndexingTask(task: IndexingTask): Promise<void> {
    try {
      task.status = 'parsing';
      task.startedAt = new Date();
      await this.updateTaskStatus(task);

      // 1. Découverte des fichiers
      const files = await this.discoverDocuments(task.sourcePath);
      task.progress.total = files.length;
      await this.updateTaskProgress(task, 'discovery', 0, files.length);

      // 2. Parsing des documents
      const documents: ParsedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        task.progress.currentFile = file;
        task.progress.completed = i;
        task.progress.percentage = Math.round((i / files.length) * 100);

        try {
          const document = await this.parseDocument(file, task.libraryId);
          if (document) {
            documents.push(document);
            task.results.documentsParsed++;
          }
        } catch (error) {
          const errorMsg = `Error parsing ${file}: ${error.message}`;
          task.results.errors.push(errorMsg);
          console.error(errorMsg);
        }

        await this.updateTaskProgress(task, 'parsing', i + 1, files.length);
      }

      // 3. Chunking
      task.status = 'chunking';
      task.progress.phase = 'chunking';
      task.progress.completed = 0;
      task.progress.total = documents.length;

      const allChunks: DocumentChunk[] = [];
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        const chunks = await this.chunkDocument(document, task.config);
        allChunks.push(...chunks);
        task.results.chunksCreated += chunks.length;

        task.progress.completed = i + 1;
        task.progress.percentage = Math.round((i / documents.length) * 100);
        await this.updateTaskProgress(task, 'chunking', i + 1, documents.length);
      }

      // 4. Génération des embeddings
      task.status = 'embedding';
      task.progress.phase = 'embedding';
      task.progress.completed = 0;
      task.progress.total = allChunks.length;

      const batchSize = 100;
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        
        try {
          const embeddingResults = await this.embeddingService.generateEmbeddings({
            chunks: batch.map(chunk => ({
              id: chunk.id,
              content: chunk.content,
              metadata: {
                url: '',
                title: chunk.context.documentTitle,
                contentType: chunk.type,
                position: chunk.position.index,
                totalChunks: chunk.position.total,
                lastModified: new Date()
              }
            }))
          });

          // Association des embeddings aux chunks
          embeddingResults.forEach((result, index) => {
            batch[index].embedding = result.embedding;
            batch[index].embeddingModel = result.model;
          });

          task.results.embeddingsGenerated += embeddingResults.length;
        } catch (error) {
          const errorMsg = `Error generating embeddings for batch ${i / batchSize + 1}: ${error.message}`;
          task.results.errors.push(errorMsg);
          console.error(errorMsg);
        }

        task.progress.completed = Math.min(i + batchSize, allChunks.length);
        task.progress.percentage = Math.round((task.progress.completed / allChunks.length) * 100);
        await this.updateTaskProgress(task, 'embedding', task.progress.completed, allChunks.length);
      }

      // 5. Stockage des résultats
      await this.storeIndexingResults(task.libraryId, documents, allChunks);

      // 6. Finalisation
      task.status = 'completed';
      task.completedAt = new Date();
      task.progress.percentage = 100;
      await this.updateTaskStatus(task);

      console.log(`Indexing completed for task ${task.id}: ${task.results.documentsParsed} documents, ${task.results.chunksCreated} chunks`);

    } catch (error) {
      await this.handleTaskError(task, error);
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private async discoverDocuments(sourcePath: string): Promise<string[]> {
    const documents: string[] = [];
    const supportedExtensions = Object.values(PARSER_REGISTRY)
      .flatMap(parser => parser.supportedFormats);

    const scanDirectory = async (dirPath: string, depth = 0): Promise<void> => {
      if (depth > 10) return; // Limite de profondeur

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            
            if (supportedExtensions.includes(ext)) {
              // Filtres supplémentaires
              if (!this.shouldExcludeFile(fullPath)) {
                documents.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
      }
    };

    await scanDirectory(sourcePath);
    return documents.sort();
  }

  private shouldExcludeFile(filePath: string): boolean {
    const excludePatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.cache/,
      /tmp/,
      /temp/
    ];

    return excludePatterns.some(pattern => pattern.test(filePath));
  }

  private async parseDocument(filePath: string, libraryId: string): Promise<ParsedDocument | null> {
    const ext = path.extname(filePath).toLowerCase();
    const parser = this.getParserForExtension(ext);

    if (!parser) {
      console.warn(`No parser found for file: ${filePath}`);
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const parsed = await parser.parse(content, {
        filePath,
        libraryId,
        lastModified: stats.mtime
      });

      return {
        ...parsed,
        id: crypto.randomUUID(),
        sourcePath: filePath,
        createdAt: new Date(),
        processedAt: new Date()
      };

    } catch (error) {
      console.error(`Error parsing document ${filePath}:`, error);
      return null;
    }
  }

  private getParserForExtension(ext: string): any {
    for (const [format, parser] of Object.entries(PARSER_REGISTRY)) {
      if (parser.supportedFormats.includes(ext)) {
        return this.parsers.get(format);
      }
    }
    return null;
  }

  private async chunkDocument(document: ParsedDocument, config: IndexerConfig): Promise<DocumentChunk[]> {
    const chunker = this.getChunker(config.chunkingStrategy);
    return await chunker.chunk(document, config);
  }

  private getChunker(strategy: string): DocumentChunker {
    switch (strategy) {
      case 'semantic':
        return new SemanticChunker();
      case 'fixed':
        return new FixedSizeChunker();
      case 'hierarchical':
        return new HierarchicalChunker();
      case 'mixed':
        return new MixedChunker();
      default:
        return new SemanticChunker();
    }
  }

  private async storeIndexingResults(
    libraryId: string, 
    documents: ParsedDocument[], 
    chunks: DocumentChunk[]
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Stockage des documents
      for (const document of documents) {
        await client.query(`
          INSERT INTO parsed_documents (
            id, library_id, source_path, title, type, format,
            metadata, content, raw_content, created_at, processed_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            processed_at = EXCLUDED.processed_at
        `, [
          document.id,
          libraryId,
          document.sourcePath,
          document.title,
          document.type,
          document.format,
          JSON.stringify(document.metadata),
          document.content,
          document.rawContent,
          document.createdAt,
          document.processedAt
        ]);
      }

      // Stockage des chunks avec embeddings
      for (const chunk of chunks) {
        await client.query(`
          INSERT INTO document_chunks (
            id, document_id, content, type, position, metadata,
            context, embedding, embedding_model, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model
        `, [
          chunk.id,
          chunk.documentId,
          chunk.content,
          chunk.type,
          JSON.stringify(chunk.position),
          JSON.stringify(chunk.metadata),
          JSON.stringify(chunk.context),
          chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
          chunk.embeddingModel,
          chunk.createdAt
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async saveIndexingTask(task: IndexingTask): Promise<void> {
    await this.db.query(`
      INSERT INTO indexing_tasks (
        id, library_id, source_path, status, progress,
        config, results, created_at, started_at, completed_at, error
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        results = EXCLUDED.results,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        error = EXCLUDED.error
    `, [
      task.id,
      task.libraryId,
      task.sourcePath,
      task.status,
      JSON.stringify(task.progress),
      JSON.stringify(task.config),
      JSON.stringify(task.results),
      task.createdAt,
      task.startedAt,
      task.completedAt,
      task.error
    ]);
  }

  private async updateTaskStatus(task: IndexingTask): Promise<void> {
    await this.db.query(`
      UPDATE indexing_tasks 
      SET status = $1, progress = $2, started_at = $3, completed_at = $4, error = $5
      WHERE id = $6
    `, [
      task.status,
      JSON.stringify(task.progress),
      task.startedAt,
      task.completedAt,
      task.error,
      task.id
    ]);
  }

  private async updateTaskProgress(task: IndexingTask, phase: string, completed: number, total: number): Promise<void> {
    task.progress.phase = phase;
    task.progress.completed = completed;
    task.progress.total = total;
    task.progress.percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    await this.db.query(`
      UPDATE indexing_tasks 
      SET progress = $1
      WHERE id = $2
    `, [JSON.stringify(task.progress), task.id]);
  }

  private async handleTaskError(task: IndexingTask, error: Error): Promise<void> {
    task.status = 'failed';
    task.error = error.message;
    task.completedAt = new Date();
    
    await this.updateTaskStatus(task);
    console.error(`Indexing task ${task.id} failed:`, error);
  }

  async getIndexingStats(libraryId?: string): Promise<IndexingStats> {
    const whereClause = libraryId ? 'WHERE library_id = $1' : '';
    const params = libraryId ? [libraryId] : [];

    const result = await this.db.query(`
      SELECT 
        COUNT(DISTINCT pd.id) as total_documents,
        COUNT(DISTINCT dc.id) as total_chunks,
        COUNT(DISTINCT CASE WHEN dc.embedding IS NOT NULL THEN dc.id END) as total_embeddings,
        AVG(LENGTH(dc.content)) as avg_chunk_size,
        AVG(EXTRACT(EPOCH FROM (it.completed_at - it.started_at))) as avg_processing_time,
        COUNT(CASE WHEN it.status = 'failed' THEN 1 END)::float / COUNT(*) as error_rate
      FROM indexing_tasks it
      LEFT JOIN parsed_documents pd ON it.library_id = pd.library_id
      LEFT JOIN document_chunks dc ON pd.id = dc.document_id
      ${whereClause}
    `, params);

    const stats = result.rows[0];

    // Distribution par format et type
    const [formatResult, typeResult] = await Promise.all([
      this.db.query(`
        SELECT pd.format, COUNT(*) as count
        FROM parsed_documents pd
        ${libraryId ? 'WHERE pd.library_id = $1' : ''}
        GROUP BY pd.format
      `, params),
      this.db.query(`
        SELECT pd.type, COUNT(*) as count
        FROM parsed_documents pd
        ${libraryId ? 'WHERE pd.library_id = $1' : ''}
        GROUP BY pd.type
      `, params)
    ]);

    const formatDistribution = formatResult.rows.reduce((acc, row) => {
      acc[row.format] = parseInt(row.count);
      return acc;
    }, {});

    const typeDistribution = typeResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    return {
      totalDocuments: parseInt(stats.total_documents) || 0,
      totalChunks: parseInt(stats.total_chunks) || 0,
      totalEmbeddings: parseInt(stats.total_embeddings) || 0,
      averageChunkSize: Math.round(parseFloat(stats.avg_chunk_size)) || 0,
      processingTime: parseFloat(stats.avg_processing_time) || 0,
      errorRate: parseFloat(stats.error_rate) || 0,
      formatDistribution,
      typeDistribution
    };
  }
}
```

### 3. Stratégies de Chunking

#### 3.1 Semantic Chunker

```typescript
// src/chunkers/semantic.chunker.ts
import { DocumentChunker } from '../interfaces/chunker.interface';
import { ParsedDocument, DocumentChunk, IndexerConfig } from '../types/indexation.types';

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
    const sections = [];
    
    // Identification basée sur les patterns markdown et la structure
    const lines = content.split('\n');
    let currentSection = {
      title: '',
      content: '',
      startPosition: 0,
      endPosition: 0,
      type: 'explanation' as const
    };
    
    let position = 0;

    for (const line of lines) {
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
    return match ? match[1].length : 1;
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
```

---

## Tâches Détaillées

### 1. Service d'Indexation
- [ ] Implémenter DocumentIndexationService
- [ ] Créer le système de découverte de fichiers
- [ ] Développer le parsing multi-formats
- [ ] Ajouter la gestion des erreurs

### 2. Parseurs Spécialisés
- [ ] Développer MarkdownParser
- [ ] Implémenter TypeScriptParser
- [ ] Ajouter JavaScriptParser
- [ ] Créer HTMLParser et JSONParser

### 3. Stratégies de Chunking
- [ ] Implémenter SemanticChunker
- [ ] Développer FixedSizeChunker
- [ ] Ajouter HierarchicalChunker
- [ ] Créer MixedChunker

### 4. Stockage et Performance
- [ ] Optimiser le stockage des chunks
- [ ] Implémenter le traitement par batch
- [ ] Ajouter le monitoring des performances
- [ ] Créer les statistiques d'indexation

---

## Validation

### Tests d'Indexation

```typescript
// __tests__/document-indexation.service.test.ts
describe('DocumentIndexationService', () => {
  let service: DocumentIndexationService;

  beforeEach(() => {
    service = new DocumentIndexationService(
      mockDb,
      mockRedis,
      mockEmbeddingService
    );
  });

  describe('startIndexing', () => {
    it('should create and start indexing task', async () => {
      const taskId = await service.startIndexing(
        'test-library',
        './test-docs'
      );

      expect(taskId).toBeDefined();
      
      const status = await service.getIndexingStatus(taskId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('pending');
    });
  });

  describe('parseDocument', () => {
    it('should parse markdown document', async () => {
      const filePath = './test.md';
      const content = '# Test Document\n\nThis is a test.';
      
      jest.mock('fs/promises', () => ({
        readFile: jest.fn().mockResolvedValue(content),
        stat: jest.fn().mockResolvedValue({ mtime: new Date() })
      }));

      const document = await service.parseDocument(filePath, 'test-lib');

      expect(document).toBeDefined();
      expect(document?.type).toBe('readme');
      expect(document?.format).toBe('markdown');
      expect(document?.metadata.sections).toHaveLength.greaterThan(0);
    });
  });
});
```

---

## Architecture

### Composants

1. **DocumentIndexationService**: Service principal d'indexation
2. **Parser Registry**: Registre des parseurs spécialisés
3. **Chunking Strategies**: Différentes stratégies de découpage
4. **Embedding Integration**: Génération d'embeddings
5. **Storage Layer**: Stockage optimisé des résultats

### Flux d'Indexation

```
File Discovery → Parsing → Chunking → Embedding → Storage → Completion
```

---

## Performance

### Optimisations

- **Parallel Processing**: Traitement parallèle des documents
- **Batch Embedding**: Génération d'embeddings par lots
- **Smart Caching**: Cache des parseurs et résultats
- **Incremental Updates**: Mise à jour uniquement des fichiers modifiés

### Métriques Cibles

- **Parsing Speed**: > 100 documents/second
- **Chunking Efficiency**: > 90% d'utilisation des tokens
- **Embedding Generation**: > 50 chunks/second
- **Storage Performance**: < 100ms par chunk

---

## Monitoring

### Métriques

- `indexation.tasks.total`: Nombre total de tâches
- `indexation.documents.parsed`: Documents parsés
- `indexation.chunks.created`: Chunks créés
- `indexation.embeddings.generated`: Embeddings générés
- `indexation.errors.rate`: Taux d'erreurs

---

## Livrables

1. **DocumentIndexationService**: Service complet
2. **Parser Collection**: Parseurs multi-formats
3. **Chunking Strategies**: 4 stratégies de découpage
4. **Performance Tests**: Benchmarks et optimisations
5. **Monitoring Dashboard**: Stats en temps réel

---

## Critères de Succès

- [ ] Indexation multi-formats fonctionnelle
- [ ] Chunking sémantique efficace
- [ ] Génération d'embeddings intégrée
- [ ] Performance > 100 docs/sec
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Quality Monitoring**: Surveillance de la qualité des chunks
2. **Performance Tuning**: Optimisation des parseurs
3. **Strategy Evaluation**: Évaluation des stratégies de chunking
4. **User Feedback**: Collecte des retours sur la pertinence
