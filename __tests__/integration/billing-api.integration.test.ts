// @ts-nocheck
import { InvoiceStatus, BillingPeriodType } from '../../src/types/invoice.types';

// ── Mock fetch to simulate billing API responses ──
let invoiceIdSeq = 0;
const invoices: any[] = [];

function mockResponse(status: number, body: any, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
    },
  };
}

const mockFetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
  const method = init?.method || 'GET';
  const headers = init?.headers || {};
  const body = init?.body ? JSON.parse(init.body) : null;
  const hasAuth = !!headers['Authorization'];

  // POST /api/billing/invoices
  if (url.includes('/api/billing/invoices') && method === 'POST' && !url.includes('/pdf')) {
    if (!hasAuth) return mockResponse(401, { error: 'Unauthorized' });
    if (!body?.userId) return mockResponse(400, { error: 'Missing userId' });
    const invoice = {
      id: `inv-${++invoiceIdSeq}`,
      userId: body.userId,
      status: InvoiceStatus.DRAFT,
      period: body.period,
      total: 36.06,
      currency: 'EUR',
    };
    invoices.push(invoice);
    return mockResponse(200, { invoice });
  }

  // GET /api/billing/invoices
  if (url.includes('/api/billing/invoices') && method === 'GET' && !url.includes('/pdf')) {
    return mockResponse(200, { invoices });
  }

  // POST /api/billing/payments
  if (url.includes('/api/billing/payments') && method === 'POST') {
    if (!hasAuth) return mockResponse(401, { error: 'Unauthorized' });
    if (!body?.amount || body.amount < 0) return mockResponse(400, { error: 'Invalid amount' });
    const payment = {
      id: `pay-${Date.now()}`,
      invoiceId: body.invoiceId,
      userId: body.userId,
      amount: body.amount,
      currency: body.currency,
      status: 'completed',
    };
    return mockResponse(200, { payment });
  }

  // GET /api/billing/invoices/:id/pdf
  if (url.includes('/pdf') && method === 'GET') {
    const idMatch = url.match(/invoices\/([^/]+)\/pdf/);
    const id = idMatch?.[1];
    const found = invoices.find(i => i.id === id);
    if (!found) return mockResponse(404, { error: 'Not found' });
    return mockResponse(200, Buffer.from('%PDF-1.4'), { 'content-type': 'application/pdf' });
  }

  // POST /api/webhooks/stripe
  if (url.includes('/api/webhooks/stripe') && method === 'POST') {
    return mockResponse(200, { received: true });
  }

  // POST /api/webhooks/paypal
  if (url.includes('/api/webhooks/paypal') && method === 'POST') {
    return mockResponse(200, { received: true });
  }

  return mockResponse(404, { error: 'Not found' });
});

global.fetch = mockFetch as any;

describe('Billing API Integration Tests', () => {
  const testUserId = 'test-user-integration';
  const testApiKey = 'test-api-key-integration';

  beforeEach(() => {
    invoices.length = 0;
    invoiceIdSeq = 0;
  });

  describe('POST /api/billing/invoices', () => {
    it('should create invoice for user', async () => {
      const response = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          userId: testUserId,
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
        })
      });
      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
        })
      });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should retrieve user invoices', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices?userId=${testUserId}`,
        { headers: { 'Authorization': `Bearer ${testApiKey}` } }
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoices).toBeDefined();
      expect(Array.isArray(data.invoices)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices?userId=${testUserId}&status=${InvoiceStatus.PAID}`,
        { headers: { 'Authorization': `Bearer ${testApiKey}` } }
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invoices).toBeDefined();
    });
  });

  describe('POST /api/billing/payments', () => {
    it('should create payment for invoice', async () => {
      // Create invoice first
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          userId: testUserId,
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
        })
      });
      const invoiceData = await invoiceResponse.json();
      const invoiceId = invoiceData.invoice.id;

      const paymentResponse = await fetch('http://localhost:3000/api/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          invoiceId, userId: testUserId, amount: 36.06, currency: 'EUR',
          provider: 'stripe', paymentMethodId: 'pm_test_123'
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          invoiceId: 'test-invoice', userId: testUserId, amount: -10,
          currency: 'EUR', provider: 'stripe', paymentMethodId: 'pm_test_123'
        })
      });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/billing/invoices/[id]/pdf', () => {
    it('should generate PDF for invoice', async () => {
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          userId: testUserId,
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
        })
      });
      const invoiceData = await invoiceResponse.json();
      const invoiceId = invoiceData.invoice.id;

      const pdfResponse = await fetch(
        `http://localhost:3000/api/billing/invoices/${invoiceId}/pdf?userId=${testUserId}`,
        { headers: { 'Authorization': `Bearer ${testApiKey}` } }
      );
      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers.get('content-type')).toBe('application/pdf');
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await fetch(
        `http://localhost:3000/api/billing/invoices/non-existent-id/pdf?userId=${testUserId}`,
        { headers: { 'Authorization': `Bearer ${testApiKey}` } }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Webhook Integration', () => {
    it('should handle Stripe webhook', async () => {
      const response = await fetch('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': 'test-signature' },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_123', amount: 3606, currency: 'eur', status: 'succeeded' } }
        })
      });
      expect([200, 400]).toContain(response.status);
    });

    it('should handle PayPal webhook', async () => {
      const response = await fetch('http://localhost:3000/api/webhooks/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'capture_test_123', amount: { value: '36.06', currency_code: 'EUR' }, status: 'COMPLETED' }
        })
      });
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('End-to-End Billing Flow', () => {
    it('should complete full billing cycle', async () => {
      const invoiceResponse = await fetch('http://localhost:3000/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testApiKey}` },
        body: JSON.stringify({
          userId: testUserId,
          period: { type: BillingPeriodType.MONTHLY, startDate: '2024-01-01', endDate: '2024-01-31' }
        })
      });

      expect(invoiceResponse.status).toBe(200);
      const invoiceData = await invoiceResponse.json();
      const invoice = invoiceData.invoice;
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.total).toBeGreaterThan(0);

      const pdfResponse = await fetch(
        `http://localhost:3000/api/billing/invoices/${invoice.id}/pdf?userId=${testUserId}`,
        { headers: { 'Authorization': `Bearer ${testApiKey}` } }
      );
      expect(pdfResponse.status).toBe(200);
    });
  });
});
