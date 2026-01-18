import { StripeService } from '../../../src/services/payment-providers/stripe.service';
import Stripe from 'stripe';

jest.mock('stripe');

describe('StripeService', () => {
  let stripeService: StripeService;
  let mockStripe: jest.Mocked<Stripe>;

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

      const result = await stripeService.createPaymentIntent({
        amount: 100,
        currency: 'EUR',
        metadata: { invoiceId: 'inv_123' },
      });

      expect(result).toEqual({
        id: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        status: 'requires_payment_method',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'eur',
        metadata: { invoiceId: 'inv_123' },
      });
    });

    it('should handle errors when creating payment intent', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Stripe API error')
      );

      await expect(
        stripeService.createPaymentIntent({
          amount: 100,
          currency: 'EUR',
        })
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 10000,
        currency: 'eur',
      };

      mockStripe.paymentIntents.confirm.mockResolvedValue(mockPaymentIntent as any);

      const result = await stripeService.processPayment('pi_test_123', 'pm_test_card');

      expect(result).toEqual({
        success: true,
        transactionId: 'pi_test_123',
        status: 'succeeded',
      });

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith('pi_test_123', {
        payment_method: 'pm_test_card',
      });
    });

    it('should handle failed payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Card declined',
        },
      };

      mockStripe.paymentIntents.confirm.mockResolvedValue(mockPaymentIntent as any);

      const result = await stripeService.processPayment('pi_test_123', 'pm_test_card');

      expect(result).toEqual({
        success: false,
        transactionId: 'pi_test_123',
        status: 'requires_payment_method',
        error: 'Card declined',
      });
    });
  });

  describe('refundPayment', () => {
    it('should refund payment successfully', async () => {
      const mockRefund = {
        id: 're_test_123',
        status: 'succeeded',
        amount: 10000,
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeService.refundPayment('pi_test_123', 100);

      expect(result).toEqual({
        success: true,
        refundId: 're_test_123',
        status: 'succeeded',
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 10000,
      });
    });

    it('should handle partial refund', async () => {
      const mockRefund = {
        id: 're_test_123',
        status: 'succeeded',
        amount: 5000,
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeService.refundPayment('pi_test_123', 50);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 5000,
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

      const result = await stripeService.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user_123' },
      });

      expect(result).toEqual({
        id: 'cus_test_123',
        email: 'test@example.com',
      });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = stripeService.verifyWebhookSignature(
        'payload',
        'signature',
        'whsec_mock_secret'
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_mock_secret'
      );
    });

    it('should throw error for invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() =>
        stripeService.verifyWebhookSignature('payload', 'invalid', 'secret')
      ).toThrow('Invalid signature');
    });
  });
});
