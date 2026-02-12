# E6-Story6-2-Telechargement-Sources.md

## Epic 6: Crawling Service

### Story 6.2: Téléchargement des sources

**Description**: Download automatique des docs et code source

---

## Objectif

Développer un service robuste de téléchargement automatique des sources et documentation depuis GitHub, npm registry et autres sources, avec gestion des erreurs, parallélisation et stockage optimisé.

---

## Prérequis

- Service de monitoring GitHub (Story 6.1) opérationnel
- Stockage S3 ou équivalent configuré
- Espace disque suffisant pour le cache
- Système de gestion des fichiers

---

## Spécifications Techniques

### 1. Architecture de Téléchargement

#### 1.1 Types et Interfaces

```typescript
// src/types/download.types.ts
export interface DownloadTask {
  id: string;
  type: 'github' | 'npm' | 'website' | 'documentation';
  source: {
    owner?: string;
    repository?: string;
    packageName?: string;
    version?: string;
    url?: string;
  };
  options: {
    shallow: boolean;
    includeDocs: boolean;
    includeTests: boolean;
    includeExamples: boolean;
    maxDepth: number;
    excludePatterns: string[];
  };
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'retrying';
  progress: {
    downloaded: number;
    total: number;
    percentage: number;
    currentFile: string;
  };
  metadata: {
    size: number;
    files: number;
    duration: number;
    checksum?: string;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}

export interface DownloadResult {
  taskId: string;
  success: boolean;
  localPath: string;
  metadata: {
    totalSize: number;
    fileCount: number;
    directoryCount: number;
    downloadTime: number;
    extractedSize: number;
  };
  files: DownloadedFile[];
  errors: string[];
}

export interface DownloadedFile {
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
  checksum: string;
  mimeType?: string;
  encoding?: string;
}

export interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  basePath: string;
  bucket?: string;
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keyId?: string;
  };
  compression?: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli' | 'lz4';
    level: number;
  };
  retention?: {
    days: number;
    policy: 'delete' | 'archive';
  };
}

export interface DownloadQueue {
  pending: DownloadTask[];
  active: DownloadTask[];
  completed: DownloadTask[];
  failed: DownloadTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageDownloadTime: number;
    totalDownloadedSize: number;
  };
}

export interface CrawlerConfig {
  maxConcurrentDownloads: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  chunkSize: number;
  userAgent: string;
  headers: Record<string, string>;
  excludePatterns: string[];
  includePatterns: string[];
  maxFileSize: number;
  maxDirectoryDepth: number;
}
```

#### 1.2 Configuration du Service

```typescript
// src/config/download.config.ts
export const DOWNLOAD_CONFIG: CrawlerConfig = {
  maxConcurrentDownloads: 5,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 300000, // 5 minutes
  chunkSize: 1024 * 1024, // 1MB
  userAgent: 'TwinMe-Crawler/1.0 (+https://twinme.ai)',
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    'Accept-Encoding': 'gzip, deflate, br'
  },
  excludePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.nyc_output/**',
    '**/.cache/**',
    '**/tmp/**',
    '**/temp/**'
  ],
  includePatterns: [
    '**/*.md',
    '**/*.txt',
    '**/*.js',
    '**/*.ts',
    '**/*.jsx',
    '**/*.tsx',
    '**/*.json',
    '**/*.yml',
    '**/*.yaml',
    '**/README*',
    '**/CHANGELOG*',
    '**/LICENSE*',
    '**/docs/**',
    '**/examples/**',
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts'
  ],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxDirectoryDepth: 10
};

export const STORAGE_CONFIG: StorageConfig = {
  type: 'local',
  basePath: process.env.DOWNLOAD_STORAGE_PATH || './downloads',
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },
  retention: {
    days: 30,
    policy: 'archive'
  }
};
```

### 2. Service de Téléchargement

#### 2.1 Download Manager Service

