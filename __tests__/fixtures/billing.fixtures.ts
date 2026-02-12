import { 
  Invoice, 
  Payment, 
  InvoiceStatus, 
  PaymentStatus,
  BillingPeriodType,
  BillingPeriod,
  InvoiceItem,
  PaymentMethod
} from '../../src/types/invoice.types';

export const testUserId = 'test-user-123';
export const testInvoiceId = 'test-invoice-456';
export const testPaymentId = 'test-payment-789';

export const testBillingPeriod: BillingPeriod = {
  type: BillingPeriodType.MONTHLY,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
};

export const testInvoiceItems: InvoiceItem[] = [
  {
    id: 'item-1',
    description: 'API Requests (1000 requests)',
    quantity: 1000,
    unitPrice: 0.001,
    amount: 1.00,
    type: 'usage',
    metadata: {
      requests: [],
      period: 'monthly'
    }
  },
  {
    id: 'item-2',
    description: 'Token Usage (50000 tokens)',
    quantity: 50000,
    unitPrice: 0.000001,
    amount: 0.05,
    type: 'usage',
    metadata: {
      tokenBreakdown: []
    }
  },
  {
    id: 'item-3',
    description: 'Monthly Subscription',
    quantity: 1,
    unitPrice: 29.00,
    amount: 29.00,
    type: 'subscription',
    metadata: {
      plan: 'basic',
      billingCycle: 'monthly'
    }
  }
];

export const testInvoice: Invoice = {
  id: testInvoiceId,
  number: 'INV-2024-001',
  userId: testUserId,
  period: testBillingPeriod,
  status: InvoiceStatus.DRAFT,
  items: testInvoiceItems,
  subtotal: 30.05,
  tax: 6.01,
  total: 36.06,
  currency: 'EUR',
  issueDate: new Date('2024-02-01'),
  dueDate: new Date('2024-03-02'),
  billingAddress: {
    name: 'Test User',
    email: 'test@example.com',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    country: 'France',
    postalCode: '75001',
    phone: '+33123456789'
  },
  createdAt: new Date('2024-02-01'),
  updatedAt: new Date('2024-02-01'),
  metadata: {
    generationTime: new Date('2024-02-01'),
    usageData: { masked: true },
    billingCycle: BillingPeriodType.MONTHLY,
    customerInfo: { encrypted: 'encrypted_data' },
    number: 'INV-2024-001'
  }
};

export const testPaymentMethod: PaymentMethod = {
  id: 'pm-test-123',
  userId: testUserId,
  type: 'card',
  provider: 'stripe',
  isDefault: true,
  lastFour: '4242',
  brand: 'visa',
  expiryMonth: 12,
  expiryYear: 2025,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const testPayment: Payment = {
  id: testPaymentId,
  invoiceId: testInvoiceId,
  userId: testUserId,
  amount: 36.06,
  currency: 'EUR',
  status: PaymentStatus.PENDING,
  method: testPaymentMethod,
  provider: 'stripe',
  createdAt: new Date('2024-02-01'),
  metadata: {
    provider: 'stripe',
    paymentMethod: 'card'
  }
};

export const testUsageData = {
  tools: [
    {
      tool_name: 'query-docs',
      usage_count: '500',
      total_response_time: '5000',
      avg_response_time: '10',
      total_tokens: '25000'
    },
    {
      tool_name: 'resolve-library-id',
      usage_count: '500',
      total_response_time: '3000',
      avg_response_time: '6',
      total_tokens: '25000'
    }
  ],
  period: testBillingPeriod,
  totalRequests: 1000,
  totalTokens: 50000
};

export const testCustomerInfo = {
  id: testUserId,
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2023-01-01'),
  address: '123 Test Street',
  city: 'Test City',
  state: 'Test State',
  country: 'France',
  postalCode: '75001'
};

export const testUserPricing = {
  perRequest: 0.001,
  perToken: 0.000001,
  monthlyFee: 29,
  plan: 'basic'
};

export const mockDatabaseRows = {
  invoice: {
    id: testInvoiceId,
    user_id: testUserId,
    number: 'INV-2024-001',
    period: JSON.stringify(testBillingPeriod),
    status: InvoiceStatus.DRAFT,
    items: JSON.stringify(testInvoiceItems),
    subtotal: '30.05',
    tax: '6.01',
    total: '36.06',
    currency: 'EUR',
    issue_date: new Date('2024-02-01'),
    due_date: new Date('2024-03-02'),
    paid_date: null,
    billing_address: JSON.stringify(testInvoice.billingAddress),
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01'),
    metadata: JSON.stringify(testInvoice.metadata)
  },
  payment: {
    id: testPaymentId,
    invoice_id: testInvoiceId,
    user_id: testUserId,
    amount: '36.06',
    currency: 'EUR',
    status: PaymentStatus.PENDING,
    payment_method: JSON.stringify(testPaymentMethod),
    provider: 'stripe',
    provider_transaction_id: null,
    failure_reason: null,
    refunded_amount: null,
    created_at: new Date('2024-02-01'),
    processed_at: null,
    metadata: JSON.stringify(testPayment.metadata)
  },
  userProfile: {
    user_id: testUserId,
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '+33123456789',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    country: 'France',
    postal_code: '75001'
  },
  user: {
    id: testUserId,
    email: 'test@example.com',
    name: 'Test User',
    created_at: new Date('2023-01-01'),
    tier: 'basic'
  }
};
