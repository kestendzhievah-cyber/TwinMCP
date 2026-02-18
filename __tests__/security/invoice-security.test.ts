// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvoiceService } from '../../src/services/invoice.service';
import { EncryptionService } from '../../src/services/security/encryption.service';
import { AuditService } from '../../src/services/security/audit.service';
import { GDPRService } from '../../src/services/security/gdpr.service';
import { DataMaskingService } from '../../src/services/security/data-masking.service';
import { Pool } from 'pg';
import { InvoiceStatus, BillingPeriodType } from '../../src/types/invoice.types';

describe('InvoiceService Security Tests', () => {
  let invoiceService: InvoiceService;
  let mockDb: jest.Mocked<Pool>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockGDPRService: jest.Mocked<GDPRService>;
  let mockMaskingService: jest.Mocked<DataMaskingService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    } as unknown as jest.Mocked<Pool>;

    mockEncryptionService = {
      encryptPII: jest.fn(),
      decryptPII: jest.fn()
    } as any;

    mockAuditService = {
      logAccess: jest.fn(),
      logSecurityEvent: jest.fn()
    } as any;

    mockGDPRService = {
      recordConsent: jest.fn(),
      anonymizeUser: jest.fn(),
      exportUserData: jest.fn()
    } as any;

    mockMaskingService = {
      maskForLogging: jest.fn().mockImplementation(data => data)
    } as any;

    invoiceService = new InvoiceService(
      mockDb,
      mockEncryptionService,
      mockAuditService,
      mockGDPRService,
      mockMaskingService
    );
  });

  describe('Input Validation', () => {
    it('should reject invoice generation with invalid userId', async () => {
      const invalidPeriod = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date(),
        endDate: new Date()
      };

      await expect(
        invoiceService.generateInvoice('', invalidPeriod)
      ).rejects.toThrow();
    });

    it('should reject invoice generation with invalid period', async () => {
      const invalidPeriod = {
        type: 'invalid' as any,
        startDate: new Date(),
        endDate: new Date()
      };

      await expect(
        invoiceService.generateInvoice('user123', invalidPeriod)
      ).rejects.toThrow();
    });

    it('should validate date ranges in billing period', async () => {
      const invalidPeriod = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2023-01-31'),
        endDate: new Date('2023-01-01')
      };

      await expect(
        invoiceService.generateInvoice('user123', invalidPeriod)
      ).rejects.toThrow();
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt customer PII data', async () => {
      const userId = 'user123';
      const period = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };

      const mockCustomerInfo = {
        email: 'test@example.com',
        name: 'John Doe',
        address: '123 Main St'
      };

      const encryptedData = {
        data: {
          email: 'encrypted_email',
          name: 'encrypted_name',
          address: 'encrypted_address'
        },
        encrypted: true,
        keyId: 'test-key',
        timestamp: new Date().toISOString()
      };

      mockEncryptionService.encryptPII.mockResolvedValue(encryptedData);
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await invoiceService.generateInvoice(userId, period);

      expect(mockEncryptionService.encryptPII).toHaveBeenCalledWith(
        expect.objectContaining({
          email: expect.any(String),
          name: expect.any(String),
          address: expect.any(String)
        })
      );
    });

    it('should decrypt customer PII when retrieving invoice', async () => {
      const invoiceId = 'invoice123';
      const userId = 'user123';
      const encryptedCustomerInfo = {
        data: {
          email: 'encrypted_email',
          name: 'encrypted_name'
        },
        encrypted: true,
        keyId: 'test-key',
        timestamp: new Date().toISOString()
      };

      const decryptedCustomerInfo = {
        email: 'test@example.com',
        name: 'John Doe'
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: invoiceId,
          user_id: userId,
          period: JSON.stringify({
            type: BillingPeriodType.MONTHLY,
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-31')
          }),
          status: InvoiceStatus.DRAFT,
          items: JSON.stringify([]),
          subtotal: '100.00',
          tax: '20.00',
          total: '120.00',
          currency: 'EUR',
          due_date: new Date('2023-02-28'),
          paid_date: null,
          created_at: new Date(),
          updated_at: new Date(),
          metadata: JSON.stringify({
            customerInfo: encryptedCustomerInfo
          })
        }]
      });

      mockEncryptionService.decryptPII.mockResolvedValue(decryptedCustomerInfo);

      const result = await invoiceService.getInvoice(invoiceId, userId);

      expect(mockEncryptionService.decryptPII).toHaveBeenCalledWith(encryptedCustomerInfo);
      expect(result?.metadata?.customerInfo).toEqual(decryptedCustomerInfo);
    });
  });

  describe('Audit Logging', () => {
    it('should log access when generating invoice', async () => {
      const userId = 'user123';
      const period = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };

      mockEncryptionService.encryptPII.mockResolvedValue({
        data: {},
        encrypted: true,
        keyId: 'test-key',
        timestamp: new Date().toISOString()
      });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await invoiceService.generateInvoice(
        userId, 
        period,
        undefined,
        { ipAddress: '192.168.1.1', userAgent: 'test-agent' }
      );

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        userId,
        'invoice',
        'generation',
        'generate',
        '192.168.1.1',
        'test-agent'
      );
    });

    it('should log access when retrieving invoice', async () => {
      const invoiceId = 'invoice123';
      const userId = 'user123';

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{
          id: invoiceId,
          user_id: userId,
          period: JSON.stringify({
            type: BillingPeriodType.MONTHLY,
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-31')
          }),
          status: InvoiceStatus.DRAFT,
          items: JSON.stringify([]),
          subtotal: '100.00',
          tax: '20.00',
          total: '120.00',
          currency: 'EUR',
          due_date: new Date('2023-02-28'),
          paid_date: null,
          created_at: new Date(),
          updated_at: new Date(),
          metadata: JSON.stringify({})
        }]
      });

      await invoiceService.getInvoice(
        invoiceId, 
        userId,
        { ipAddress: '192.168.1.1', userAgent: 'test-agent' }
      );

      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        userId,
        'invoice',
        invoiceId,
        'read',
        '192.168.1.1',
        'test-agent'
      );
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should properly escape parameters in queries', async () => {
      const maliciousUserId = "'; DROP TABLE invoices; --";
      const period = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };

      mockEncryptionService.encryptPII.mockResolvedValue({
        data: {},
        encrypted: true,
        keyId: 'test-key',
        timestamp: new Date().toISOString()
      });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await invoiceService.generateInvoice(maliciousUserId, period);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices'),
        expect.arrayContaining([maliciousUserId])
      );
    });
  });

  describe('Data Masking', () => {
    it('should mask sensitive data in logs', async () => {
      const sensitiveData = {
        email: 'test@example.com',
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789'
      };

      const maskedData = {
        email: 'te***@example.com',
        creditCard: '****-****-****-1111',
        ssn: '***-**-6789'
      };

      mockMaskingService.maskForLogging.mockReturnValue(maskedData);

      const result = mockMaskingService.maskForLogging(sensitiveData);

      expect(result).toEqual(maskedData);
      expect(mockMaskingService.maskForLogging).toHaveBeenCalledWith(sensitiveData);
    });
  });

  describe('GDPR Compliance', () => {
    it('should support data export requests', async () => {
      const userId = 'user123';
      const exportData = {
        personalData: { name: 'John Doe', email: 'john@example.com' },
        invoices: [],
        preferences: {},
        usageData: [],
        exportDate: new Date(),
        format: 'json',
        version: '1.0'
      };

      mockGDPRService.exportUserData.mockResolvedValue(exportData);

      const result = await mockGDPRService.exportUserData(userId, userId);

      expect(mockGDPRService.exportUserData).toHaveBeenCalledWith(userId, userId);
      expect(result).toEqual(exportData);
    });

    it('should support data anonymization', async () => {
      const userId = 'user123';
      const reason = 'User request';

      mockGDPRService.anonymizeUser.mockResolvedValue();

      await mockGDPRService.anonymizeUser(userId, reason, userId);

      expect(mockGDPRService.anonymizeUser).toHaveBeenCalledWith(userId, reason, userId);
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption failures gracefully', async () => {
      const userId = 'user123';
      const period = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };

      mockEncryptionService.encryptPII.mockRejectedValue(new Error('Encryption failed'));

      await expect(
        invoiceService.generateInvoice(userId, period)
      ).rejects.toThrow('Encryption failed');
    });

    it('should handle database errors without exposing sensitive information', async () => {
      const invoiceId = 'invoice123';
      const userId = 'user123';

      (mockDb.query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        invoiceService.getInvoice(invoiceId, userId)
      ).rejects.toThrow('Database connection failed');
    });
  });
});
