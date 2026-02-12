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
  IndexerConfig,
  ParseOptions,
  EmbeddingRequest,
  EmbeddingResult
} from '../types/indexation.types';
import { INDEXATION_CONFIG, PARSER_REGISTRY } from '../config/indexation.config';
import { DocumentChunker } from '../interfaces/chunker.interface';
import { MarkdownParser } from '../parsers/markdown.parser';
import { TypeScriptParser } from '../parsers/typescript.parser';
import { JavaScriptParser } from '../parsers/javascript.parser';
import { HTMLParser } from '../parsers/html.parser';
import { JSONParser } from '../parsers/json.parser';
import { SemanticChunker } from '../chunkers/semantic.chunker';
import { FixedSizeChunker } from '../chunkers/fixed-size.chunker';
import { HierarchicalChunker } from '../chunkers/hierarchical.chunker';
import { MixedChunker } from '../chunkers/mixed.chunker';

export class DocumentIndexationService {
  private parsers: Map<string, any> = new Map();
  private chunkers: Map<string, DocumentChunker> = new Map();
  private activeTasks: Map<string, IndexingTask> = new Map();

  constructor(
    private db: Pool,
    private _redis: Redis,
    private embeddingService: any
  ) {
    this.initializeParsers();
    this.initializeChunkers();
  }

  private initializeParsers(): void {
    this.parsers.set('markdown', new MarkdownParser());
    this.parsers.set('typescript', new TypeScriptParser());
    this.parsers.set('javascript', new JavaScriptParser());
    this.parsers.set('html', new HTMLParser());
    this.parsers.set('json', new JSONParser());
  }

  private initializeChunkers(): void {
    this.chunkers.set('semantic', new SemanticChunker());
    this.chunkers.set('fixed', new FixedSizeChunker() as any);
    this.chunkers.set('hierarchical', new HierarchicalChunker());
    this.chunkers.set('mixed', new MixedChunker());
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

    await this.saveIndexingTask(task);
    this.activeTasks.set(taskId, task);

    this.processIndexingTask(task).catch(error => {
      console.error(`Indexing task ${taskId} failed:`, error);
      this.handleTaskError(task, error);
    });

    return taskId;
  }

  async getIndexingStatus(taskId: string): Promise<IndexingTask | null> {
    if (this.activeTasks.has(taskId)) {
      return this.activeTasks.get(taskId)!;
    }

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

      const files = await this.discoverDocuments(task.sourcePath);
      task.progress.total = files.length;
      await this.updateTaskProgress(task, 'discovery', 0, files.length);

      const documents: ParsedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        task.progress.currentFile = file || '';
        task.progress.completed = i;
        task.progress.percentage = files.length > 0 ? Math.round((i / files.length) * 100) : 0;

        try {
          const document = await this.parseDocument(file || '', task.libraryId);
          if (document) {
            documents.push(document);
            task.results.documentsParsed++;
          }
        } catch (error: any) {
          const errorMsg = `Error parsing ${file}: ${error.message}`;
          task.results.errors.push(errorMsg);
          console.error(errorMsg);
        }

        await this.updateTaskProgress(task, 'parsing', i + 1, files.length);
      }

      task.status = 'chunking';
      task.progress.phase = 'chunking';
      task.progress.completed = 0;
      task.progress.total = documents.length;

      const allChunks: DocumentChunk[] = [];
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        if (document) {
          const chunks = await this.chunkDocument(document, task.config);
          allChunks.push(...chunks);
          task.results.chunksCreated += chunks.length;
        }

        task.progress.completed = i + 1;
        task.progress.percentage = Math.round((i / documents.length) * 100);
        await this.updateTaskProgress(task, 'chunking', i + 1, documents.length);
      }

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
          } as EmbeddingRequest);

          embeddingResults.forEach((result: EmbeddingResult, index: number) => {
            if (batch[index]) {
              batch[index].embedding = result.embedding;
              batch[index].embeddingModel = result.model;
            }
          });

          task.results.embeddingsGenerated += embeddingResults.length;
        } catch (error: any) {
          const errorMsg = `Error generating embeddings for batch ${Math.floor(i / batchSize) + 1}: ${error.message}`;
          task.results.errors.push(errorMsg);
          console.error(errorMsg);
        }

        task.progress.completed = Math.min(i + batchSize, allChunks.length);
        task.progress.percentage = Math.round((task.progress.completed / allChunks.length) * 100);
        await this.updateTaskProgress(task, 'embedding', task.progress.completed, allChunks.length);
      }

      await this.storeIndexingResults(task.libraryId, documents, allChunks);

      task.status = 'completed';
      task.completedAt = new Date();
      task.progress.percentage = 100;
      await this.updateTaskStatus(task);

      console.log(`Indexing completed for task ${task.id}: ${task.results.documentsParsed} documents, ${task.results.chunksCreated} chunks`);

    } catch (error) {
      await this.handleTaskError(task, error as Error);
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private async discoverDocuments(sourcePath: string): Promise<string[]> {
    const documents: string[] = [];
    const supportedExtensions = Object.values(PARSER_REGISTRY)
      .flatMap(parser => parser.supportedFormats);

    const scanDirectory = async (dirPath: string, depth = 0): Promise<void> => {
      if (depth > 10) return;

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            
            if (supportedExtensions.includes(ext)) {
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

      const options: ParseOptions = {
        filePath,
        libraryId,
        lastModified: stats.mtime
      };

      const parsed = await parser.parse(content, options);

      return {
        ...parsed,
        id: crypto.randomUUID(),
        sourcePath: filePath,
        chunks: [],
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
    const chunker = this.chunkers.get(strategy);
    if (chunker) {
      return chunker;
    }
    
    // Fallback vers semantic chunker
    const fallback = this.chunkers.get('semantic');
    if (fallback) {
      return fallback;
    }
    
    throw new Error(`No chunker found for strategy: ${strategy}`);
  }

  private async storeIndexingResults(
    libraryId: string, 
    documents: ParsedDocument[], 
    chunks: DocumentChunk[]
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

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
    }, {} as Record<string, number>);

    const typeDistribution = typeResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

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
