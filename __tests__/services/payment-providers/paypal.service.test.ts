// @ts-nocheck
import { PayPalService } from '../../../src/services/payment-providers/paypal.service';
import axios from 'axios';

// Mock axios.create to return a mock instance
const mockPost = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      post: mockPost,
    })),
    post: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PayPalService', () => {
  let paypalService: PayPalService;

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
    process.env.PAYPAL_MODE = 'sandbox';
    process.env.PAYPAL_WEBHOOK_ID = 'test_webhook_id';

    jest.clearAllMocks();
    paypalService = new PayPalService();
  });

  describe('getAccessToken', () => {
    it('should authenticate successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const token = await (paypalService as any).getAccessToken();

      expect(token).toBe('test_access_token');
    });

    it('should handle authentication errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Authentication failed'));

      await expect((paypalService as any).getAccessToken()).rejects.toThrow(
        'Authentication failed'
      );
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      // Mock getAccessToken
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      const mockOrderResponse = {
        data: {
          id: 'ORDER_123',
          status: 'CREATED',
          purchase_units: [{ amount: { currency_code: 'EUR', value: '100.00' } }],
        },
      };

      mockPost.mockResolvedValueOnce(mockOrderResponse);

      const result = await paypalService.createOrder(100, 'EUR', 'inv_123', 'user_123');

      expect(result).toMatchObject({
        id: 'ORDER_123',
        status: 'CREATED',
      });
    });
  });

  describe('captureOrder', () => {
    it('should capture an order successfully', async () => {
      // Mock getAccessToken
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      const mockCaptureResponse = {
        data: {
          id: 'ORDER_123',
          status: 'COMPLETED',
          purchase_units: [
            { amount: { currency_code: 'EUR', value: '100.00' } },
          ],
        },
      };

      mockPost.mockResolvedValueOnce(mockCaptureResponse);

      const result = await paypalService.captureOrder('ORDER_123');

      expect(result).toMatchObject({
        id: 'ORDER_123',
        status: 'COMPLETED',
      });
    });

    it('should handle capture failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      mockPost.mockRejectedValueOnce(new Error('Capture failed'));

      await expect(paypalService.captureOrder('ORDER_123')).rejects.toThrow('Capture failed');
    });
  });

  describe('createRefund', () => {
    it('should refund payment successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      const mockRefundResponse = {
        data: {
          id: 'REFUND_123',
          status: 'COMPLETED',
        },
      };

      mockPost.mockResolvedValueOnce(mockRefundResponse);

      const result = await paypalService.createRefund('CAPTURE_123', 50, 'EUR');

      expect(result).toMatchObject({
        id: 'REFUND_123',
        status: 'COMPLETED',
      });
    });
  });

  describe('verifyWebhook', () => {
    it('should verify webhook signature successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      const mockVerifyResponse = {
        data: {
          verification_status: 'SUCCESS',
        },
      };

      mockPost.mockResolvedValueOnce(mockVerifyResponse);

      const result = await paypalService.verifyWebhook(
        'test_webhook_id',
        {
          'paypal-transmission-id': 'test_id',
          'paypal-transmission-time': 'test_time',
          'paypal-transmission-sig': 'test_sig',
          'paypal-cert-url': 'test_url',
          'paypal-auth-algo': 'test_algo',
        },
        { event_type: 'PAYMENT.CAPTURE.COMPLETED' }
      );

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test_token', token_type: 'Bearer', expires_in: 3600 },
      });

      const mockVerifyResponse = {
        data: {
          verification_status: 'FAILURE',
        },
      };

      mockPost.mockResolvedValueOnce(mockVerifyResponse);

      const result = await paypalService.verifyWebhook('test_webhook_id', {}, {});

      expect(result).toBe(false);
    });
  });
});
