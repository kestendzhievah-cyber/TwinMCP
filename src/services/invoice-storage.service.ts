import { StorageService } from '../config/storage';
import { logger } from '../utils/logger';
import { Invoice } from '../types/invoice.types';

export interface InvoicePDFMetadata {
  invoiceId: string;
  invoiceNumber: string;
  userId: string;
  generatedAt: Date;
  fileSize: number;
}

export class InvoiceStorageService {
  private storage: StorageService;
  private readonly basePath = 'invoices';

  constructor() {
    this.storage = new StorageService();
  }

  async storePDF(
    invoice: Invoice,
    pdfBuffer: Buffer
  ): Promise<string> {
    try {
      const key = this.buildPDFKey(invoice.userId, invoice.id, invoice.number);
      
      const metadata: Record<string, string> = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        userId: invoice.userId,
        generatedAt: new Date().toISOString(),
        fileSize: pdfBuffer.length.toString(),
        status: invoice.status,
        total: invoice.total.toString(),
        currency: invoice.currency,
      };

      await this.storage.uploadFile(key, pdfBuffer, {
        contentType: 'application/pdf',
        metadata,
        tags: {
          type: 'invoice',
          userId: invoice.userId,
          invoiceId: invoice.id,
          status: invoice.status,
        },
      });

      logger.info(`Invoice PDF stored successfully: ${key}`);
      return key;
    } catch (error) {
      logger.error(`Error storing invoice PDF for ${invoice.id}:`, error);
      throw error;
    }
  }

  async getPDF(userId: string, invoiceId: string): Promise<Buffer> {
    try {
      const files = await this.storage.listFiles(this.buildUserPrefix(userId));
      const invoiceFile = files.find(f => f.key.includes(invoiceId));
      
      if (!invoiceFile) {
        throw new Error(`Invoice PDF not found for invoice ${invoiceId}`);
      }

      const buffer = await this.storage.downloadFile(invoiceFile.key);
      logger.info(`Invoice PDF retrieved: ${invoiceFile.key}`);
      return buffer;
    } catch (error) {
      logger.error(`Error retrieving invoice PDF for ${invoiceId}:`, error);
      throw error;
    }
  }

  async getPDFByKey(key: string): Promise<Buffer> {
    try {
      return await this.storage.downloadFile(key);
    } catch (error) {
      logger.error(`Error retrieving invoice PDF by key ${key}:`, error);
      throw error;
    }
  }

  async deletePDF(userId: string, invoiceId: string): Promise<void> {
    try {
      const files = await this.storage.listFiles(this.buildUserPrefix(userId));
      const invoiceFile = files.find(f => f.key.includes(invoiceId));
      
      if (invoiceFile) {
        await this.storage.deleteFile(invoiceFile.key);
        logger.info(`Invoice PDF deleted: ${invoiceFile.key}`);
      }
    } catch (error) {
      logger.error(`Error deleting invoice PDF for ${invoiceId}:`, error);
      throw error;
    }
  }

  async listUserInvoicePDFs(userId: string): Promise<InvoicePDFMetadata[]> {
    try {
      const prefix = this.buildUserPrefix(userId);
      const files = await this.storage.listFiles(prefix);
      
      const metadata: InvoicePDFMetadata[] = files.map(file => ({
        invoiceId: file.metadata?.invoiceId || '',
        invoiceNumber: file.metadata?.invoiceNumber || '',
        userId: file.metadata?.userId || userId,
        generatedAt: new Date(file.metadata?.generatedAt || file.lastModified),
        fileSize: file.size,
      }));

      logger.info(`Listed ${metadata.length} invoice PDFs for user ${userId}`);
      return metadata;
    } catch (error) {
      logger.error(`Error listing invoice PDFs for user ${userId}:`, error);
      throw error;
    }
  }

  async getPresignedDownloadUrl(userId: string, invoiceId: string, expiresIn: number = 3600): Promise<string> {
    try {
      const files = await this.storage.listFiles(this.buildUserPrefix(userId));
      const invoiceFile = files.find(f => f.key.includes(invoiceId));
      
      if (!invoiceFile) {
        throw new Error(`Invoice PDF not found for invoice ${invoiceId}`);
      }

      const url = await this.storage.getPresignedUrl(invoiceFile.key, expiresIn);
      logger.info(`Generated presigned URL for invoice ${invoiceId}`);
      return url;
    } catch (error) {
      logger.error(`Error generating presigned URL for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  async archiveOldInvoices(userId: string, beforeDate: Date): Promise<number> {
    try {
      const prefix = this.buildUserPrefix(userId);
      const files = await this.storage.listFiles(prefix);
      
      const oldFiles = files.filter(f => f.lastModified < beforeDate);
      
      for (const file of oldFiles) {
        const archiveKey = file.key.replace(this.basePath, `${this.basePath}/archive`);
        await this.storage.copyFile(file.key, archiveKey);
        await this.storage.deleteFile(file.key);
      }

      logger.info(`Archived ${oldFiles.length} invoice PDFs for user ${userId}`);
      return oldFiles.length;
    } catch (error) {
      logger.error(`Error archiving invoices for user ${userId}:`, error);
      throw error;
    }
  }

  async getStorageStats(userId?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
  }> {
    try {
      const prefix = userId ? this.buildUserPrefix(userId) : this.basePath;
      const files = await this.storage.listFiles(prefix);
      
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      
      return {
        totalFiles: files.length,
        totalSize,
        averageSize: files.length > 0 ? totalSize / files.length : 0,
      };
    } catch (error) {
      logger.error(`Error getting storage stats:`, error);
      throw error;
    }
  }

  private buildPDFKey(userId: string, invoiceId: string, invoiceNumber: string): string {
    const sanitizedNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    return `${this.basePath}/${userId}/${invoiceId}_${sanitizedNumber}_${timestamp}.pdf`;
  }

  private buildUserPrefix(userId: string): string {
    return `${this.basePath}/${userId}/`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.storage.healthCheck();
    } catch (error) {
      logger.error('Invoice storage health check failed:', error);
      return false;
    }
  }
}
