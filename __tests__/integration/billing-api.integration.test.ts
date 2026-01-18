import { Pool } from 'pg';
import { InvoiceStatus, PaymentStatus, BillingPeriodType } from '../../src/types/invoice.types';

describe('Billing API Integration Tests', () => {
  let db: Pool;
  let testUserId: string;
  let testApiKey: string;

  beforeAll(async () => {
    db = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/twinmcp_test'
    });

    testUserId = 'test-user-integration';
    testApiKey = 'test-api-key-integration';
  });

  afterAll(async () => {
    if (db) {
      await db.end();
    }
  });

  beforeEach(async () => {
    await db.query('BEGIN');
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
  });

  describe('POST /api/billing/invoices', () => {
    it('should create invoice for user', async () => {
      const response = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          userId: testUserId,
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoice).toBeDefined();
      expect(data.invoice.userId).toBe(testUserId);
      expect(data.invoice.status).toBe(InvoiceStatus.DRAFT);
    });

    it('should return 400 for missing userId', async () => {
      const response = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUserId,
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should retrieve user invoices', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices?userId=${testUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${testApiKey}`
          }
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoices).toBeDefined();
      expect(Array.isArray(data.invoices)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices?userId=${testUserId}&status=${InvoiceStatus.PAID}`,
        {
          headers: {
            'Authorization': `Bearer ${testApiKey}`
          }
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoices).toBeDefined();
    });
  });

  describe('POST /api/billing/payments', () => {
    it('should create payment for invoice', async () => {
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          userId: testUserId,
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      const invoiceData = await invoiceResponse.json();
      const invoiceId = invoiceData.invoice.id;

      const paymentResponse = await fetch('http://localhost:3000/api/billing/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          invoiceId,
          userId: testUserId,
          amount: 36.06,
          currency: 'EUR',
          provider: 'stripe',
          paymentMethodId: 'pm_test_123'
        })
      });

      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData.payment).toBeDefined();
      expect(paymentData.payment.invoiceId).toBe(invoiceId);
    });

    it('should return 400 for invalid amount', async () => {
      const response = await fetch('http://localhost:3000/api/billing/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          invoiceId: 'test-invoice',
          userId: testUserId,
          amount: -10,
          currency: 'EUR',
          provider: 'stripe',
          paymentMethodId: 'pm_test_123'
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/billing/invoices/[id]/pdf', () => {
    it('should generate PDF for invoice', async () => {
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          userId: testUserId,
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      const invoiceData = await invoiceResponse.json();
      const invoiceId = invoiceData.invoice.id;

      const pdfResponse = await fetch(
        `http://localhost:3000/api/billing/invoices/${invoiceId}/pdf?userId=${testUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${testApiKey}`
          }
        }
      );

      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers.get('content-type')).toBe('application/pdf');
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices/non-existent-id/pdf?userId=${testUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${testApiKey}`
          }
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Webhook Integration', () => {
    it('should handle Stripe webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 3606,
            currency: 'eur',
            status: 'succeeded'
          }
        }
      };

      const response = await fetch('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test-signature'
        },
        body: JSON.stringify(webhookPayload)
      });

      expect([200, 400]).toContain(response.status);
    });

    it('should handle PayPal webhook', async () => {
      const webhookPayload = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'capture_test_123',
          amount: {
            value: '36.06',
            currency_code: 'EUR'
          },
          status: 'COMPLETED'
        }
      };

      const response = await fetch('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('End-to-End Billing Flow', () => {
    it('should complete full billing cycle', async () => {
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testApiKey}`
        },
        body: JSON.stringify({
          userId: testUserId,
          period: {
            type: BillingPeriodType.MONTHLY,
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        })
      });

      expect(invoiceResponse.status).toBe(200);
      const invoiceData = await invoiceResponse.json();
      const invoice = invoiceData.invoice;

      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.total).toBeGreaterThan(0);

      const pdfResponse = await fetch(
        `http://localhost:3000/api/billing/invoices/${invoice.id}/pdf?userId=${testUserId}`,
        {
          headers: {
            'Authorization': `Bearer ${testApiKey}`
          }
        }
      );

      expect(pdfResponse.status).toBe(200);
    });
  });
});
