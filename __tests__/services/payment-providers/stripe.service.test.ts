// @ts-nocheck
import { StripeService } from '../../../src/services/payment-providers/stripe.service';
import Stripe from 'stripe';

jest.mock('stripe');

describe('StripeService', () => {
  let stripeService: StripeService;
  let mockStripe: any;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
    
    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
        confirm: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
      },
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    (Stripe as any).mockImplementation(() => mockStripe);
    stripeService = new StripeService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        amount: 10000,
        currency: 'eur',
        status: 'requires_payment_method',
        client_secret: 'pi_test_123_secret',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent as any);

      const result = await stripeService.createPaymentIntent(
        100,
        'EUR',
        'pm_test_card',
        { invoiceId: 'inv_123' }
      );

      expect(result).toEqual(mockPaymentIntent);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'eur',
        payment_method: 'pm_test_card',
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        },
        metadata: { invoiceId: 'inv_123' },
      });
    });

    it('should handle errors when creating payment intent', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Stripe API error')
      );

      await expect(
        stripeService.createPaymentIntent(100, 'EUR', 'pm_test_card')
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const mockPaymentIntentResult = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 10000,
        currency: 'eur',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntentResult as any);

      const payment = {
        id: 'pay_1',
        invoiceId: 'inv_1',
        userId: 'user_1',
        amount: 100,
        currency: 'eur',
        method: { id: 'pm_test_card' },
        metadata: {},
      };

      const result = await stripeService.processPayment(payment as any);

      expect(result.providerTransactionId).toBe('pi_test_123');
    });

    it('should handle failed payment', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Card declined'));

      const payment = {
        id: 'pay_1',
        invoiceId: 'inv_1',
        userId: 'user_1',
        amount: 100,
        currency: 'eur',
        method: { id: 'pm_test_card' },
        metadata: {},
      };

      const result = await stripeService.processPayment(payment as any);

      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('Card declined');
    });
  });

  describe('createRefund', () => {
    it('should refund payment successfully', async () => {
      const mockRefund = {
        id: 're_test_123',
        status: 'succeeded',
        amount: 10000,
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeService.createRefund('pi_test_123', 100);

      expect(result).toEqual(mockRefund);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 10000,
        reason: 'requested_by_customer',
      });
    });

    it('should handle partial refund', async () => {
      const mockRefund = {
        id: 're_test_123',
        status: 'succeeded',
        amount: 5000,
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeService.createRefund('pi_test_123', 50);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 5000,
        reason: 'requested_by_customer',
      });
    });
  });

  describe('createCustomer', () => {
    it('should create a customer successfully', async () => {
      const mockCustomer = {
        id: 'cus_test_123',
        email: 'test@example.com',
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer as any);

      const result = await stripeService.createCustomer(
        'test@example.com',
        'Test User',
        { userId: 'user_123' }
      );

      expect(result).toEqual(mockCustomer);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should verify webhook signature successfully', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = await stripeService.constructWebhookEvent(
        'payload',
        'signature'
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_mock_secret'
      );
    });

    it('should throw error for invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        stripeService.constructWebhookEvent('payload', 'invalid')
      ).rejects.toThrow('Invalid signature');
    });
  });
});
