import { DocumentChunk, ParsedDocument, IndexerConfig } from '../types/indexation.types';

export interface DocumentChunker {
  chunk(document: ParsedDocument, config: IndexerConfig): Promise<DocumentChunk[]>;
}

export interface ParserInterface {
  parse(content: string, options: {
    filePath: string;
    libraryId: string;
    lastModified: Date;
    encoding?: string;
    language?: string;
  }): Promise<{
    title: string;
    type: ParsedDocument['type'];
    format: ParsedDocument['format'];
    metadata: ParsedDocument['metadata'];
    content: string;
    rawContent: string;
  }>;
}
