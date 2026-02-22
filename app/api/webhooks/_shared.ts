// Lazy-init singleton for webhook route services.
// Prevents DB connections during next build.
let _stripeServices: any = null;
let _paypalServices: any = null;

export async function getStripeWebhookServices() {
  if (!_stripeServices) {
    const { pool: db } = await import('@/lib/prisma');
    const { StripeService } = await import('@/src/services/payment-providers/stripe.service');
    const { PaymentService } = await import('@/src/services/payment.service');
    const { InvoiceService } = await import('@/src/services/invoice.service');
    const { EncryptionService } = await import('@/src/services/security/encryption.service');
    const { AuditService } = await import('@/src/services/security/audit.service');
    const { GDPRService } = await import('@/src/services/security/gdpr.service');
    const { DataMaskingService } = await import('@/src/services/security/data-masking.service');
    const { KeyManagementService } = await import('@/src/services/security/kms.service');

    const kms = new KeyManagementService();
    const encryptionService = new EncryptionService(kms);
    const maskingService = new DataMaskingService();
    const auditService = new AuditService(db, maskingService);
    const gdprService = new GDPRService(db, encryptionService, auditService);

    _stripeServices = {
      stripeService: new StripeService(),
      paymentService: new PaymentService(db),
      invoiceService: new InvoiceService(db, encryptionService, auditService, gdprService, maskingService),
      auditService,
    };
  }
  return _stripeServices;
}

export async function getPaypalWebhookServices() {
  if (!_paypalServices) {
    const { pool: db } = await import('@/lib/prisma');
    const { PayPalService } = await import('@/src/services/payment-providers/paypal.service');
    const { PaymentService } = await import('@/src/services/payment.service');
    const { InvoiceService } = await import('@/src/services/invoice.service');
    const { EncryptionService } = await import('@/src/services/security/encryption.service');
    const { AuditService } = await import('@/src/services/security/audit.service');
    const { GDPRService } = await import('@/src/services/security/gdpr.service');
    const { DataMaskingService } = await import('@/src/services/security/data-masking.service');
    const { KeyManagementService } = await import('@/src/services/security/kms.service');

    const kms = new KeyManagementService();
    const encryptionService = new EncryptionService(kms);
    const maskingService = new DataMaskingService();
    const auditService = new AuditService(db, maskingService);
    const gdprService = new GDPRService(db, encryptionService, auditService);

    _paypalServices = {
      paypalService: new PayPalService(),
      paymentService: new PaymentService(db),
      invoiceService: new InvoiceService(db, encryptionService, auditService, gdprService, maskingService),
      auditService,
    };
  }
  return _paypalServices;
}
