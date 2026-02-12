import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { 
  Payment, 
  PaymentStatus, 
  PaymentMethod,
  PaymentProvider,
  Invoice
} from '../types/invoice.types';
import { PaymentProviderFactory } from './payment-providers';

export class PaymentService {
  constructor(private db: Pool) {}

  async createPayment(
    invoiceId: string,
    userId: string,
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    provider: PaymentProvider = PaymentProvider.STRIPE
  ): Promise<Payment> {
    const payment: Payment = {
      id: randomUUID(),
      invoiceId,
      userId,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      method: paymentMethod,
      provider,
      createdAt: new Date(),
      metadata: {
        provider,
        paymentMethod: paymentMethod.type
      }
    };

    await this.savePayment(payment);

    // Process payment with provider
    try {
      const processedPayment = await this.processPaymentWithProvider(payment);
      await this.updatePaymentStatus(payment.id, processedPayment.status, processedPayment.providerTransactionId);
      return processedPayment;
    } catch (error) {
      await this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, undefined, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error');
      throw error;
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    const result = await this.db.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as PaymentStatus,
      method: JSON.parse(row.payment_method),
      provider: row.provider,
      providerTransactionId: row.provider_transaction_id,
      failureReason: row.failure_reason,
      refundedAmount: row.refunded_amount ? parseFloat(row.refunded_amount) : undefined,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      metadata: JSON.parse(row.metadata)
    };
  }

  async getPaymentByProviderTransactionId(providerTransactionId: string): Promise<Payment | null> {
    const result = await this.db.query(
      'SELECT * FROM payments WHERE provider_transaction_id = $1',
      [providerTransactionId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as PaymentStatus,
      method: JSON.parse(row.payment_method),
      provider: row.provider,
      providerTransactionId: row.provider_transaction_id,
      failureReason: row.failure_reason,
      refundedAmount: row.refunded_amount ? parseFloat(row.refunded_amount) : undefined,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      metadata: JSON.parse(row.metadata)
    };
  }

  async getUserPayments(userId: string, limit = 50, offset = 0): Promise<Payment[]> {
    const result = await this.db.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return result.rows.map(row => ({
      id: row.id,
      invoiceId: row.invoice_id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as PaymentStatus,
      method: JSON.parse(row.payment_method),
      provider: row.provider,
      providerTransactionId: row.provider_transaction_id,
      failureReason: row.failure_reason,
      refundedAmount: row.refunded_amount ? parseFloat(row.refunded_amount) : undefined,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      metadata: JSON.parse(row.metadata)
    }));
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Payment cannot be refunded');
    }

    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    // Process refund with provider
    const refundResult = await this.processRefundWithProvider(payment, refundAmount);

    await this.db.query(
      `UPDATE payments 
       SET refunded_amount = COALESCE(refunded_amount, 0) + $1, 
           metadata = metadata || '{}'::jsonb || $2::jsonb,
           updated_at = NOW()
       WHERE id = $3`,
      [refundAmount, JSON.stringify({
        ...payment.metadata,
        refund: {
          amount: refundAmount,
          date: new Date(),
          reason: refundResult.reason
        }
      }), paymentId]
    );

    const updatedPayment = await this.getPayment(paymentId);
    if (!updatedPayment) {
      throw new Error('Payment not found after refund');
    }
    return updatedPayment;
  }

  private async savePayment(payment: Payment): Promise<void> {
    await this.db.query(
      `INSERT INTO payments (
        id, invoice_id, user_id, amount, currency, status, 
        payment_method, provider, provider_transaction_id, 
        failure_reason, refunded_amount, created_at, processed_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        payment.id,
        payment.invoiceId,
        payment.userId,
        payment.amount,
        payment.currency,
        payment.status,
        JSON.stringify(payment.method),
        payment.provider,
        payment.providerTransactionId,
        payment.failureReason,
        payment.refundedAmount,
        payment.createdAt,
        payment.processedAt,
        JSON.stringify(payment.metadata)
      ]
    );
  }

  async updatePaymentStatus(
    paymentId: string, 
    status: PaymentStatus, 
    providerTransactionId?: string,
    failureReason?: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE payments 
       SET status = $1, 
           provider_transaction_id = COALESCE($2, provider_transaction_id),
           failure_reason = COALESCE($3, failure_reason),
           processed_at = CASE WHEN $4 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $5`,
      [status, providerTransactionId, failureReason, status, paymentId]
    );
  }

  private async processPaymentWithProvider(payment: Payment): Promise<Payment> {
    try {
      const processedPayment = await PaymentProviderFactory.processPayment(payment);
      return processedPayment;
    } catch (error) {
      console.error('Payment provider processing failed:', error);
      return {
        ...payment,
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
        metadata: {
          ...payment.metadata,
          error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
        }
      };
    }
  }

  private async processRefundWithProvider(payment: Payment, amount: number): Promise<{ reason: string }> {
    try {
      const provider = PaymentProviderFactory.getProvider(payment.provider);
      
      if (!payment.providerTransactionId) {
        throw new Error('No provider transaction ID found');
      }

      if (payment.provider === 'stripe' && 'createRefund' in provider) {
        await provider.createRefund(payment.providerTransactionId, amount);
      } else if (payment.provider === 'paypal' && 'createRefund' in provider) {
        await provider.createRefund(payment.providerTransactionId, amount, payment.currency);
      } else if (payment.provider === 'wise' && 'cancelTransfer' in provider) {
        await provider.cancelTransfer(payment.providerTransactionId);
      }

      return {
        reason: 'Customer requested refund'
      };
    } catch (error) {
      console.error('Refund processing failed:', error);
      throw error;
    }
  }
}
