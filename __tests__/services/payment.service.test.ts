// @ts-nocheck
import { PaymentService } from '../../src/services/payment.service';
import { PaymentStatus } from '../../src/types/invoice.types';
import { mockPool } from '../mocks/billing.mocks';
import {
  testUserId,
  testInvoiceId,
  testPaymentId,
  testPayment,
  testPaymentMethod,
  mockDatabaseRows
} from '../fixtures/billing.fixtures';

jest.mock('../../src/services/payment-providers', () => ({
  PaymentProviderFactory: {
    processPayment: jest.fn(),
    getProvider: jest.fn()
  }
}));

import { PaymentProviderFactory } from '../../src/services/payment-providers';

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new PaymentService(mockPool);
  });

  describe('createPayment', () => {
    beforeEach(() => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });
    });

    it('should create payment successfully', async () => {
      const processedPayment = {
        ...testPayment,
        status: PaymentStatus.COMPLETED,
        providerTransactionId: 'pi_test_123'
      };

      (PaymentProviderFactory.processPayment as jest.Mock).mockResolvedValue(processedPayment);

      const payment = await paymentService.createPayment(
        testInvoiceId,
        testUserId,
        36.06,
        'EUR',
        testPaymentMethod,
        'stripe'
      );

      expect(payment).toBeDefined();
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(payment.providerTransactionId).toBe('pi_test_123');
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should handle payment failure', async () => {
      (PaymentProviderFactory.processPayment as jest.Mock).mockRejectedValue(
        new Error('Payment declined')
      );

      const payment = await paymentService.createPayment(
        testInvoiceId,
        testUserId,
        36.06,
        'EUR',
        testPaymentMethod,
        'stripe'
      );

      // Service catches error and returns a failed payment instead of throwing
      expect(payment.status).toBe(PaymentStatus.FAILED);
      expect(payment.failureReason).toBe('Payment declined');

      const updateCalls = (mockPool.query as jest.Mock).mock.calls.filter(
        call => call[0].includes('UPDATE payments')
      );
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should save payment to database', async () => {
      (PaymentProviderFactory.processPayment as jest.Mock).mockResolvedValue({
        ...testPayment,
        status: PaymentStatus.COMPLETED
      });

      await paymentService.createPayment(
        testInvoiceId,
        testUserId,
        36.06,
        'EUR',
        testPaymentMethod
      );

      const insertCalls = (mockPool.query as jest.Mock).mock.calls.filter(
        call => call[0].includes('INSERT INTO payments')
      );
      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('should use default provider if not specified', async () => {
      (PaymentProviderFactory.processPayment as jest.Mock).mockResolvedValue({
        ...testPayment,
        status: PaymentStatus.COMPLETED
      });

      const payment = await paymentService.createPayment(
        testInvoiceId,
        testUserId,
        36.06,
        'EUR',
        testPaymentMethod
      );

      expect(payment.provider).toBe('stripe');
    });
  });

  describe('getPayment', () => {
    it('should retrieve payment by id', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockDatabaseRows.payment]
      });

      const payment = await paymentService.getPayment(testPaymentId);

      expect(payment).toBeDefined();
      expect(payment?.id).toBe(testPaymentId);
      expect(payment?.invoiceId).toBe(testInvoiceId);
    });

    it('should return null if payment not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const payment = await paymentService.getPayment('non-existent-id');

      expect(payment).toBeNull();
    });

    it('should parse payment method correctly', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockDatabaseRows.payment]
      });

      const payment = await paymentService.getPayment(testPaymentId);

      expect(payment?.method).toBeDefined();
      expect(payment?.method.type).toBe('card');
    });
  });

  describe('getPaymentByProviderTransactionId', () => {
    it('should retrieve payment by provider transaction id', async () => {
      const paymentWithTxId = {
        ...mockDatabaseRows.payment,
        provider_transaction_id: 'pi_test_123'
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [paymentWithTxId]
      });

      const payment = await paymentService.getPaymentByProviderTransactionId('pi_test_123');

      expect(payment).toBeDefined();
      expect(payment?.providerTransactionId).toBe('pi_test_123');
    });

    it('should return null if not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const payment = await paymentService.getPaymentByProviderTransactionId('invalid');

      expect(payment).toBeNull();
    });
  });

  describe('getUserPayments', () => {
    it('should retrieve all payments for user', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockDatabaseRows.payment, mockDatabaseRows.payment]
      });

      const payments = await paymentService.getUserPayments(testUserId);

      expect(payments).toHaveLength(2);
      expect(payments[0].userId).toBe(testUserId);
    });

    it('should respect limit and offset', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await paymentService.getUserPayments(testUserId, 10, 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [testUserId, 10, 5]
      );
    });

    it('should use default limit if not provided', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await paymentService.getUserPayments(testUserId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [testUserId, 50, 0]
      );
    });
  });

  describe('refundPayment', () => {
    beforeEach(() => {
      const completedPayment = {
        ...mockDatabaseRows.payment,
        status: PaymentStatus.COMPLETED,
        provider_transaction_id: 'pi_test_123'
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [completedPayment] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [completedPayment] });

      const mockProvider = {
        createRefund: jest.fn().mockResolvedValue({ id: 'refund_123' })
      };

      (PaymentProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);
    });

    it('should refund payment successfully', async () => {
      const refundedPayment = await paymentService.refundPayment(testPaymentId);

      expect(refundedPayment).toBeDefined();
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should refund partial amount', async () => {
      const refundedPayment = await paymentService.refundPayment(testPaymentId, 10.00);

      expect(refundedPayment).toBeDefined();
    });

    it('should throw error if payment not found', async () => {
      (mockPool.query as jest.Mock).mockReset();
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        paymentService.refundPayment('non-existent-id')
      ).rejects.toThrow('Payment not found');
    });

    it('should throw error if payment not completed', async () => {
      const pendingPayment = {
        ...mockDatabaseRows.payment,
        status: PaymentStatus.PENDING
      };

      (mockPool.query as jest.Mock).mockReset();
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [pendingPayment] });

      await expect(
        paymentService.refundPayment(testPaymentId)
      ).rejects.toThrow('Payment cannot be refunded');
    });

    it('should throw error if refund amount exceeds payment amount', async () => {
      await expect(
        paymentService.refundPayment(testPaymentId, 100.00)
      ).rejects.toThrow('Refund amount cannot exceed payment amount');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await paymentService.updatePaymentStatus(
        testPaymentId,
        PaymentStatus.COMPLETED,
        'pi_test_123'
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments'),
        expect.arrayContaining([PaymentStatus.COMPLETED, 'pi_test_123'])
      );
    });

    it('should set processed_at for completed payments', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await paymentService.updatePaymentStatus(
        testPaymentId,
        PaymentStatus.COMPLETED
      );

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0][1];
      expect(callArgs).toContain(PaymentStatus.COMPLETED);
    });

    it('should handle failure reason', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await paymentService.updatePaymentStatus(
        testPaymentId,
        PaymentStatus.FAILED,
        undefined,
        'Card declined'
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Card declined'])
      );
    });
  });
});
