import { logger } from '../../utils/logger';
import Stripe from 'stripe';
import { Payment, PaymentMethod, PaymentStatus } from '../../types/invoice.types';

export class StripeService {
  private stripe: Stripe | null = null;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      logger.warn('⚠️ STRIPE_SECRET_KEY is not configured — Stripe features will be unavailable');
    }
  }

  private getClient(): Stripe {
    if (!this.stripe) {
      const apiKey = process.env.STRIPE_SECRET_KEY;
      if (!apiKey) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
      }
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-09-30.clover'
      });
    }
    return this.stripe;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    paymentMethodId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.getClient().paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        },
        metadata: metadata || {}
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      throw error;
    }
  }

  async processPayment(payment: Payment): Promise<Payment> {
    try {
      const paymentIntent = await this.createPaymentIntent(
        payment.amount,
        payment.currency,
        payment.method.id,
        {
          invoiceId: payment.invoiceId,
          userId: payment.userId,
          paymentId: payment.id
        }
      );

      return {
        ...payment,
        status: this.mapStripeStatus(paymentIntent.status),
        providerTransactionId: paymentIntent.id,
        processedAt: paymentIntent.status === 'succeeded' ? new Date() : undefined,
        metadata: {
          ...payment.metadata,
          stripePaymentIntent: paymentIntent.id,
          stripeStatus: paymentIntent.status
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
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.getClient().refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer'
      });

      return refund;
    } catch (error) {
      logger.error('Stripe refund creation failed:', error);
      throw error;
    }
  }

  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.getClient().customers.create({
        email,
        name,
        metadata: metadata || {}
      });

      return customer;
    } catch (error) {
      logger.error('Stripe customer creation failed:', error);
      throw error;
    }
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.getClient().paymentMethods.attach(
        paymentMethodId,
        { customer: customerId }
      );

      return paymentMethod;
    } catch (error) {
      logger.error('Stripe payment method attachment failed:', error);
      throw error;
    }
  }

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.getClient().setupIntents.create({
        customer: customerId,
        payment_method_types: ['card']
      });

      return setupIntent;
    } catch (error) {
      logger.error('Stripe setup intent creation failed:', error);
      throw error;
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.getClient().paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Stripe payment intent retrieval failed:', error);
      throw error;
    }
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      return this.getClient().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      logger.error('Stripe webhook verification failed:', error);
      throw error;
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return PaymentStatus.COMPLETED;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.PENDING;
      case 'canceled':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
