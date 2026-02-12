export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum BillingPeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export interface BillingPeriod {
  type: BillingPeriodType;
  startDate: Date;
  endDate: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'usage' | 'subscription' | 'credit' | 'penalty';
  metadata?: any;
}

export interface Invoice {
  id: string;
  number: string;
  userId: string;
  period: BillingPeriod;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  billingAddress: BillingAddress;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    generationTime?: Date;
    usageData?: any;
    billingCycle?: string;
    customerInfo?: any;
    paymentMethod?: string;
    notes?: string;
    number?: string;
  };
}

export interface BillingAddress {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface InvoiceGenerationOptions {
  forceRegenerate?: boolean;
  sendImmediately?: boolean;
  includeCredits?: boolean;
  customPeriod?: BillingPeriod;
}

export interface InvoiceFilter {
  userId?: string;
  status?: InvoiceStatus;
  periodStart?: Date;
  periodEnd?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
  averageInvoiceValue: number;
  paymentRate: number;
}

export interface BillingMetrics {
  period: BillingPeriod;
  totalRevenue: number;
  newCustomers: number;
  churnedCustomers: number;
  averageRevenuePerCustomer: number;
  customerLifetimeValue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

// Re-export payment types for backward compatibility
export type { Payment, PaymentMethod, PaymentIntent, RefundRequest, RefundResponse } from './payment.types';
export { PaymentStatus, PaymentProvider } from './payment.types';

export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
  trialStart?: Date;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    requestsPerMonth?: number;
    tokensPerMonth?: number;
    concurrentRequests?: number;
    features?: string[];
  };
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Credit {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  type: CreditType;
  expiresAt?: Date;
  usedAt?: Date;
  invoiceId?: string;
  createdAt: Date;
  metadata?: any;
}

export enum CreditType {
  PROMOTIONAL = 'promotional',
  REFUND = 'refund',
  COMPENSATION = 'compensation',
  ADJUSTMENT = 'adjustment'
}

export interface BillingAlert {
  id: string;
  userId: string;
  type: 'usage_threshold' | 'payment_failed' | 'invoice_overdue' | 'subscription_expiring';
  threshold?: number;
  currentValue?: number;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  metadata?: any;
}
