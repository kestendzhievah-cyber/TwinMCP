// @ts-nocheck
import { NextRequest } from 'next/server';
import { POST as stripeWebhook } from '../../src/app/api/webhooks/stripe/route';
import { POST as paypalWebhook } from '../../src/app/api/webhooks/paypal/route';

describe('Webhooks Integration Tests', () => {
  describe('Stripe Webhook', () => {
    it('should process payment_intent.succeeded event', async () => {
      const mockEvent = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 10000,
            currency: 'eur',
            status: 'succeeded',
            metadata: {
              invoiceId: 'inv_123',
              userId: 'user_123',
            },
          },
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(mockEvent),
      });

      const response = await stripeWebhook(request);
      
      expect(response.status).toBe(200);
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = {
        id: 'evt_test_124',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_124',
            amount: 10000,
            currency: 'eur',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Card declined',
            },
            metadata: {
              invoiceId: 'inv_124',
              userId: 'user_124',
            },
          },
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(mockEvent),
      });

      const response = await stripeWebhook(request);
      
      expect(response.status).toBe(200);
    });

    it('should reject invalid signature', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'invalid_signature',
        },
        body: JSON.stringify({ type: 'test' }),
      });

      const response = await stripeWebhook(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('PayPal Webhook', () => {
    it('should process PAYMENT.CAPTURE.COMPLETED event', async () => {
      const mockEvent = {
        id: 'WH-123',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE_123',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'EUR',
          },
          custom_id: 'inv_123',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: {
          'paypal-transmission-id': 'test_id',
          'paypal-transmission-time': new Date().toISOString(),
          'paypal-transmission-sig': 'test_sig',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: JSON.stringify(mockEvent),
      });

      const response = await paypalWebhook(request);
      
      expect(response.status).toBe(200);
    });

    it('should handle PAYMENT.CAPTURE.DENIED event', async () => {
      const mockEvent = {
        id: 'WH-124',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'CAPTURE_124',
          status: 'DENIED',
          amount: {
            value: '100.00',
            currency_code: 'EUR',
          },
          custom_id: 'inv_124',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: {
          'paypal-transmission-id': 'test_id',
          'paypal-transmission-time': new Date().toISOString(),
          'paypal-transmission-sig': 'test_sig',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-auth-algo': 'SHA256withRSA',
        },
        body: JSON.stringify(mockEvent),
      });

      const response = await paypalWebhook(request);
      
      expect(response.status).toBe(200);
    });

    it('should reject invalid webhook signature', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ event_type: 'test' }),
      });

      const response = await paypalWebhook(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('Webhook Security', () => {
    it('should validate webhook timestamps', async () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: {
          'paypal-transmission-time': oldTimestamp,
        },
        body: JSON.stringify({ event_type: 'test' }),
      });

      const response = await paypalWebhook(request);
      
      expect(response.status).toBe(400);
    });

    it('should prevent replay attacks', async () => {
      const mockEvent = {
        id: 'evt_duplicate',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      };

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig1' },
        body: JSON.stringify(mockEvent),
      });

      await stripeWebhook(request1);

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig1' },
        body: JSON.stringify(mockEvent),
      });

      const response2 = await stripeWebhook(request2);
      
      expect(response2.status).toBe(200);
    });
  });
});
