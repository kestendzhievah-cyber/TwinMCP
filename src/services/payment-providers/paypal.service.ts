import axios, { AxiosInstance } from 'axios';
import { Payment, PaymentStatus } from '../../types/invoice.types';

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrder {
  id: string;
  status: string;
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
  }>;
}

export class PayPalService {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.baseUrl = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal credentials are not configured');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post<PayPalAccessToken>(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const token = response.data.access_token;
      this.accessToken = token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
      
      return token;
    } catch (error) {
      console.error('PayPal authentication failed:', error);
      throw error;
    }
  }

  async createOrder(
    amount: number,
    currency: string,
    invoiceId: string,
    userId: string
  ): Promise<PayPalOrder> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.client.post<PayPalOrder>(
        '/v2/checkout/orders',
        {
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: invoiceId,
            custom_id: userId,
            amount: {
              currency_code: currency.toUpperCase(),
              value: amount.toFixed(2)
            }
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PayPal order creation failed:', error);
      throw error;
    }
  }

  async captureOrder(orderId: string): Promise<PayPalOrder> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.client.post<PayPalOrder>(
        `/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PayPal order capture failed:', error);
      throw error;
    }
  }

  async processPayment(payment: Payment): Promise<Payment> {
    try {
      const order = await this.createOrder(
        payment.amount,
        payment.currency,
        payment.invoiceId,
        payment.userId
      );

      const capturedOrder = await this.captureOrder(order.id);

      return {
        ...payment,
        status: this.mapPayPalStatus(capturedOrder.status),
        providerTransactionId: capturedOrder.id,
        processedAt: capturedOrder.status === 'COMPLETED' ? new Date() : undefined,
        metadata: {
          ...payment.metadata,
          paypalOrderId: capturedOrder.id,
          paypalStatus: capturedOrder.status
        }
      };
    } catch (error) {
      return {
        ...payment,
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          ...payment.metadata,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async createRefund(
    captureId: string,
    amount?: number,
    currency?: string
  ): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const refundData: any = {};
      if (amount && currency) {
        refundData.amount = {
          value: amount.toFixed(2),
          currency_code: currency.toUpperCase()
        };
      }

      const response = await this.client.post(
        `/v2/payments/captures/${captureId}/refund`,
        refundData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PayPal refund creation failed:', error);
      throw error;
    }
  }

  async verifyWebhook(
    webhookId: string,
    headers: Record<string, string>,
    body: any
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.client.post(
        '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: body
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('PayPal webhook verification failed:', error);
      return false;
    }
  }

  private mapPayPalStatus(paypalStatus: string): PaymentStatus {
    switch (paypalStatus) {
      case 'COMPLETED':
        return PaymentStatus.COMPLETED;
      case 'APPROVED':
        return PaymentStatus.PROCESSING;
      case 'CREATED':
      case 'SAVED':
        return PaymentStatus.PENDING;
      case 'VOIDED':
      case 'PAYER_ACTION_REQUIRED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
