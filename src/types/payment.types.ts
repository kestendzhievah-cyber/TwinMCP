export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  WISE = 'wise',
  BANK_TRANSFER = 'bank_transfer'
}

export interface Payment {
  id: string;
  invoiceId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: any;
  provider: PaymentProvider;
  transactionId?: string;
  providerTransactionId?: string;
  failureReason?: string;
  refundedAmount?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  processedAt?: Date;
  updatedAt?: Date;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  provider: PaymentProvider;
  type: 'card' | 'bank_account' | 'paypal' | 'other';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  id: string;
  paymentId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  refundedAt?: Date;
  metadata?: Record<string, any>;
}
