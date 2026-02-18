// @ts-nocheck
import { PayPalService } from '../../../src/services/payment-providers/paypal.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PayPalService', () => {
  let paypalService: PayPalService;

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
    process.env.PAYPAL_MODE = 'sandbox';
    process.env.PAYPAL_WEBHOOK_ID = 'test_webhook_id';

    paypalService = new PayPalService();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: 3600,
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const token = await (paypalService as any).authenticate();

      expect(token).toBe('test_access_token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        'grant_type=client_credentials',
        expect.objectContaining({
          auth: {
            username: 'test_client_id',
            password: 'test_client_secret',
          },
        })
      );
    });

    it('should handle authentication errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Authentication failed'));

      await expect((paypalService as any).authenticate()).rejects.toThrow(
        'Authentication failed'
      );
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };
      const mockOrderResponse = {
        data: {
          id: 'ORDER_123',
          status: 'CREATED',
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockOrderResponse);

      const result = await paypalService.createOrder({
        amount: 100,
        currency: 'EUR',
        description: 'Test payment',
      });

      expect(result).toEqual({
        orderId: 'ORDER_123',
        status: 'CREATED',
      });
    });
  });

  describe('captureOrder', () => {
    it('should capture an order successfully', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };
      const mockCaptureResponse = {
        data: {
          id: 'ORDER_123',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE_123',
                    status: 'COMPLETED',
                  },
                ],
              },
            },
          ],
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockCaptureResponse);

      const result = await paypalService.captureOrder('ORDER_123');

      expect(result).toEqual({
        success: true,
        transactionId: 'CAPTURE_123',
        status: 'COMPLETED',
      });
    });

    it('should handle capture failure', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockRejectedValueOnce(new Error('Capture failed'));

      const result = await paypalService.captureOrder('ORDER_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Capture failed');
    });
  });

  describe('refundPayment', () => {
    it('should refund payment successfully', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };
      const mockRefundResponse = {
        data: {
          id: 'REFUND_123',
          status: 'COMPLETED',
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockRefundResponse);

      const result = await paypalService.refundPayment('CAPTURE_123', 50);

      expect(result).toEqual({
        success: true,
        refundId: 'REFUND_123',
        status: 'COMPLETED',
      });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };
      const mockVerifyResponse = {
        data: {
          verification_status: 'SUCCESS',
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockVerifyResponse);

      const result = await paypalService.verifyWebhookSignature(
        { event_type: 'PAYMENT.CAPTURE.COMPLETED' },
        {
          'paypal-transmission-id': 'test_id',
          'paypal-transmission-time': 'test_time',
          'paypal-transmission-sig': 'test_sig',
          'paypal-cert-url': 'test_url',
          'paypal-auth-algo': 'test_algo',
        }
      );

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', async () => {
      const mockAuthResponse = {
        data: { access_token: 'test_token' },
      };
      const mockVerifyResponse = {
        data: {
          verification_status: 'FAILURE',
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockVerifyResponse);

      const result = await paypalService.verifyWebhookSignature({}, {});

      expect(result).toBe(false);
    });
  });
});
