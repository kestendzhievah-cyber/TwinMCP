import { Pool } from 'pg';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  DownloadTask,
  DownloadResult,
  DownloadedFile,
  StorageConfig,
  DownloadQueue,
} from '../types/download.types';
import { DOWNLOAD_CONFIG } from '../config/download.config';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Regex for validating GitHub owner/repository names (alphanumeric, dash, underscore, dot)
const GITHUB_NAME_REGEX = /^[A-Za-z0-9_.-]+$/;

export class DownloadManagerService {
  private activeDownloads: Map<string, DownloadTask> = new Map();
  private downloadQueue: DownloadTask[] = [];
  private maxConcurrentDownloads: number;

  constructor(
    private db: Pool,
    private storageConfig: StorageConfig,
    private config = DOWNLOAD_CONFIG
  ) {
    this.maxConcurrentDownloads = config.maxConcurrentDownloads;
  }

  async createDownloadTask(
    task: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'createdAt' | 'retryCount'>
  ): Promise<string> {
    const downloadTask: DownloadTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      progress: {
        downloaded: 0,
        total: 0,
        percentage: 0,
        currentFile: '',
      },
      createdAt: new Date(),
      retryCount: 0,
    };

    await this.saveDownloadTask(downloadTask);
    this.downloadQueue.push(downloadTask);

    this.downloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.processQueue();

