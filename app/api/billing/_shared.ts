import type { Pool } from 'pg';

// Lazy-init singleton for billing route services.
// Prevents DB connections during next build.
let _services: any = null;

export async function getBillingServices() {
  if (!_services) {
    const { pool: db } = await import('@/lib/prisma');
    const { PaymentService } = await import('@/src/services/payment.service');
    const { SubscriptionService } = await import('@/src/services/subscription.service');
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

    const paymentService = new PaymentService(db);
    const subscriptionService = new SubscriptionService(db);
    const invoiceService = new InvoiceService(db, encryptionService, auditService, gdprService, maskingService);

    _services = {
      db,
      kms,
      encryptionService,
      maskingService,
      auditService,
      gdprService,
      paymentService,
      subscriptionService,
      invoiceService,
    };
  }
  return _services as {
    db: Pool;
    kms: any;
    encryptionService: any;
    maskingService: any;
    auditService: any;
    gdprService: any;
    paymentService: any;
    subscriptionService: any;
    invoiceService: any;
  };
}
