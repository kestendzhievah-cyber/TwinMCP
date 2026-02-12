import { Pool } from 'pg';
import { 
  Invoice, 
  Payment, 
  InvoiceStatus, 
  PaymentStatus,
  BillingPeriodType 
} from '../../src/types/invoice.types';

export const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
} as unknown as Pool;

export const mockEncryptionService = {
  encryptPII: jest.fn().mockResolvedValue({ encrypted: 'encrypted_data' }),
  decryptPII: jest.fn().mockResolvedValue({ decrypted: 'decrypted_data' }),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

export const mockAuditService = {
  logAccess: jest.fn().mockResolvedValue(undefined),
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  logDataAccess: jest.fn().mockResolvedValue(undefined),
};

export const mockGDPRService = {
  anonymizeData: jest.fn(),
  deleteUserData: jest.fn(),
  exportUserData: jest.fn(),
};

export const mockDataMaskingService = {
  maskForLogging: jest.fn((data) => ({ ...data, masked: true })),
  maskEmail: jest.fn(),
  maskPhone: jest.fn(),
};

export const mockPDFService = {
  generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
};

export const mockStripeService = {
  createPaymentIntent: jest.fn(),
  processPayment: jest.fn(),
  createRefund: jest.fn(),
  verifyWebhook: jest.fn(),
};

export const mockPayPalService = {
  createOrder: jest.fn(),
  captureOrder: jest.fn(),
  createRefund: jest.fn(),
  verifyWebhook: jest.fn(),
};

export const mockWiseService = {
  createQuote: jest.fn(),
  createTransfer: jest.fn(),
  cancelTransfer: jest.fn(),
};
