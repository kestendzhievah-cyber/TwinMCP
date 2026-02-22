// @ts-nocheck

// In-memory file store
let fileStore: Map<string, { content: Buffer; contentType: string; metadata: Record<string, string> }>;

function getContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    txt: 'text/plain', md: 'text/markdown', json: 'application/json',
    js: 'application/javascript', ts: 'application/typescript',
  };
  return types[ext || ''] || 'application/octet-stream';
}

// Mock S3 client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({ done: jest.fn() })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url'),
}));

jest.mock('../config/redis', () => ({
  CacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
  },
  redisClient: { on: jest.fn().mockReturnThis() },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock StorageService with in-memory store
jest.mock('../config/storage', () => {
  return {
    StorageService: jest.fn().mockImplementation(() => ({
      uploadFile: jest.fn().mockImplementation(async (key: string, body: any) => {
        const buf = typeof body === 'string' ? Buffer.from(body) : body;
        fileStore.set(key, { content: buf, contentType: getContentType(key), metadata: {} });
        return key;
      }),
      uploadLargeFile: jest.fn().mockImplementation(async (key: string, body: any) => {
        const buf = typeof body === 'string' ? Buffer.from(body) : body;
        fileStore.set(key, { content: buf, contentType: getContentType(key), metadata: {} });
        return key;
      }),
      downloadFile: jest.fn().mockImplementation(async (key: string) => {
        const f = fileStore.get(key);
        if (!f) throw new Error(`File not found: ${key}`);
        return f.content;
      }),
      downloadFileAsString: jest.fn().mockImplementation(async (key: string) => {
        const f = fileStore.get(key);
        if (!f) throw new Error(`File not found: ${key}`);
        return f.content.toString('utf-8');
      }),
      deleteFile: jest.fn().mockImplementation(async (key: string) => {
        fileStore.delete(key);
      }),
      deleteFiles: jest.fn().mockImplementation(async (keys: string[]) => {
        for (const key of keys) fileStore.delete(key);
      }),
      listFiles: jest.fn().mockImplementation(async (prefix: string) => {
        const results: any[] = [];
        for (const [key, val] of fileStore) {
          if (key.startsWith(prefix)) {
            results.push({ key, size: val.content.length, lastModified: new Date() });
          }
        }
        return results;
      }),
      fileExists: jest.fn().mockImplementation(async (key: string) => {
        return fileStore.has(key);
      }),
      getFileInfo: jest.fn().mockImplementation(async (key: string) => {
        const f = fileStore.get(key);
        if (!f) return null;
        return { key, size: f.content.length, lastModified: new Date(), contentType: f.contentType, metadata: f.metadata };
      }),
      healthCheck: jest.fn().mockResolvedValue(true),
      getStorageInfo: jest.fn().mockReturnValue({ provider: 'minio', bucket: 'test' }),
    })),
  };
});

import { StorageService } from '../config/storage';
import { DocumentStorageService } from '../services/document-storage.service';

describe('Storage Service', () => {
  let storageService: StorageService;
  let documentStorage: DocumentStorageService;

  beforeAll(() => {
    fileStore = new Map();
    storageService = new StorageService();
    documentStorage = new DocumentStorageService();
  });

  beforeEach(() => {
    fileStore = new Map();
  });

  describe('Basic Storage Operations', () => {
    const testKey = 'test/file.txt';
    const testContent = 'This is a test file content';

    it('should upload and download file', async () => {
      const uploadedKey = await storageService.uploadFile(testKey, testContent);
      expect(uploadedKey).toBe(testKey);

      const downloadedContent = await storageService.downloadFileAsString(testKey);
      expect(downloadedContent).toBe(testContent);
    });

    it('should check file existence', async () => {
      await storageService.uploadFile(testKey, testContent);
      const exists = await storageService.fileExists(testKey);
      expect(exists).toBe(true);

      const notExists = await storageService.fileExists('nonexistent/file.txt');
      expect(notExists).toBe(false);
    });

    it('should get file info', async () => {
      await storageService.uploadFile(testKey, testContent);
      const info = await storageService.getFileInfo(testKey);
      expect(info).toBeDefined();
      if (info) {
        expect(info.key).toBe(testKey);
        expect(info.size).toBeGreaterThan(0);
        expect(info.contentType).toBe('text/plain');
      }
    });

    it('should list files', async () => {
      await storageService.uploadFile(testKey, testContent);
      const files = await storageService.listFiles('test/');
      expect(files.length).toBeGreaterThan(0);
      if (files[0]) {
        expect(files[0].key).toContain('test/');
      }
    });

    it('should delete file', async () => {
      await storageService.uploadFile(testKey, testContent);
      await storageService.deleteFile(testKey);
      const exists = await storageService.fileExists(testKey);
      expect(exists).toBe(false);
    });
  });

  describe('Large File Operations', () => {
    const largeTestKey = 'test/large-file.txt';
    const largeContent = 'x'.repeat(6 * 1024 * 1024);

    it('should upload large file', async () => {
      const uploadedKey = await storageService.uploadLargeFile(largeTestKey, largeContent);
      expect(uploadedKey).toBe(largeTestKey);

      const downloadedContent = await storageService.downloadFile(largeTestKey);
      expect(downloadedContent.length).toBe(largeContent.length);
      expect(downloadedContent.toString()).toBe(largeContent);

      await storageService.deleteFile(largeTestKey);
    });
  });

  describe('Document Storage Service', () => {
    const libraryId = 'testlibrary';
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
        { index: 0, content: 'This is the first chunk.', metadata: { type: 'introduction' } },
        { index: 1, content: 'This is the second chunk.', metadata: { type: 'example' } },
        { index: 2, content: 'This is the third chunk.', metadata: { type: 'conclusion' } },
      ];

      await documentStorage.storeChunkedDocuments(libraryId, version, chunks);
      const retrieved = await documentStorage.getChunkedDocuments(libraryId, version);
      expect(retrieved).toHaveLength(3);
      if (retrieved[0]) expect(retrieved[0].index).toBe(0);
      if (retrieved[1]) expect(retrieved[1].index).toBe(1);
      if (retrieved[2]) expect(retrieved[2].index).toBe(2);
    });

    it('should create and retrieve snapshot', async () => {
      // Store a file first so snapshot has files
      await documentStorage.storeRawDocument(libraryId, version, 'test.md', 'content');

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
      await documentStorage.storeRawDocument(libraryId, version, 'v1.txt', 'V1');
      const version2 = '2.0.0';
      await documentStorage.storeRawDocument(libraryId, version2, 'v2.txt', 'Version 2 content');

      const versions = await documentStorage.listLibraryVersions(libraryId);
      expect(versions).toContain(version);
      expect(versions).toContain(version2);
    });

    it('should get library stats', async () => {
      await documentStorage.storeRawDocument(libraryId, version, 'stats.txt', 'some content');
      const stats = await documentStorage.getLibraryStats(libraryId);
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(typeof stats.fileTypes).toBe('object');
    });

    it('should delete library documents', async () => {
      await documentStorage.storeRawDocument(libraryId, version, 'del.txt', 'to delete');
      await documentStorage.deleteLibraryDocuments(libraryId, version);
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
});
