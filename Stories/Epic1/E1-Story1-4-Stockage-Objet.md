# Story 1.4: Stockage objet (S3/MinIO)

**Epic**: 1 - Infrastructure Core et Foundation  
**Story**: 1.4: Stockage objet (S3/MinIO)  
**Estimation**: 2-3 jours  
**Priorité**: Critique  

---

## Objectif

Configurer le stockage objet (AWS S3 ou MinIO local) pour stocker les documents bruts, snapshots de documentation, et fichiers temporaires du système TwinMCP.

---

## Prérequis

- Stories 1.1-1.3 complétées
- Compte AWS avec permissions S3 (si AWS S3)
- Docker installé (si MinIO local)

---

## Étapes Détaillées

### Étape 1: Choix et configuration du stockage

**Action**: Configurer AWS S3 ou MinIO local pour le développement

**Configuration .env**:
```bash
# Storage Provider (s3 ou minio)
STORAGE_PROVIDER=minio

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=twinmcp-docs
S3_BUCKET_REGION=us-east-1

# MinIO Configuration (pour développement)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=twinmcp-docs
MINIO_USE_SSL=false
```

**Docker Compose pour MinIO local**:
```yaml
# Ajouter à docker-compose.yml
  minio:
    image: minio/minio:latest
    container_name: twinmcp-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - twinmcp-network

volumes:
  minio_data:
```

### Étape 2: Installation des dépendances

**Action**: Installer les SDK AWS et dépendances

```bash
# Installer AWS SDK
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
npm install --save-dev @types/node

# Installer utilitaires de fichiers
npm install mime-types
npm install --save-dev @types/mime-types
```

### Étape 3: Service de stockage unifié

**Action**: Créer le service de stockage avec abstraction S3/MinIO

**src/config/storage.ts**:
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { CacheService } from './redis';

