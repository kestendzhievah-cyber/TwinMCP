import { StorageService, UploadOptions } from '../config/storage';
import { logger } from '../utils/logger';

export interface LibraryDocument {
  libraryId: string;
  version: string;
  type: 'raw' | 'parsed' | 'chunked';
  path: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface DocumentSnapshot {
  libraryId: string;
  version: string;
  timestamp: Date;
  files: string[];
  totalSize: number;
  metadata: {
    sourceUrl?: string;
    commitHash?: string;
    crawlMethod: 'git' | 'api' | 'scraping';
  };
}

export class DocumentStorageService {
  private storage: StorageService;

  constructor() {
    this.storage = new StorageService();
  }

  async storeRawDocument(
    libraryId: string,
    version: string,
    path: string,
    content: Buffer | string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const key = this.buildKey(libraryId, version, 'raw', path);
      
      const uploadOptions: UploadOptions = {
        contentType: this.getContentType(path),
        metadata: {
          libraryId,
          version,
          type: 'raw',
          path,
          ...metadata,
        },
        tags: {
          libraryId,
          version,
          type: 'raw',
        },
      };

      await this.storage.uploadFile(key, content, uploadOptions);
      
      logger.info(`Stored raw document: ${key}`);
      return key;
    } catch (error) {
      logger.error(`Error storing raw document ${path}:`, error);
      throw error;
    }
  }

