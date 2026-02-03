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

    const clientConfig: any = {
      region: this.config.region || 'us-east-1',
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    };

    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
      clientConfig.forcePathStyle = this.config.forcePathStyle || false;
    }

    this.client = new S3Client(clientConfig);
  }

  private getStorageConfig(): StorageConfig {
    const provider = (process.env.STORAGE_PROVIDER as 's3' | 'minio') || 'minio';

    if (provider === 's3') {
      // Use dummy values for build time if not configured
      return {
        provider: 's3',
        bucket: process.env.S3_BUCKET_NAME || 'default-bucket',
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy-secret',
        forcePathStyle: false,
      };
    } else {
      // Use dummy values for build time if not configured
      return {
        provider: 'minio',
        bucket: process.env.MINIO_BUCKET_NAME || 'default-bucket',
        endpoint: this.buildMinioEndpoint(),
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        forcePathStyle: true,
      };
    }
  }

  async uploadFile(key: string, body: Buffer | string | Readable, options: UploadOptions = {}): Promise<string> {
    try {
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
        queueSize: 4,
        partSize: 1024 * 1024 * 5,
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
      const cacheKey = `storage:file:${key}`;
      const cached = await CacheService.get<string>(cacheKey);
      if (cached) {
        logger.debug(`File cache hit: ${key}`);
        return Buffer.from(cached, 'base64');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`File not found: ${key}`);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as Readable) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);

      await CacheService.set(cacheKey, buffer.toString('base64'), 3600);

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

  private buildMinioEndpoint(): string {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSsl = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';

    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return `${endpoint}:${port}`;
    }

    const protocol = useSsl ? 'https' : 'http';
    return `${protocol}://${endpoint}:${port}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
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
