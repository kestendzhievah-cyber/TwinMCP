import { CrawlerConfig, StorageConfig } from '../types/download.types';

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
  basePath: process.env['DOWNLOAD_STORAGE_PATH'] || './downloads',
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
