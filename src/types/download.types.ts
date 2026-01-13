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
