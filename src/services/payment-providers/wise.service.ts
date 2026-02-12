import { Payment, PaymentStatus } from '../../types/invoice.types';

interface WiseQuote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  fee: number;
}

interface WiseTransfer {
  id: string;
  status: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceValue: number;
  targetValue: number;
}

export class WiseService {
  private apiKey: string;
  private baseUrl: string;
  private profileId: string;

  constructor() {
    this.apiKey = process.env.WISE_API_KEY || '';
    this.profileId = process.env.WISE_PROFILE_ID || '';
    this.baseUrl = process.env.WISE_MODE === 'live'
      ? 'https://api.transferwise.com'
      : 'https://api.sandbox.transferwise.tech';

    if (!this.apiKey || !this.profileId) {
      console.warn('⚠️ Wise credentials are not configured — Wise features will be unavailable');
    }
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        throw new Error(`Wise API error: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error('Wise API request failed:', error);
      throw error;
    }
  }

  async createQuote(
    sourceCurrency: string,
    targetCurrency: string,
    sourceAmount: number
  ): Promise<WiseQuote> {
    try {
      return await this.makeRequest<WiseQuote>('POST', '/v2/quotes', {
        sourceCurrency: sourceCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
        sourceAmount,
        profile: this.profileId,
        paymentMetadata: {
          transferPurpose: 'VERIFICATION_OF_ACCOUNT_OWNERSHIP'
        }
      });
    } catch (error) {
      console.error('Wise quote creation failed:', error);
      throw error;
    }
  }

  async createTransfer(
    quoteId: string,
    recipientAccountId: string,
    reference: string
  ): Promise<WiseTransfer> {
    try {
      return await this.makeRequest<WiseTransfer>('POST', '/v1/transfers', {
        targetAccount: recipientAccountId,
        quoteUuid: quoteId,
        customerTransactionId: reference,
        details: {
          reference
        }
      });
    } catch (error) {
      console.error('Wise transfer creation failed:', error);
      throw error;
    }
  }

  async fundTransfer(transferId: string): Promise<any> {
    try {
      return await this.makeRequest('POST', `/v3/profiles/${this.profileId}/transfers/${transferId}/payments`, {
        type: 'BALANCE'
      });
    } catch (error) {
      console.error('Wise transfer funding failed:', error);
      throw error;
    }
  }

  async getTransferStatus(transferId: string): Promise<WiseTransfer> {
    try {
      return await this.makeRequest<WiseTransfer>('GET', `/v1/transfers/${transferId}`);
    } catch (error) {
      console.error('Wise transfer status retrieval failed:', error);
      throw error;
    }
  }

  async processPayment(payment: Payment): Promise<Payment> {
    try {
      const quote = await this.createQuote(
        payment.currency,
        payment.currency,
        payment.amount
      );

      const recipientAccountId = payment.metadata?.wiseRecipientId;
      if (!recipientAccountId) {
        throw new Error('Wise recipient account ID not found');
      }

      const transfer = await this.createTransfer(
        quote.id,
        recipientAccountId,
        `Invoice-${payment.invoiceId}`
      );

      await this.fundTransfer(transfer.id);

      const status = await this.getTransferStatus(transfer.id);

      return {
        ...payment,
        status: this.mapWiseStatus(status.status),
        providerTransactionId: transfer.id,
        processedAt: status.status === 'outgoing_payment_sent' ? new Date() : undefined,
        metadata: {
          ...payment.metadata,
          wiseTransferId: transfer.id,
          wiseQuoteId: quote.id,
          wiseStatus: status.status
        }
      };
    } catch (error) {
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

  async cancelTransfer(transferId: string): Promise<void> {
    try {
      await this.makeRequest('PUT', `/v1/transfers/${transferId}/cancel`, {});
    } catch (error) {
      console.error('Wise transfer cancellation failed:', error);
      throw error;
    }
  }

  private mapWiseStatus(wiseStatus: string): PaymentStatus {
    switch (wiseStatus) {
      case 'outgoing_payment_sent':
      case 'funds_converted':
        return PaymentStatus.COMPLETED;
      case 'processing':
      case 'funds_refunded':
        return PaymentStatus.PROCESSING;
      case 'incoming_payment_waiting':
      case 'waiting_recipient_input_to_proceed':
        return PaymentStatus.PENDING;
      case 'cancelled':
      case 'bounced_back':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