    return downloadTask.id;
  }

  async getDownloadStatus(taskId: string): Promise<DownloadTask | null> {
    if (this.activeDownloads.has(taskId)) {
      return this.activeDownloads.get(taskId) || null;
    }

    const result = await this.db.query('SELECT * FROM download_tasks WHERE id = $1', [taskId]);

    return result.rows[0] ?? null;
  }

  async getDownloadQueue(): Promise<DownloadQueue> {
    const [pending, active, completed, failed] = await Promise.all([
      this.getTasksByStatus('pending'),
      this.getTasksByStatus('downloading'),
      this.getTasksByStatus('completed'),
      this.getTasksByStatus('failed'),
    ]);

    const stats = await this.calculateDownloadStats();

    return {
      pending,
      active,
      completed,
      failed,
      stats,
    };
  }

  private async processQueue(): Promise<void> {
    while (
      this.activeDownloads.size < this.maxConcurrentDownloads &&
      this.downloadQueue.length > 0
    ) {
      const task = this.downloadQueue.shift()!;

      task.status = 'downloading';
      task.startedAt = new Date();
      await this.updateTaskStatus(task.id, 'downloading');

      this.activeDownloads.set(task.id, task);

      void this.downloadTask(task).catch((error: unknown) => {
        console.error(`Download failed for task ${task.id}:`, error);
        this.handleDownloadError(task, error as Error);
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

      task.status = 'completed';
      task.completedAt = new Date();
      task.progress.percentage = 100;
      task.metadata = {
        size: result.metadata.totalSize,
        files: result.metadata.fileCount,
        duration: Date.now() - startTime,
        checksum: await this.calculateDirectoryChecksum(result.localPath),
      };

      await this.updateTaskStatus(task.id, 'completed', task.metadata);
      await this.saveDownloadResult(task.id, result);

      console.log(`Download completed for task ${task.id}: ${result.localPath}`);
    } catch (error) {
      await this.handleDownloadError(task, error as Error);
    } finally {
      this.activeDownloads.delete(task.id);
      this.processQueue();
    }
  }

  private async downloadFromGitHub(task: DownloadTask): Promise<DownloadResult> {
    const { owner, repository } = task.source;
    if (!owner || !repository) {
      throw new Error('GitHub source requires owner and repository');
    }

    // Security: Validate owner and repository names to prevent injection
    if (!GITHUB_NAME_REGEX.test(owner)) {
      throw new Error(`Invalid GitHub owner name: ${owner}`);
    }
    if (!GITHUB_NAME_REGEX.test(repository)) {
      throw new Error(`Invalid GitHub repository name: ${repository}`);
    }

    const localPath = this.getLocalPath(task);
    await fsPromises.mkdir(localPath, { recursive: true });

    // Build args array for execFile (safe from shell injection)
    const args = ['clone'];
    if (task.options.shallow) {
      args.push('--depth', '1');
    }
    args.push(`https://github.com/${owner}/${repository}.git`, localPath);

    try {
      // Use execFileAsync instead of execAsync for security (no shell interpolation)
      await execFileAsync('git', args, { timeout: this.config.timeout });
    } catch (error) {
      throw new Error(`Git clone failed: ${(error as Error).message}`);
    }

    if (task.options.excludePatterns.length > 0) {
      await this.cleanRepository(localPath, task.options.excludePatterns);
    }

    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: [],
    };
  }

  private async downloadFromNPM(task: DownloadTask): Promise<DownloadResult> {
    const { packageName, version } = task.source;
    if (!packageName) {
      throw new Error('NPM source requires package name');
    }

    // Windows compatibility: tar command may not be available
    if (process.platform === 'win32') {
      throw new Error('NPM download with tar extraction is not fully supported on Windows. Please use GitHub download instead.');
    }

    const localPath = this.getLocalPath(task);
    await fsPromises.mkdir(localPath, { recursive: true });

    const packageSpec = version ? `${packageName}@${version}` : packageName;
    const tarballPath = path.join(localPath, 'package.tgz');

    try {
      await execFileAsync('npm', ['pack', packageSpec, `--pack-destination=${localPath}`], { timeout: this.config.timeout });
      await execAsync(`tar -xzf "${tarballPath}" -C "${localPath}"`);
      await fsPromises.unlink(tarballPath);
    } catch (error) {
      throw new Error(`NPM download failed: ${(error as Error).message}`);
    }

    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: [],
    };
  }

  private async downloadFromWebsite(task: DownloadTask): Promise<DownloadResult> {
    const { url } = task.source;
    if (!url) {
      throw new Error('Website source requires URL');
    }

    // Windows compatibility: wget command is not available by default
    if (process.platform === 'win32') {
      throw new Error('Website download (wget) is not supported on Windows. Please use GitHub download instead.');
    }

    const localPath = this.getLocalPath(task);
    await fsPromises.mkdir(localPath, { recursive: true });

    try {
      await execFileAsync('wget', [
        '--mirror',
        '--convert-links',
        '--adjust-extension',
        '--page-requisites',
        '--no-parent',
        url,
        '-P',
        localPath
      ], { timeout: this.config.timeout });
    } catch (error) {
      throw new Error(`Website download failed: ${(error as Error).message}`);
    }

    const files = await this.analyzeDirectory(localPath);
    const metadata = await this.getDirectoryMetadata(localPath);

    return {
      taskId: task.id,
      success: true,
      localPath,
      metadata,
      files,
      errors: [],
    };
  }

  private async cleanRepository(localPath: string, excludePatterns: string[]): Promise<void> {
    // Cross-platform implementation using Node.js fs (no dependency on Unix 'find' command)
    const defaultPatternsToClean = ['node_modules', '.git', 'dist', 'build', '.cache'];
    
    for (const pattern of [...excludePatterns, ...defaultPatternsToClean]) {
      try {
        // Simple pattern matching: if pattern is a directory name, find and remove it
        const cleanPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\//g, '');
        if (!cleanPattern) continue;
        
        await this.removeMatchingDirectories(localPath, cleanPattern);
      } catch (error) {
        console.warn(`Failed to clean pattern ${pattern}:`, error);
      }
    }
  }

  private async removeMatchingDirectories(basePath: string, dirName: string, maxDepth: number = 5): Promise<void> {
    if (maxDepth <= 0) return;

    try {
      const entries = await fsPromises.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = path.join(basePath, entry.name);
        
        if (entry.name === dirName) {
          // Remove this directory
          await fsPromises.rm(fullPath, { recursive: true, force: true });
          console.log(`Cleaned: ${fullPath}`);
        } else {
          // Recurse into subdirectories
          await this.removeMatchingDirectories(fullPath, dirName, maxDepth - 1);
        }
      }
    } catch (error) {
      // Ignore errors (directory might not exist or permission issues)
    }
  }

  private async analyzeDirectory(
    dirPath: string,
    maxDepth: number = 10
  ): Promise<DownloadedFile[]> {
    const files: DownloadedFile[] = [];

    const analyze = async (currentPath: string, depth: number = 0): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(dirPath, fullPath);

          if (entry.name.startsWith('.')) continue;

          const stats = await fsPromises.stat(fullPath);
          const checksum = await this.calculateFileChecksum(fullPath);

          if (entry.isDirectory()) {
            files.push({
              path: relativePath,
              type: 'directory',
              size: 0,
              lastModified: stats.mtime,
              checksum,
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
              ...(mimeType && { mimeType }),
              ...(mimeType?.startsWith('text/') && { encoding: 'utf8' }),
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
      downloadTime: 0,
      extractedSize: totalSize,
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
        return path.join(
          basePath,
          'website',
          crypto.createHash('md5').update(task.source.url!).digest('hex')
        );
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
      const buffer = await fsPromises.readFile(filePath);
      const result = await fileTypeFromBuffer(buffer);
      return result?.mime;
    } catch (error) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.ts': 'application/typescript',
        '.json': 'application/json',
        '.md': 'text/markdown',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
      };

      return mimeTypes[ext];
    }
  }

  private async handleDownloadError(task: DownloadTask, error: Error): Promise<void> {
    task.retryCount++;

    if (task.retryCount < this.config.maxRetries) {
      task.status = 'retrying';
      task.error = error.message;

      await this.updateTaskStatus(task.id, 'retrying', {
        error: error.message,
        retryCount: task.retryCount,
      });

      await this.delay(this.config.retryDelay * task.retryCount);

      this.downloadQueue.push(task);
      this.processQueue();
    } else {
      task.status = 'failed';
      task.error = error.message;

      await this.updateTaskStatus(task.id, 'failed', { error: error.message });

      console.error(`Download failed permanently for task ${task.id}:`, error);
    }
  }

  private async saveDownloadTask(task: DownloadTask): Promise<void> {
    await this.db.query(
      `
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
    `,
      [
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
        task.retryCount,
      ]
    );
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

    await this.db.query(
      `
      UPDATE download_tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `,
      values
    );
  }

  private async saveDownloadResult(taskId: string, result: DownloadResult): Promise<void> {
    await this.db.query(
      `
      INSERT INTO download_results (
        task_id, success, local_path, metadata, files, errors, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW()
      )
    `,
      [
        taskId,
        result.success,
        result.localPath,
        JSON.stringify(result.metadata),
        JSON.stringify(result.files),
        result.errors,
      ]
    );
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
      metadata: JSON.parse(row.metadata || '{}'),
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
      totalDownloadedSize: parseInt(stats.total_downloaded_size),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