  async storeParsedDocument(
    libraryId: string,
    version: string,
    path: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const key = this.buildKey(libraryId, version, 'parsed', path);
      
      const uploadOptions: UploadOptions = {
        contentType: 'application/json',
        metadata: {
          libraryId,
          version,
          type: 'parsed',
          path,
          ...metadata,
        },
        tags: {
          libraryId,
          version,
          type: 'parsed',
        },
      };

      await this.storage.uploadFile(key, content, uploadOptions);
      
      logger.info(`Stored parsed document: ${key}`);
      return key;
    } catch (error) {
      logger.error(`Error storing parsed document ${path}:`, error);
      throw error;
    }
  }

  async storeChunkedDocuments(
    libraryId: string,
    version: string,
    chunks: Array<{
      index: number;
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<string[]> {
    try {
      const chunkKeys: string[] = [];
      
      for (const chunk of chunks) {
        const key = this.buildKey(
          libraryId, 
          version, 
          'chunked', 
          `chunk_${chunk.index.toString().padStart(6, '0')}.json`
        );
        
        const chunkData = {
          index: chunk.index,
          content: chunk.content,
          metadata: chunk.metadata,
        };

        const uploadOptions: UploadOptions = {
          contentType: 'application/json',
          metadata: {
            libraryId,
            version,
            type: 'chunked',
            chunkIndex: chunk.index.toString(),
            ...chunk.metadata,
          },
          tags: {
            libraryId,
            version,
            type: 'chunked',
          },
        };

        await this.storage.uploadFile(key, JSON.stringify(chunkData, null, 2), uploadOptions);
        chunkKeys.push(key);
      }

      logger.info(`Stored ${chunks.length} chunked documents for ${libraryId}@${version}`);
      return chunkKeys;
    } catch (error) {
      logger.error(`Error storing chunked documents for ${libraryId}@${version}:`, error);
      throw error;
    }
  }

  async getRawDocument(libraryId: string, version: string, path: string): Promise<Buffer> {
    try {
      const key = this.buildKey(libraryId, version, 'raw', path);
      return await this.storage.downloadFile(key);
    } catch (error) {
      logger.error(`Error getting raw document ${path}:`, error);
      throw error;
    }
  }

  async getParsedDocument(libraryId: string, version: string, path: string): Promise<any> {
    try {
      const key = this.buildKey(libraryId, version, 'parsed', path);
      const content = await this.storage.downloadFileAsString(key);
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Error getting parsed document ${path}:`, error);
      throw error;
    }
  }

  async getChunkedDocuments(libraryId: string, version: string): Promise<Array<{
    index: number;
    content: string;
    metadata: Record<string, any>;
  }>> {
    try {
      const prefix = this.buildPrefix(libraryId, version, 'chunked');
      const files = await this.storage.listFiles(prefix);
      
      const chunks: Array<{
        index: number;
        content: string;
        metadata: Record<string, any>;
      }> = [];

      files.sort((a, b) => a.key.localeCompare(b.key));

      for (const file of files) {
        const content = await this.storage.downloadFileAsString(file.key);
        const chunk = JSON.parse(content);
        chunks.push(chunk);
      }

      logger.info(`Retrieved ${chunks.length} chunked documents for ${libraryId}@${version}`);
      return chunks;
    } catch (error) {
      logger.error(`Error getting chunked documents for ${libraryId}@${version}:`, error);
      throw error;
    }
  }

  async createSnapshot(
    libraryId: string,
    version: string,
    metadata: DocumentSnapshot['metadata']
  ): Promise<DocumentSnapshot> {
    try {
      const prefix = this.buildPrefix(libraryId, version);
      const files = await this.storage.listFiles(prefix);
      
      const snapshot: DocumentSnapshot = {
        libraryId,
        version,
        timestamp: new Date(),
        files: files.map(f => f.key),
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        metadata,
      };

      const snapshotKey = this.buildKey(libraryId, version, 'meta', 'snapshot.json');
      await this.storage.uploadFile(
        snapshotKey,
        JSON.stringify(snapshot, null, 2),
        {
          contentType: 'application/json',
          metadata: {
            libraryId,
            version,
            type: 'snapshot',
          },
        }
      );

      logger.info(`Created snapshot for ${libraryId}@${version} with ${files.length} files`);
      return snapshot;
    } catch (error) {
      logger.error(`Error creating snapshot for ${libraryId}@${version}:`, error);
      throw error;
    }
  }

  async getSnapshot(libraryId: string, version: string): Promise<DocumentSnapshot | null> {
    try {
      const snapshotKey = this.buildKey(libraryId, version, 'meta', 'snapshot.json');
      
      if (!(await this.storage.fileExists(snapshotKey))) {
        return null;
      }

      const content = await this.storage.downloadFileAsString(snapshotKey);
      const snapshot = JSON.parse(content);
      
      snapshot.timestamp = new Date(snapshot.timestamp);
      
      return snapshot;
    } catch (error) {
      logger.error(`Error getting snapshot for ${libraryId}@${version}:`, error);
      throw error;
    }
  }

  async deleteLibraryDocuments(libraryId: string, version?: string): Promise<void> {
    try {
      const prefix = version 
        ? this.buildPrefix(libraryId, version)
        : `${libraryId}/`;
      
      const files = await this.storage.listFiles(prefix);
      const keys = files.map(f => f.key);
      
      if (keys.length > 0) {
        await this.storage.deleteFiles(keys);
        logger.info(`Deleted ${keys.length} documents for ${libraryId}${version ? `@${version}` : ''}`);
      }
    } catch (error) {
      logger.error(`Error deleting documents for ${libraryId}${version ? `@${version}` : ''}:`, error);
      throw error;
    }
  }

  async listLibraryVersions(libraryId: string): Promise<string[]> {
    try {
      const prefix = `${libraryId}/`;
      const files = await this.storage.listFiles(prefix);
      
      const versions = new Set<string>();
      files.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length >= 2 && parts[1]) {
          versions.add(parts[1]);
        }
      });

      const versionList = Array.from(versions).sort();
      logger.info(`Found ${versionList.length} versions for ${libraryId}`);
      return versionList;
    } catch (error) {
      logger.error(`Error listing versions for ${libraryId}:`, error);
      throw error;
    }
  }

  async getLibraryStats(libraryId: string, version?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    try {
      const prefix = version 
        ? this.buildPrefix(libraryId, version)
        : `${libraryId}/`;
      
      const files = await this.storage.listFiles(prefix);
      
      const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        fileTypes: {} as Record<string, number>,
      };

      files.forEach(file => {
        const ext = file.key.split('.').pop()?.toLowerCase() || 'unknown';
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error(`Error getting stats for ${libraryId}${version ? `@${version}` : ''}:`, error);
      throw error;
    }
  }

  private buildKey(libraryId: string, version: string, type: string, path: string): string {
    return `${libraryId}/${version}/${type}/${path}`;
  }

  private buildPrefix(libraryId: string, version: string, type?: string): string {
    return type 
      ? `${libraryId}/${version}/${type}/`
      : `${libraryId}/${version}/`;
  }

  private getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'json': 'application/json',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'html': 'text/html',
      'css': 'text/css',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.storage.healthCheck();
    } catch (error) {
      logger.error('Document storage health check failed:', error);
      return false;
    }
  }
}
