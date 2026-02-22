// @ts-nocheck
jest.mock('../../src/services/pdf.service', () => ({
  PDFService: jest.fn().mockImplementation(() => ({
    generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content'))
  }))
}));

jest.mock('../../src/services/invoice-storage.service', () => ({
  InvoiceStorageService: jest.fn().mockImplementation(() => ({
    getPDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    storePDF: jest.fn().mockResolvedValue(undefined)
  }))
}));

import { InvoiceService } from '../../src/services/invoice.service';
import { InvoiceStatus, BillingPeriodType } from '../../src/types/invoice.types';
import {
  mockPool,
  mockEncryptionService,
  mockAuditService,
  mockGDPRService,
  mockDataMaskingService
} from '../mocks/billing.mocks';
import {
  testUserId,
  testInvoiceId,
  testBillingPeriod,
  testInvoice,
  testUsageData,
  testCustomerInfo,
  testUserPricing,
  mockDatabaseRows
} from '../fixtures/billing.fixtures';

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService = new InvoiceService(
      mockPool,
      mockEncryptionService as any,
      mockAuditService as any,
      mockGDPRService as any,
      mockDataMaskingService as any
    );
  });

  describe('generateInvoice', () => {
    beforeEach(() => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: testUsageData.tools })
        .mockResolvedValueOnce({ rows: [{ ...mockDatabaseRows.user, tier: 'basic' }] })
        .mockResolvedValueOnce({ rows: [mockDatabaseRows.user] })
        .mockResolvedValueOnce({ rows: [mockDatabaseRows.userProfile] })
        .mockResolvedValueOnce({ rows: [] });
    });

    it('should generate invoice successfully', async () => {
      const invoice = await invoiceService.generateInvoice(
        testUserId,
        testBillingPeriod,
        undefined,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(invoice).toBeDefined();
      expect(invoice.userId).toBe(testUserId);
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.items.length).toBeGreaterThan(0);
      expect(invoice.total).toBeGreaterThan(0);
      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        testUserId,
        'invoice',
        'generation',
        'generate',
        '127.0.0.1',
        'test-agent'
      );
    });

    it('should throw error if invoice already exists', async () => {
      mockPool.query.mockReset();
      mockPool.query.mockResolvedValueOnce({ rows: [mockDatabaseRows.invoice] });

      await expect(
        invoiceService.generateInvoice(testUserId, testBillingPeriod)
      ).rejects.toThrow('Invoice already exists');
    });

    it('should force regenerate if option is set', async () => {
      mockPool.query.mockReset();
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockDatabaseRows.invoice] })
        .mockResolvedValueOnce({ rows: testUsageData.tools })
        .mockResolvedValueOnce({ rows: [{ ...mockDatabaseRows.user, tier: 'basic' }] })
        .mockResolvedValueOnce({ rows: [mockDatabaseRows.user] })
        .mockResolvedValueOnce({ rows: [mockDatabaseRows.userProfile] })
        .mockResolvedValueOnce({ rows: [] });

      const invoice = await invoiceService.generateInvoice(
        testUserId,
        testBillingPeriod,
        { forceRegenerate: true }
      );

      expect(invoice).toBeDefined();
      expect(invoice.userId).toBe(testUserId);
    });

    it('should throw error for invalid userId', async () => {
      await expect(
        invoiceService.generateInvoice('', testBillingPeriod)
      ).rejects.toThrow('Invalid userId');
    });

    it('should throw error for invalid period', async () => {
      const invalidPeriod = {
        type: 'invalid' as any,
        startDate: new Date(),
        endDate: new Date()
      };

      await expect(
        invoiceService.generateInvoice(testUserId, invalidPeriod)
      ).rejects.toThrow('Invalid billing period type');
    });

    it('should calculate correct tax and total', async () => {
      const invoice = await invoiceService.generateInvoice(testUserId, testBillingPeriod);

      expect(invoice.tax).toBe(invoice.subtotal * 0.2);
      expect(invoice.total).toBe(invoice.subtotal + invoice.tax);
    });

    it('should encrypt customer info', async () => {
      await invoiceService.generateInvoice(testUserId, testBillingPeriod);

      expect(mockEncryptionService.encryptPII).toHaveBeenCalled();
    });

    it('should mask usage data for logging', async () => {
      await invoiceService.generateInvoice(testUserId, testBillingPeriod);

      expect(mockDataMaskingService.maskForLogging).toHaveBeenCalled();
    });
  });

  describe('getInvoice', () => {
    beforeEach(() => {
      mockPool.query.mockReset();
    });

    it('should retrieve invoice by id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDatabaseRows.invoice] });

      const invoice = await invoiceService.getInvoice(
        testInvoiceId,
        testUserId,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(invoice).toBeDefined();
      expect(invoice?.id).toBe(testInvoiceId);
      expect(invoice?.userId).toBe(testUserId);
      expect(mockAuditService.logAccess).toHaveBeenCalledWith(
        testUserId,
        'invoice',
        testInvoiceId,
        'read',
        '127.0.0.1',
        'test-agent'
      );
    });

    it('should return null if invoice not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const invoice = await invoiceService.getInvoice(testInvoiceId);

      expect(invoice).toBeNull();
    });

    it('should throw error if invoiceId is missing', async () => {
      await expect(
        invoiceService.getInvoice('')
      ).rejects.toThrow('invoiceId is required');
    });

    it('should decrypt customer info if encrypted', async () => {
      const encryptedInvoice = {
        ...mockDatabaseRows.invoice,
        metadata: JSON.stringify({
          ...testInvoice.metadata,
          customerInfo: { encrypted: 'encrypted_data' }
        })
      };
      mockPool.query.mockResolvedValueOnce({ rows: [encryptedInvoice] });

      await invoiceService.getInvoice(testInvoiceId);

      expect(mockEncryptionService.decryptPII).toHaveBeenCalled();
    });
  });

  describe('getUserInvoices', () => {
    beforeEach(() => {
      mockPool.query.mockReset();
    });

    it('should retrieve all invoices for user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockDatabaseRows.invoice, mockDatabaseRows.invoice]
      });

      const invoices = await invoiceService.getUserInvoices(testUserId);

      expect(invoices).toHaveLength(2);
      expect(invoices[0].userId).toBe(testUserId);
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [mockDatabaseRows.invoice]
      });

      const invoices = await invoiceService.getUserInvoices(
        testUserId,
        InvoiceStatus.DRAFT
      );

      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe(InvoiceStatus.DRAFT);
    });

    it('should respect limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await invoiceService.getUserInvoices(testUserId, undefined, 10, 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([testUserId, 10, 5])
      );
    });
  });

  describe('updateInvoiceStatus', () => {
    beforeEach(() => {
      mockPool.query.mockReset();
    });

    it('should update invoice status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await invoiceService.updateInvoiceStatus(
        testInvoiceId,
        InvoiceStatus.PAID
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.arrayContaining([InvoiceStatus.PAID, expect.any(Date), testInvoiceId])
      );
    });

    it('should set paid_at when status is PAID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await invoiceService.updateInvoiceStatus(
        testInvoiceId,
        InvoiceStatus.PAID
      );

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[1]).toBeInstanceOf(Date);
    });

    it('should throw error if invoiceId is missing', async () => {
      await expect(
        invoiceService.updateInvoiceStatus('', InvoiceStatus.PAID)
      ).rejects.toThrow('invoiceId is required');
    });

    it('should update metadata if provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const metadata = { paymentId: 'payment-123' };

      await invoiceService.updateInvoiceStatus(
        testInvoiceId,
        InvoiceStatus.PAID,
        metadata
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(metadata)])
      );
    });
  });

  describe('generateInvoicePDF', () => {
    beforeEach(() => {
      mockPool.query.mockReset();
    });

    it('should generate PDF for invoice', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockDatabaseRows.invoice] });

      const pdf = await invoiceService.generateInvoicePDF(testInvoiceId);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should throw error if invoice not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        invoiceService.generateInvoicePDF(testInvoiceId)
      ).rejects.toThrow('Invoice not found');
    });
  });

  describe('private methods validation', () => {
    it('should validate userId correctly', async () => {
      await expect(
        invoiceService.generateInvoice(null as any, testBillingPeriod)
      ).rejects.toThrow('Invalid userId');

      await expect(
        invoiceService.generateInvoice('   ', testBillingPeriod)
      ).rejects.toThrow('Invalid userId');
    });

    it('should validate period dates', async () => {
      const invalidPeriod = {
        type: BillingPeriodType.MONTHLY,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-01-01')
      };

      await expect(
        invoiceService.generateInvoice(testUserId, invalidPeriod)
      ).rejects.toThrow('Invalid billing period range');
    });
  });
});