export interface StorageConfig {
  provider: 's3' | 'minio';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export class StorageService {
  private client: S3Client;
  private config: StorageConfig;
  private bucket: string;

  constructor() {
    this.config = this.getStorageConfig();
    this.bucket = this.config.bucket;

    this.client = new S3Client({
      region: this.config.region || 'us-east-1',
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: this.config.forcePathStyle || false,
    });
  }

  private getStorageConfig(): StorageConfig {
    const provider = (process.env.STORAGE_PROVIDER as 's3' | 'minio') || 'minio';

    if (provider === 's3') {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
        throw new Error('AWS S3 configuration is incomplete');
      }

      return {
        provider: 's3',
        bucket: process.env.S3_BUCKET_NAME,
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        forcePathStyle: false,
      };
    } else {
      if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY || !process.env.MINIO_BUCKET_NAME) {
        throw new Error('MinIO configuration is incomplete');
      }

      return {
        provider: 'minio',
        bucket: process.env.MINIO_BUCKET_NAME,
        endpoint: `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || 9000}`,
        accessKeyId: process.env.MINIO_ACCESS_KEY,
        secretAccessKey: process.env.MINIO_SECRET_KEY,
        forcePathStyle: true,
      };
    }
  }

  async uploadFile(key: string, body: Buffer | string | Readable, options: UploadOptions = {}): Promise<string> {
    try {
      // Convertir string en Buffer si nécessaire
      const buffer = typeof body === 'string' ? Buffer.from(body) : body;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || this.getContentType(key),
        Metadata: options.metadata || {},
        Tagging: options.tags ? this.buildTagSet(options.tags) : undefined,
      });

      await this.client.send(command);

      logger.info(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      logger.error(`Error uploading file ${key}:`, error);
      throw error;
    }
  }

  async uploadLargeFile(key: string, body: Buffer | string | Readable, options: UploadOptions = {}): Promise<string> {
    try {
      const buffer = typeof body === 'string' ? Buffer.from(body) : body;

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options.contentType || this.getContentType(key),
          Metadata: options.metadata || {},
        },
        queueSize: 4, // Nombre de parties concurrentes
        partSize: 1024 * 1024 * 5, // 5MB par partie
      });

      const result = await upload.done();
      logger.info(`Large file uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      logger.error(`Error uploading large file ${key}:`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      // Vérifier le cache d'abord
      const cacheKey = `storage:file:${key}`;
      const cached = await CacheService.get<Buffer>(cacheKey);
      if (cached) {
        logger.debug(`File cache hit: ${key}`);
        return cached;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`File not found: ${key}`);
      }

      // Convertir stream en Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as Readable) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);

      // Mettre en cache pour 1 heure
      await CacheService.set(cacheKey, buffer, 3600);

      logger.info(`File downloaded successfully: ${key} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      logger.error(`Error downloading file ${key}:`, error);
      throw error;
    }
  }

  async downloadFileAsString(key: string): Promise<string> {
    try {
      const buffer = await this.downloadFile(key);
      return buffer.toString('utf-8');
    } catch (error) {
      logger.error(`Error downloading file as string ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      // Supprimer du cache
      const cacheKey = `storage:file:${key}`;
      await CacheService.del(cacheKey);

      logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      logger.error(`Error deleting file ${key}:`, error);
      throw error;
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    try {
      // Supprimer en parallèle
      await Promise.all(keys.map(key => this.deleteFile(key)));
      logger.info(`Deleted ${keys.length} files successfully`);
    } catch (error) {
      logger.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  async listFiles(prefix: string = '', maxKeys: number = 1000): Promise<FileInfo[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      
      const files: FileInfo[] = (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        contentType: obj.Metadata?.['content-type'],
        metadata: obj.Metadata || {},
      }));

      logger.debug(`Listed ${files.length} files with prefix: ${prefix}`);
      return files;
    } catch (error) {
      logger.error(`Error listing files with prefix ${prefix}:`, error);
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        metadata: response.Metadata || {},
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      logger.debug(`Generated presigned URL for: ${key}`);
      return url;
    } catch (error) {
      logger.error(`Error generating presigned URL for ${key}:`, error);
      throw error;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationKey,
        CopySource: `${this.bucket}/${sourceKey}`,
      });

      await this.client.send(command);
      logger.info(`File copied from ${sourceKey} to ${destinationKey}`);
      return destinationKey;
    } catch (error) {
      logger.error(`Error copying file from ${sourceKey} to ${destinationKey}:`, error);
      throw error;
    }
  }

  private getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
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
      'zip': 'application/zip',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private buildTagSet(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Essayer de lister les fichiers du bucket
      await this.listFiles('', 1);
      return true;
    } catch (error) {
      logger.error('Storage health check failed:', error);
      return false;
    }
  }

  getStorageInfo(): { provider: string; bucket: string; endpoint?: string } {
    return {
      provider: this.config.provider,
      bucket: this.bucket,
      endpoint: this.config.endpoint,
    };
  }
}
```

### Étape 4: Service de gestion des documents

**Action**: Créer le service spécialisé pour les documents de bibliothèques

**src/services/document-storage.service.ts**:
```typescript
import { StorageService, UploadOptions } from '../config/storage';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

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

  async storeChunkedDocument(
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

      // Trier par nom de fichier pour garantir l'ordre
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

      // Stocker le snapshot
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
      
      // Convertir les dates
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
      
      // Extraire les versions uniques
      const versions = new Set<string>();
      files.forEach(file => {
        const parts = file.key.split('/');
        if (parts.length >= 2) {
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
```

### Étape 5: Tests du stockage

**Action**: Créer les tests complets pour les services de stockage

**src/test/storage.test.ts**:
```typescript
import { StorageService } from '../config/storage';
import { DocumentStorageService } from '../services/document-storage.service';

describe('Storage Service', () => {
  let storageService: StorageService;
  let documentStorage: DocumentStorageService;

  beforeAll(async () => {
    storageService = new StorageService();
    documentStorage = new DocumentStorageService();
  });

  describe('Basic Storage Operations', () => {
    const testKey = 'test/file.txt';
    const testContent = 'This is a test file content';

    it('should upload and download file', async () => {
      // Upload
      const uploadedKey = await storageService.uploadFile(testKey, testContent);
      expect(uploadedKey).toBe(testKey);

      // Download
      const downloadedContent = await storageService.downloadFileAsString(testKey);
      expect(downloadedContent).toBe(testContent);
    });

    it('should check file existence', async () => {
      const exists = await storageService.fileExists(testKey);
      expect(exists).toBe(true);

      const notExists = await storageService.fileExists('nonexistent/file.txt');
      expect(notExists).toBe(false);
    });

    it('should get file info', async () => {
      const info = await storageService.getFileInfo(testKey);
      expect(info).toBeDefined();
      expect(info!.key).toBe(testKey);
      expect(info!.size).toBeGreaterThan(0);
      expect(info!.contentType).toBe('text/plain');
    });

    it('should list files', async () => {
      const files = await storageService.listFiles('test/');
      expect(files.length).toBeGreaterThan(0);
      expect(files[0].key).toContain('test/');
    });

    it('should delete file', async () => {
      await storageService.deleteFile(testKey);
      
      const exists = await storageService.fileExists(testKey);
      expect(exists).toBe(false);
    });
  });

  describe('Large File Operations', () => {
    const largeTestKey = 'test/large-file.txt';
    const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB

    it('should upload large file', async () => {
      const uploadedKey = await storageService.uploadLargeFile(largeTestKey, largeContent);
      expect(uploadedKey).toBe(largeTestKey);

      const downloadedContent = await storageService.downloadFile(largeTestKey);
      expect(downloadedContent.length).toBe(largeContent.length);
      expect(downloadedContent.toString()).toBe(largeContent);

      // Cleanup
      await storageService.deleteFile(largeTestKey);
    });
  });

  describe('Document Storage Service', () => {
    const libraryId = '/test/library';
    const version = '1.0.0';

    it('should store and retrieve raw document', async () => {
      const path = 'README.md';
      const content = '# Test Library\n\nThis is a test library.';

      await documentStorage.storeRawDocument(libraryId, version, path, content);
      
      const retrieved = await documentStorage.getRawDocument(libraryId, version, path);
      expect(retrieved.toString()).toBe(content);
    });

    it('should store and retrieve parsed document', async () => {
      const path = 'parsed.json';
      const content = {
        title: 'Test Document',
        sections: ['Introduction', 'API Reference'],
        metadata: { language: 'typescript' },
      };

      await documentStorage.storeParsedDocument(libraryId, version, path, JSON.stringify(content));
      
      const retrieved = await documentStorage.getParsedDocument(libraryId, version, path);
      expect(retrieved).toEqual(content);
    });

    it('should store and retrieve chunked documents', async () => {
      const chunks = [
        {
          index: 0,
          content: 'This is the first chunk.',
          metadata: { type: 'introduction' },
        },
        {
          index: 1,
          content: 'This is the second chunk.',
          metadata: { type: 'example' },
        },
        {
          index: 2,
          content: 'This is the third chunk.',
          metadata: { type: 'conclusion' },
        },
      ];

      await documentStorage.storeChunkedDocuments(libraryId, version, chunks);
      
      const retrieved = await documentStorage.getChunkedDocuments(libraryId, version);
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].index).toBe(0);
      expect(retrieved[1].index).toBe(1);
      expect(retrieved[2].index).toBe(2);
    });

    it('should create and retrieve snapshot', async () => {
      const metadata = {
        sourceUrl: 'https://github.com/test/library',
        commitHash: 'abc123',
        crawlMethod: 'git' as const,
      };

      const snapshot = await documentStorage.createSnapshot(libraryId, version, metadata);
      
      expect(snapshot.libraryId).toBe(libraryId);
      expect(snapshot.version).toBe(version);
      expect(snapshot.files.length).toBeGreaterThan(0);
      expect(snapshot.totalSize).toBeGreaterThan(0);
      expect(snapshot.metadata).toEqual(metadata);

      const retrieved = await documentStorage.getSnapshot(libraryId, version);
      expect(retrieved).toBeDefined();
      expect(retrieved!.libraryId).toBe(libraryId);
      expect(retrieved!.version).toBe(version);
    });

    it('should list library versions', async () => {
      // Ajouter une autre version
      const version2 = '2.0.0';
      await documentStorage.storeRawDocument(libraryId, version2, 'v2.txt', 'Version 2 content');

      const versions = await documentStorage.listLibraryVersions(libraryId);
      expect(versions).toContain(version);
      expect(versions).toContain(version2);
    });

    it('should get library stats', async () => {
      const stats = await documentStorage.getLibraryStats(libraryId);
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(typeof stats.fileTypes).toBe('object');
    });

    it('should delete library documents', async () => {
      await documentStorage.deleteLibraryDocuments(libraryId, version);
      
      // Vérifier que les fichiers sont supprimés
      const files = await storageService.listFiles(`${libraryId}/${version}/`);
      expect(files.length).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should pass storage health check', async () => {
      const isHealthy = await storageService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should pass document storage health check', async () => {
      const isHealthy = await documentStorage.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  afterAll(async () => {
    // Nettoyer les données de test
    try {
      await storageService.deleteFiles(['test/']);
      await storageService.deleteFiles(['/test/']);
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  });
});
```

### Étape 6: Scripts de gestion

**Action**: Créer les scripts pour la gestion du stockage

**scripts/storage-setup.ts**:
```typescript
import { StorageService } from '../src/config/storage';
import { DocumentStorageService } from '../src/services/document-storage.service';

async function setupStorage() {
  console.log('Setting up storage...');

  try {
    const storage = new StorageService();
    const documentStorage = new DocumentStorageService();

    // Health check
    const storageHealthy = await storage.healthCheck();
    console.log('Storage health:', storageHealthy);

    const docStorageHealthy = await documentStorage.healthCheck();
    console.log('Document storage health:', docStorageHealthy);

    // Storage info
    const storageInfo = storage.getStorageInfo();
    console.log('Storage info:', storageInfo);

    // Test upload/download
    const testKey = 'setup-test.txt';
    await storage.uploadFile(testKey, 'Storage setup test');
    const content = await storage.downloadFileAsString(testKey);
    console.log('Test upload/download successful:', content === 'Storage setup test');
    
    // Cleanup
    await storage.deleteFile(testKey);

    console.log('Storage setup completed successfully!');
  } catch (error) {
    console.error('Storage setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupStorage();
}
```

**Scripts package.json**:
```json
{
  "scripts": {
    "storage:setup": "ts-node scripts/storage-setup.ts",
    "storage:test": "npm test -- --testPathPattern=storage",
    "storage:health": "ts-node -e \"import('./src/services/document-storage.service').then(s => new s.DocumentStorageService().healthCheck().then(h => console.log('Healthy:', h)))\""
  }
}
```

---

## Critères d'Achèvement

- [ ] Service de stockage (S3/MinIO) configuré et accessible
- [ ] Service de documents spécialisé fonctionnel
- [ ] Upload/download de fichiers fonctionnel
- [ ] Gestion des snapshots de bibliothèques
- [ ] Tests unitaires passants
- [ ] Health checks implémentés
- [ ] Scripts de gestion créés
- [ ] Cache des fichiers fonctionnel

---

## Tests de Validation

```bash
# 1. Démarrer MinIO (si utilisé)
npm run docker:up

# 2. Configurer les variables d'environnement
# Copier .env.example vers .env et configurer

# 3. Initialiser le stockage
npm run storage:setup

# 4. Exécuter les tests
npm run storage:test

# 5. Health check
npm run storage:health
```

---

## Risques et Mitigations

**Risque**: Configuration S3 incorrecte  
**Mitigation**: Tests de connexion et permissions détaillés

**Risque**: Coût de stockage AWS élevé  
**Mitigation**: MinIO pour développement, lifecycle rules pour production

**Risque**: Corruption de fichiers  
**Mitigation**: Checksums et validation des uploads

---

## Prochaine Étape

Passer à **Epic 2: Serveur MCP Core** pour commencer le développement du serveur MCP avec les outils de résolution et d'interrogation.