```typescript
// src/services/download-manager.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { S3 } from 'aws-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  DownloadTask, 
  DownloadResult, 
  DownloadedFile, 
  StorageConfig,
  DownloadQueue
} from '../types/download.types';

const execAsync = promisify(exec);

export class DownloadManagerService {
  private activeDownloads: Map<string, DownloadTask> = new Map();
  private downloadQueue: DownloadTask[] = [];
  private maxConcurrentDownloads: number;

  constructor(
    private db: Pool,
    private redis: Redis,
    private storageConfig: StorageConfig,
    private config = DOWNLOAD_CONFIG
  ) {
    this.maxConcurrentDownloads = config.maxConcurrentDownloads;
  }

  async createDownloadTask(task: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'createdAt' | 'retryCount'>): Promise<string> {
    const downloadTask: DownloadTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      progress: {
        downloaded: 0,
        total: 0,
        percentage: 0,
        currentFile: ''
      },
      createdAt: new Date(),
      retryCount: 0
    };

    // Sauvegarde en base
    await this.saveDownloadTask(downloadTask);

    // Ajout à la queue
    this.downloadQueue.push(downloadTask);
    
    // Tri par priorité
    this.downloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Démarrage du traitement si nécessaire
    this.processQueue();

    return downloadTask.id;
  }

  async getDownloadStatus(taskId: string): Promise<DownloadTask | null> {
    // Vérification dans la mémoire active
    if (this.activeDownloads.has(taskId)) {
      return this.activeDownloads.get(taskId)!;
    }

    // Recherche en base
    const result = await this.db.query(
      'SELECT * FROM download_tasks WHERE id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  }

  async getDownloadQueue(): Promise<DownloadQueue> {
    const [pending, active, completed, failed] = await Promise.all([
      this.getTasksByStatus('pending'),
      this.getTasksByStatus('downloading'),
      this.getTasksByStatus('completed'),
      this.getTasksByStatus('failed')
    ]);

    const stats = await this.calculateDownloadStats();

    return {
      pending,
      active,
      completed,
      failed,
      stats
    };
  }

  private async processQueue(): Promise<void> {
    while (this.activeDownloads.size < this.maxConcurrentDownloads && this.downloadQueue.length > 0) {
      const task = this.downloadQueue.shift()!;
      
      // Mise à jour du statut
      task.status = 'downloading';
      task.startedAt = new Date();
      await this.updateTaskStatus(task.id, 'downloading');
      
      // Ajout aux téléchargements actifs
      this.activeDownloads.set(task.id, task);
      
      // Démarrage du téléchargement
      this.downloadTask(task).catch(error => {
        console.error(`Download failed for task ${task.id}:`, error);
        this.handleDownloadError(task, error);
      });
    }
  }

  private async downloadTask(task: DownloadTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      let result: DownloadResult;

      switch (task.type) {
        case 'github':
          result = await this.downloadFromGitHub(task);
          break;
        case 'npm':
          result = await this.downloadFromNPM(task);
          break;
        case 'website':
          result = await this.downloadFromWebsite(task);
          break;
        default:
          throw new Error(`Unsupported download type: ${task.type}`);
      }

      // Mise à jour du statut
      task.status = 'completed';
      task.completedAt = new Date();
      task.progress.percentage = 100;
      task.metadata = {
        size: result.metadata.totalSize,
        files: result.metadata.fileCount,
        duration: Date.now() - startTime,
        checksum: await this.calculateDirectoryChecksum(result.localPath)
      };

      await this.updateTaskStatus(task.id, 'completed', task.metadata);
      await this.saveDownloadResult(task.id, result);

      console.log(`Download completed for task ${task.id}: ${result.localPath}`);

    } catch (error) {
      await this.handleDownloadError(task, error);
    } finally {
      // Retrait des téléchargements actifs
      this.activeDownloads.delete(task.id);
      
      // Traitement de la queue suivante
      this.processQueue();
    }
  }

  private async downloadFromGitHub(task: DownloadTask): Promise<DownloadResult> {
    const { owner, repository } = task.source;
    if (!owner || !repository) {
      throw new Error('GitHub source requires owner and repository');
    }

    const localPath = this.getLocalPath(task);
    await fs.mkdir(localPath, { recursive: true });

    // Construction de la commande git
    let gitCommand = `git clone`;
    
    if (task.options.shallow) {
      gitCommand += ' --depth 1';
    }
    
    gitCommand += ` https://github.com/${owner}/${repository}.git ${localPath}`;

    // Exécution du clone
    try {
      const { stdout, stderr } = await execAsync(gitCommand);
      
      if (stderr && !stderr.includes('Cloning into')) {
        console.warn(`Git clone warning for ${owner}/${repository}:`, stderr);
      }

    } catch (error) {
      throw new Error(`Git clone failed: ${error.message}`);
    }

    // Nettoyage si nécessaire (exclusion de patterns)
    if (task.options.excludePatterns.length > 0) {
      await this.cleanRepository(localPath, task.options.excludePatterns);
    }

    // Analyse des fichiers
    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: []
    };
  }

  private async downloadFromNPM(task: DownloadTask): Promise<DownloadResult> {
    const { packageName, version } = task.source;
    if (!packageName) {
      throw new Error('NPM source requires package name');
    }

    const localPath = this.getLocalPath(task);
    await fs.mkdir(localPath, { recursive: true });

    // Utilisation de npm pack pour télécharger
    const packageSpec = version ? `${packageName}@${version}` : packageName;
    const tarballPath = path.join(localPath, 'package.tgz');

    try {
      // Téléchargement du tarball
      await execAsync(`npm pack ${packageSpec} --pack-destination="${localPath}"`);
      
      // Extraction
      await execAsync(`tar -xzf "${tarballPath}" -C "${localPath}"`);
      
      // Nettoyage du tarball
      await fs.unlink(tarballPath);

    } catch (error) {
      throw new Error(`NPM download failed: ${error.message}`);
    }

    // Analyse des fichiers
    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: []
    };
  }

  private async downloadFromWebsite(task: DownloadTask): Promise<DownloadResult> {
    const { url } = task.source;
    if (!url) {
      throw new Error('Website source requires URL');
    }

    const localPath = this.getLocalPath(task);
    await fs.mkdir(localPath, { recursive: true });

    // Utilisation de wget ou curl pour le téléchargement
    try {
      await execAsync(`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent "${url}" -P "${localPath}"`);
    } catch (error) {
      throw new Error(`Website download failed: ${error.message}`);
    }

    // Analyse des fichiers
    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: []
    };
  }

  private async cleanRepository(localPath: string, excludePatterns: string[]): Promise<void> {
    for (const pattern of excludePatterns) {
      try {
        await execAsync(`find "${localPath}" -path "${pattern}" -delete`);
      } catch (error) {
        // Ignorer les erreurs de suppression (fichiers non trouvés)
      }
    }
  }

  private async analyzeDirectory(dirPath: string, maxDepth: number = 10): Promise<DownloadedFile[]> {
    const files: DownloadedFile[] = [];
    
    const analyze = async (currentPath: string, depth: number = 0): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(dirPath, fullPath);
          
          if (entry.name.startsWith('.')) continue; // Ignorer les fichiers cachés
          
          const stats = await fs.stat(fullPath);
          const checksum = await this.calculateFileChecksum(fullPath);
          
          if (entry.isDirectory()) {
            files.push({
              path: relativePath,
              type: 'directory',
              size: 0,
              lastModified: stats.mtime,
              checksum
            });
            
            await analyze(fullPath, depth + 1);
          } else {
            const mimeType = await this.getMimeType(fullPath);
            
            files.push({
              path: relativePath,
              type: 'file',
              size: stats.size,
              lastModified: stats.mtime,
              checksum,
              mimeType,
              encoding: mimeType?.startsWith('text/') ? 'utf8' : undefined
            });
          }
        }
      } catch (error) {
        console.error(`Error analyzing directory ${currentPath}:`, error);
      }
    };

    await analyze(dirPath);
    return files;
  }

  private async getDirectoryMetadata(dirPath: string): Promise<{
    totalSize: number;
    fileCount: number;
    directoryCount: number;
    downloadTime: number;
    extractedSize: number;
  }> {
    const files = await this.analyzeDirectory(dirPath);
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileCount = files.filter(f => f.type === 'file').length;
    const directoryCount = files.filter(f => f.type === 'directory').length;
    
    return {
      totalSize,
      fileCount,
      directoryCount,
      downloadTime: 0, // Calculé après le téléchargement
      extractedSize: totalSize
    };
  }

  private getLocalPath(task: DownloadTask): string {
    const basePath = this.storageConfig.basePath;
    
    switch (task.type) {
      case 'github':
        return path.join(basePath, 'github', task.source.owner!, task.source.repository!);
      case 'npm':
        return path.join(basePath, 'npm', task.source.packageName!);
      case 'website':
        return path.join(basePath, 'website', crypto.createHash('md5').update(task.source.url!).digest('hex'));
      default:
        return path.join(basePath, 'downloads', task.id);
    }
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      for await (const chunk of stream) {
        hash.update(chunk);
      }
      
      return hash.digest('hex');
    } catch (error) {
      return '';
    }
  }

  private async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    try {
      const hash = crypto.createHash('sha256');
      const files = await this.analyzeDirectory(dirPath);
      
      // Tri des fichiers pour un checksum déterministe
      files.sort((a, b) => a.path.localeCompare(b.path));
      
      for (const file of files) {
        hash.update(`${file.path}:${file.checksum}`);
      }
      
      return hash.digest('hex');
    } catch (error) {
      return '';
    }
  }

  private async getMimeType(filePath: string): Promise<string | undefined> {
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const buffer = await fs.readFile(filePath);
      const result = await fileTypeFromBuffer(buffer);
      return result?.mime;
    } catch (error) {
      // Fallback basé sur l'extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.ts': 'application/typescript',
        '.json': 'application/json',
        '.md': 'text/markdown',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css'
      };
      
      return mimeTypes[ext];
    }
  }

  private async handleDownloadError(task: DownloadTask, error: Error): Promise<void> {
    task.retryCount++;
    
    if (task.retryCount < this.config.maxRetries) {
      // Retry
      task.status = 'retrying';
      task.error = error.message;
      
      await this.updateTaskStatus(task.id, 'retrying', { error: error.message, retryCount: task.retryCount });
      
      // Attente avant retry
      await this.delay(this.config.retryDelay * task.retryCount);
      
      // Remise dans la queue
      this.downloadQueue.push(task);
      this.processQueue();
      
    } else {
      // Échec définitif
      task.status = 'failed';
      task.error = error.message;
      
      await this.updateTaskStatus(task.id, 'failed', { error: error.message });
      
      console.error(`Download failed permanently for task ${task.id}:`, error);
    }
  }

  private async saveDownloadTask(task: DownloadTask): Promise<void> {
    await this.db.query(`
      INSERT INTO download_tasks (
        id, type, source, options, priority, status, 
        progress, metadata, created_at, started_at, 
        completed_at, error, retry_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        metadata = EXCLUDED.metadata,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        error = EXCLUDED.error,
        retry_count = EXCLUDED.retry_count
    `, [
      task.id,
      task.type,
      JSON.stringify(task.source),
      JSON.stringify(task.options),
      task.priority,
      task.status,
      JSON.stringify(task.progress),
      JSON.stringify(task.metadata),
      task.createdAt,
      task.startedAt,
      task.completedAt,
      task.error,
      task.retryCount
    ]);
  }

  private async updateTaskStatus(taskId: string, status: string, metadata?: any): Promise<void> {
    const updateFields = ['status = $2'];
    const values = [taskId, status];
    let paramIndex = 3;

    if (metadata) {
      updateFields.push(`metadata = metadata || $${paramIndex}`);
      values.push(JSON.stringify(metadata));
      paramIndex++;
    }

    if (status === 'downloading') {
      updateFields.push(`started_at = NOW()`);
    } else if (status === 'completed' || status === 'failed') {
      updateFields.push(`completed_at = NOW()`);
    }

    await this.db.query(`
      UPDATE download_tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, values);
  }

  private async saveDownloadResult(taskId: string, result: DownloadResult): Promise<void> {
    await this.db.query(`
      INSERT INTO download_results (
        task_id, success, local_path, metadata, files, errors, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW()
      )
    `, [
      taskId,
      result.success,
      result.localPath,
      JSON.stringify(result.metadata),
      JSON.stringify(result.files),
      result.errors
    ]);
  }

  private async getTasksByStatus(status: string): Promise<DownloadTask[]> {
    const result = await this.db.query(
      'SELECT * FROM download_tasks WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );

    return result.rows.map(row => ({
      ...row,
      source: JSON.parse(row.source),
      options: JSON.parse(row.options),
      progress: JSON.parse(row.progress),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  private async calculateDownloadStats(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_download_time,
        COALESCE(SUM((metadata->>'size')::bigint), 0) as total_downloaded_size
      FROM download_tasks
      WHERE status IN ('completed', 'failed')
    `);

    const stats = result.rows[0];
    
    return {
      totalTasks: parseInt(stats.total_tasks),
      completedTasks: parseInt(stats.completed_tasks),
      failedTasks: parseInt(stats.failed_tasks),
      averageDownloadTime: parseFloat(stats.avg_download_time) || 0,
      totalDownloadedSize: parseInt(stats.total_downloaded_size)
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Service de Stockage

#### 3.1 Storage Service

```typescript
// src/services/storage.service.ts
import { S3 } from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageConfig, DownloadedFile } from '../types/download.types';

export class StorageService {
  private s3Client?: S3;

  constructor(private config: StorageConfig) {
    if (config.type === 's3') {
      this.s3Client = new S3({
        accessKeyId: config.credentials?.accessKeyId,
        secretAccessKey: config.credentials?.secretAccessKey,
        sessionToken: config.credentials?.sessionToken,
        region: config.region || 'us-east-1'
      });
    }
  }

  async storeFiles(localPath: string, files: DownloadedFile[], taskId: string): Promise<string[]> {
    const storedPaths: string[] = [];

    for (const file of files) {
      if (file.type === 'file') {
        const storedPath = await this.storeFile(localPath, file, taskId);
        if (storedPath) {
          storedPaths.push(storedPath);
        }
      }
    }

    return storedPaths;
  }

  private async storeFile(localPath: string, file: DownloadedFile, taskId: string): Promise<string | null> {
    const filePath = path.join(localPath, file.path);
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      let processedBuffer = fileBuffer;

      // Compression si activée
      if (this.config.compression?.enabled) {
        processedBuffer = await this.compressBuffer(fileBuffer, this.config.compression);
      }

      // Chiffrement si activé
      if (this.config.encryption?.enabled) {
        processedBuffer = await this.encryptBuffer(processedBuffer);
      }

      // Stockage selon le type
      switch (this.config.type) {
        case 'local':
          return await this.storeFileLocal(processedBuffer, file, taskId);
        case 's3':
          return await this.storeFileS3(processedBuffer, file, taskId);
        default:
          throw new Error(`Unsupported storage type: ${this.config.type}`);
      }

    } catch (error) {
      console.error(`Error storing file ${file.path}:`, error);
      return null;
    }
  }

  private async storeFileLocal(buffer: Buffer, file: DownloadedFile, taskId: string): Promise<string> {
    const storagePath = path.join(this.config.basePath, taskId, file.path);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, buffer);
    return storagePath;
  }

  private async storeFileS3(buffer: Buffer, file: DownloadedFile, taskId: string): Promise<string> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not properly configured');
    }

    const key = `${taskId}/${file.path}`;
    
    const params: S3.PutObjectRequest = {
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.mimeType,
      Metadata: {
        'original-size': file.size.toString(),
        'checksum': file.checksum,
        'task-id': taskId
      }
    };

    // Ajout du chiffrement côté serveur si nécessaire
    if (this.config.encryption?.enabled) {
      params.ServerSideEncryption = 'AES256';
    }

    await this.s3Client.upload(params).promise();
    
    return `s3://${this.config.bucket}/${key}`;
  }

  private async compressBuffer(buffer: Buffer, compression: StorageConfig['compression']): Promise<Buffer> {
    if (!compression) return buffer;

    switch (compression.algorithm) {
      case 'gzip':
        const { gzip } = await import('zlib');
        return gzip(buffer, { level: compression.level });
      case 'brotli':
        const { brotliCompress } = await import('zlib');
        return brotliCompress(buffer);
      case 'lz4':
        // Implémentation LZ4 (nécessite package externe)
        return buffer; // Placeholder
      default:
        return buffer;
    }
  }

  private async encryptBuffer(buffer: Buffer): Promise<Buffer> {
    // Implémentation du chiffrement AES-256
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.config.encryption?.keyId || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('additional-data'));
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Concaténation: iv + authTag + encrypted
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async cleanupOldFiles(): Promise<{ deleted: number; freedSpace: number }> {
    // Implémentation du nettoyage selon la politique de rétention
    return { deleted: 0, freedSpace: 0 };
  }
}
```

---

## Tâches Détaillées

### 1. Service de Téléchargement
- [ ] Implémenter DownloadManagerService
- [ ] Ajouter le support GitHub (git clone)
- [ ] Intégrer le téléchargement NPM
- [ ] Développer le crawling de sites web

### 2. Gestion de Queue
- [ ] Créer le système de queue prioritaire
- [ ] Implémenter le parallélisme
- [ ] Ajouter la gestion des erreurs et retries
- [ ] Optimiser la progression

### 3. Stockage et Compression
- [ ] Développer StorageService
- [ ] Implémenter la compression
- [ ] Ajouter le chiffrement
- [ ] Configurer S3/local storage

### 4. Monitoring et Analytics
- [ ] Tracker les téléchargements
- [ ] Calculer les métriques
- [ ] Ajouter les alertes
- [ ] Optimiser les performances

---

## Validation

### Tests de Téléchargement

```typescript
// __tests__/download-manager.service.test.ts
describe('DownloadManagerService', () => {
  let service: DownloadManagerService;

  beforeEach(() => {
    service = new DownloadManagerService(
      mockDb,
      mockRedis,
      STORAGE_CONFIG
    );
  });

  describe('createDownloadTask', () => {
    it('should create and queue download task', async () => {
      const task = {
        type: 'github' as const,
        source: { owner: 'facebook', repository: 'react' },
        options: { shallow: true, includeDocs: true, includeTests: false, includeExamples: true, maxDepth: 5, excludePatterns: [] },
        priority: 'normal' as const
      };

      const taskId = await service.createDownloadTask(task);

      expect(taskId).toBeDefined();
      
      const status = await service.getDownloadStatus(taskId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('pending');
    });
  });

  describe('downloadFromGitHub', () => {
    it('should download GitHub repository', async () => {
      const task: DownloadTask = {
        id: 'test-task',
        type: 'github',
        source: { owner: 'facebook', repository: 'react' },
        options: { shallow: true, includeDocs: true, includeTests: false, includeExamples: true, maxDepth: 5, excludePatterns: [] },
        priority: 'normal',
        status: 'downloading',
        progress: { downloaded: 0, total: 0, percentage: 0, currentFile: '' },
        metadata: { size: 0, files: 0, duration: 0 },
        createdAt: new Date(),
        retryCount: 0
      };

      // Mock git clone
      jest.mock('child_process', () => ({
        exec: jest.fn().mockResolvedValue({ stdout: '', stderr: '' })
      }));

      const result = await service.downloadFromGitHub(task);

      expect(result.success).toBe(true);
      expect(result.localPath).toContain('facebook/react');
      expect(result.files).toHaveLength.greaterThan(0);
    });
  });
});
```

---

## Architecture

### Composants

1. **DownloadManagerService**: Gestionnaire principal des téléchargements
2. **StorageService**: Service de stockage (local/S3)
3. **Queue Manager**: Gestion des files d'attente
4. **Compression Service**: Compression et chiffrement
5. **Monitoring**: Tracking des performances

### Flux de Téléchargement

```
Task Creation → Queue → Parallel Download → Processing → Storage → Completion
```

---

## Performance

### Optimisations

- **Parallel Downloads**: Jusqu'à 5 téléchargements simultanés
- **Shallow Clones**: Git clone --depth 1 pour GitHub
- **Compression**: Gzip/Brotli pour réduire l'espace
- **Chunked Processing**: Traitement par morceaux
- **Smart Caching**: Cache des fichiers déjà téléchargés

### Métriques Cibles

- **Download Speed**: > 10MB/s pour les gros repos
- **Queue Processing**: < 1 minute avant démarrage
- **Storage Efficiency**: > 60% de compression
- **Error Rate**: < 5% des téléchargements

---

## Monitoring

### Métriques

- `download.tasks.total`: Nombre total de tâches
- `download.tasks.active`: Téléchargements actifs
- `download.size.total`: Taille totale téléchargée
- `download.duration.average`: Durée moyenne
- `download.errors.rate`: Taux d'erreurs

---

## Livrables

1. **DownloadManagerService**: Service complet
2. **StorageService**: Stockage optimisé
3. **Queue System**: Gestion prioritaire
4. **Compression Engine**: Compression/chiffrement
5. **Monitoring Dashboard**: Stats en temps réel

---

## Critères de Succès

- [ ] Téléchargements GitHub/NPM fonctionnels
- [ ] Queue prioritaire efficace
- [ ] Compression > 60%
- [ ] Parallélisme > 5 téléchargements
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance des vitesses
2. **Storage Optimization**: Ajustement compression
3. **Error Analysis**: Analyse des échecs
4. **Queue Tuning**: Optimisation priorités
