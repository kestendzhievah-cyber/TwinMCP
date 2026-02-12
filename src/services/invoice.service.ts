import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { 
  Invoice, 
  InvoiceItem, 
  InvoiceStatus, 
  BillingPeriod,
  InvoiceGenerationOptions,
  BillingAddress,
  BillingPeriodType
} from '../types/invoice.types';
import { EncryptionService } from './security/encryption.service';
import { AuditService } from './security/audit.service';
import { GDPRService } from './security/gdpr.service';
import { DataMaskingService } from './security/data-masking.service';
import { PDFService } from './pdf.service';
import { InvoiceStorageService } from './invoice-storage.service';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export class InvoiceService {
  private pdfService: PDFService;
  private storageService: InvoiceStorageService;
  private taxRate: number;
  private dueDays: number;
  private currency: string;

  constructor(
    private db: Pool,
    private encryptionService: EncryptionService,
    private auditService: AuditService,
    private gdprService: GDPRService,
    private maskingService: DataMaskingService
  ) {
    this.pdfService = new PDFService();
    this.storageService = new InvoiceStorageService();
    this.taxRate = Number.parseFloat(process.env.INVOICE_TAX_RATE || '0.2');
    this.dueDays = Number.parseInt(process.env.INVOICE_DUE_DAYS || '30', 10);
    this.currency = process.env.INVOICE_CURRENCY || 'EUR';
  }

  async generateInvoice(
    userId: string, 
    period: BillingPeriod,
    options?: InvoiceGenerationOptions,
    requestContext?: { ipAddress: string; userAgent: string }
  ): Promise<Invoice> {
    this.assertValidUserId(userId);
    this.assertValidPeriod(period);
    await this.auditService.logAccess(
      userId,
      'invoice',
      'generation',
      'generate',
      requestContext?.ipAddress || 'unknown',
      requestContext?.userAgent || 'unknown'
    );

    const existingInvoice = await this.getInvoiceByPeriod(userId, period);
    if (existingInvoice && !options?.forceRegenerate) {
      throw new Error(`Invoice already exists for period ${period.startDate.toISOString().slice(0, 7)}`);
    }

    const usageData = await this.getUsageData(userId, period);
    const items = await this.calculateInvoiceItems(userId, usageData, period);
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * this.taxRate;
    const total = subtotal + tax;

    const customerInfo = await this.getCustomerInfo(userId);
    const encryptedCustomerInfo = await this.encryptionService.encryptPII(customerInfo);
    const billingAddress = await this.getBillingAddress(userId);

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const invoice: Invoice = {
      id: randomUUID(),
      number: invoiceNumber,
      userId,
      period,
      status: InvoiceStatus.DRAFT,
      items,
      subtotal,
      tax,
      total,
      currency: this.currency,
      issueDate: new Date(),
      dueDate: new Date(period.endDate.getTime() + this.dueDays * 24 * 60 * 60 * 1000),
      billingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        generationTime: new Date(),
        usageData: this.maskingService.maskForLogging(usageData),
        billingCycle: period.type,
        customerInfo: encryptedCustomerInfo,
        number: invoiceNumber
      }
    };

    await this.saveInvoice(invoice);

    if (options?.sendImmediately) {
      await this.sendInvoice(invoice);
    } else {
      try {
        const pdfBuffer = await this.pdfService.generateInvoicePDF(invoice);
        await this.storageService.storePDF(invoice, pdfBuffer);
      } catch (error) {
        logger.error(`Failed to store invoice PDF for ${invoice.id}:`, error);
      }
    }

    return invoice;
  }

  async getInvoice(
    invoiceId: string,
    userId?: string,
    requestContext?: { ipAddress: string; userAgent: string }
  ): Promise<Invoice | null> {
    if (!invoiceId) {
      throw new Error('invoiceId is required');
    }
    if (userId) {
      await this.auditService.logAccess(
        userId,
        'invoice',
        invoiceId,
        'read',
        requestContext?.ipAddress || 'unknown',
        requestContext?.userAgent || 'unknown'
      );
    }

    const result = await this.db.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const invoice = {
      id: row.id,
      userId: row.user_id,
      number: row.number,
      period: JSON.parse(row.period),
      status: row.status as InvoiceStatus,
      items: JSON.parse(row.items),
      subtotal: parseFloat(row.subtotal),
      tax: parseFloat(row.tax),
      total: parseFloat(row.total),
      currency: row.currency,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidAt: row.paid_date,
      billingAddress: JSON.parse(row.billing_address),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata)
    };

    if (invoice.metadata?.customerInfo?.encrypted) {
      try {
        invoice.metadata.customerInfo = await this.encryptionService.decryptPII(invoice.metadata.customerInfo);
      } catch (error) {
        console.error('Failed to decrypt customer info:', error);
      }
    }

    return invoice;
  }

  async getUserInvoices(
    userId: string, 
    status?: InvoiceStatus,
    limit = 50,
    offset = 0
  ): Promise<Invoice[]> {
    this.assertValidUserId(userId);
    let query = 'SELECT * FROM invoices WHERE user_id = $1';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      number: row.number,
      period: JSON.parse(row.period),
      status: row.status as InvoiceStatus,
      items: JSON.parse(row.items),
      subtotal: parseFloat(row.subtotal),
      tax: parseFloat(row.tax),
      total: parseFloat(row.total),
      currency: row.currency,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidAt: row.paid_date,
      billingAddress: JSON.parse(row.billing_address),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata)
    }));
  }

  async updateInvoiceStatus(
    invoiceId: string, 
    status: InvoiceStatus,
    metadata?: any
  ): Promise<void> {
    if (!invoiceId) {
      throw new Error('invoiceId is required');
    }
    const updateData: any = {
      status,
      updated_at: new Date()
    };

    if (status === InvoiceStatus.PAID) {
      updateData.paid_at = new Date();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    await this.db.query(
      `UPDATE invoices 
       SET status = $1, paid_date = COALESCE($2, paid_date), metadata = COALESCE($3, metadata), updated_at = $4
       WHERE id = $5`,
      [
        status,
        updateData.paid_at || null,
        metadata ? JSON.stringify(metadata) : null,
        updateData.updated_at,
        invoiceId
      ]
    );
  }

  async sendInvoice(invoice: Invoice): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const fromAddress = process.env.INVOICE_EMAIL_FROM || process.env.SMTP_FROM;

    if (!smtpHost || !smtpUser || !smtpPass || !fromAddress) {
      console.warn('SMTP configuration missing. Invoice email was not sent.');
      await this.updateInvoiceStatus(invoice.id, InvoiceStatus.SENT, {
        ...(invoice.metadata || {}),
        emailStatus: 'skipped_missing_smtp'
      });
      return;
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.storageService.getPDF(invoice.userId, invoice.id);
    } catch (error) {
      pdfBuffer = await this.pdfService.generateInvoicePDF(invoice);
      await this.storageService.storePDF(invoice, pdfBuffer);
    }
    const recipient = invoice.billingAddress?.email || invoice.metadata?.customerInfo?.email;

    if (!recipient) {
      throw new Error('No billing email available for invoice sending');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: `Votre facture ${invoice.number}`,
      text: `Bonjour,\n\nVeuillez trouver en pièce jointe votre facture ${invoice.number}.\n\nMerci.`,
      attachments: [
        {
          filename: `invoice-${invoice.number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    await this.updateInvoiceStatus(invoice.id, InvoiceStatus.SENT, {
      ...(invoice.metadata || {}),
      emailStatus: 'sent',
      emailSentAt: new Date().toISOString()
    });
  }

  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    try {
      const existingPDF = await this.storageService.getPDF(invoice.userId, invoiceId);
      return existingPDF;
    } catch (error) {
      const pdfBuffer = await this.pdfService.generateInvoicePDF(invoice);
      await this.storageService.storePDF(invoice, pdfBuffer);
      return pdfBuffer;
    }
  }

  private async getInvoiceByPeriod(
    userId: string, 
    period: BillingPeriod
  ): Promise<Invoice | null> {
    this.assertValidUserId(userId);
    this.assertValidPeriod(period);
    const result = await this.db.query(
      'SELECT * FROM invoices WHERE user_id = $1 AND period->>\'type\' = $2 AND period->>\'startDate\' = $3 AND period->>\'endDate\' = $4',
      [userId, period.type, period.startDate.toISOString(), period.endDate.toISOString()]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      number: row.number,
      period: JSON.parse(row.period),
      status: row.status as InvoiceStatus,
      items: JSON.parse(row.items),
      subtotal: parseFloat(row.subtotal),
      tax: parseFloat(row.tax),
      total: parseFloat(row.total),
      currency: row.currency,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidAt: row.paid_date,
      billingAddress: JSON.parse(row.billing_address),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata)
    };
  }

  private async getUsageData(userId: string, period: BillingPeriod): Promise<any> {
    // Récupérer les données d'utilisation depuis les logs
    const result = await this.db.query(
      `SELECT 
         tool_name,
         COUNT(*) as usage_count,
         SUM(response_time_ms) as total_response_time,
         AVG(response_time_ms) as avg_response_time,
         SUM(COALESCE(tokens_returned, 0)) as total_tokens
       FROM usage_logs 
       WHERE user_id = $1 
         AND created_at >= $2 
         AND created_at <= $3
       GROUP BY tool_name`,
      [userId, period.startDate, period.endDate]
    );

    return {
      tools: result.rows,
      period,
      totalRequests: result.rows.reduce((sum, row) => sum + parseInt(row.usage_count), 0),
      totalTokens: result.rows.reduce((sum, row) => sum + parseInt(row.total_tokens || 0), 0)
    };
  }

  private async calculateInvoiceItems(
    userId: string, 
    usageData: any, 
    period: BillingPeriod
  ): Promise<InvoiceItem[]> {
    const items: InvoiceItem[] = [];
    
    // Tarification par usage
    const pricing = await this.getUserPricing(userId);
    
    // Item pour les requêtes API
    if (usageData.totalRequests > 0) {
      items.push({
        id: randomUUID(),
        description: `API Requests (${usageData.totalRequests} requests)`,
        quantity: usageData.totalRequests,
        unitPrice: pricing.perRequest,
        amount: usageData.totalRequests * pricing.perRequest,
        type: 'usage',
        metadata: {
          requests: usageData.tools,
          period: period.type
        }
      });
    }

    // Item pour les tokens
    if (usageData.totalTokens > 0) {
      items.push({
        id: randomUUID(),
        description: `Token Usage (${usageData.totalTokens.toLocaleString()} tokens)`,
        quantity: usageData.totalTokens,
        unitPrice: pricing.perToken,
        amount: usageData.totalTokens * pricing.perToken,
        type: 'usage',
        metadata: {
          tokenBreakdown: usageData.tools.map((tool: { tool_name: string; total_tokens: number }) => ({
            tool: tool.tool_name,
            tokens: tool.total_tokens
          }))
        }
      });
    }

    // Frais d'abonnement mensuel
    if (pricing.monthlyFee > 0) {
      items.push({
        id: randomUUID(),
        description: 'Monthly Subscription',
        quantity: 1,
        unitPrice: pricing.monthlyFee,
        amount: pricing.monthlyFee,
        type: 'subscription',
        metadata: {
          plan: pricing.plan,
          billingCycle: 'monthly'
        }
      });
    }

    return items;
  }

  private async getUserPricing(userId: string): Promise<any> {
    // Récupérer les tarifs selon le plan de l'utilisateur
    const result = await this.db.query(
      `SELECT u.*, api.tier 
       FROM users u 
       JOIN api_keys api ON u.id = api.user_id 
       WHERE u.id = $1 
       LIMIT 1`,
      [userId]
    );

    const user = result.rows[0];
    const tier = user?.tier || 'free';

    const pricingTiers = {
      free: {
        perRequest: 0.001,
        perToken: 0.000001,
        monthlyFee: 0,
        plan: 'free'
      },
      basic: {
        perRequest: 0.0008,
        perToken: 0.0000008,
        monthlyFee: 29,
        plan: 'basic'
      },
      premium: {
        perRequest: 0.0006,
        perToken: 0.0000006,
        monthlyFee: 99,
        plan: 'premium'
      },
      enterprise: {
        perRequest: 0.0004,
        perToken: 0.0000004,
        monthlyFee: 499,
        plan: 'enterprise'
      }
    };

    return pricingTiers[tier as keyof typeof pricingTiers] || pricingTiers.free;
  }

  private async getCustomerInfo(userId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT u.id, u.email, u.name, u.created_at,
        p.address, p.city, p.state, p.country, p.postal_code
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) {
      return {};
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      address: user.address || 'Unknown address',
      city: user.city || 'Unknown city',
      state: user.state || 'Unknown state',
      country: user.country || 'Unknown country',
      postalCode: user.postal_code || '00000'
    };
  }

  private async getBillingAddress(userId: string): Promise<BillingAddress> {
    const result = await this.db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      const fallback = await this.getCustomerInfo(userId);
      return {
        name: fallback.name || 'Default User',
        email: fallback.email || 'user@example.com',
        address: fallback.address || 'Unknown address',
        city: fallback.city || 'Unknown city',
        state: fallback.state || 'Unknown state',
        country: fallback.country || 'Unknown country',
        postalCode: fallback.postalCode || '00000',
        phone: undefined
      };
    }

    const profile = result.rows[0];
    return {
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Default User',
      email: profile.email || 'user@example.com',
      phone: profile.phone || undefined,
      address: profile.address || 'Unknown address',
      city: profile.city || 'Unknown city',
      state: profile.state || 'Unknown state',
      country: profile.country || 'Unknown country',
      postalCode: profile.postal_code || '00000'
    };
  }

  private async saveInvoice(invoice: Invoice): Promise<void> {
    await this.db.query(
      `INSERT INTO invoices (
        id, user_id, number, period, status, items, subtotal, tax, total,
        currency, issue_date, due_date, paid_date, billing_address, created_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        items = EXCLUDED.items,
        subtotal = EXCLUDED.subtotal,
        tax = EXCLUDED.tax,
        total = EXCLUDED.total,
        due_date = EXCLUDED.due_date,
        paid_date = EXCLUDED.paid_date,
        billing_address = EXCLUDED.billing_address,
        updated_at = EXCLUDED.updated_at,
        metadata = EXCLUDED.metadata`,
      [
        invoice.id,
        invoice.userId,
        invoice.number,
        JSON.stringify(invoice.period),
        invoice.status,
        JSON.stringify(invoice.items),
        invoice.subtotal,
        invoice.tax,
        invoice.total,
        invoice.currency,
        invoice.issueDate,
        invoice.dueDate,
        invoice.paidAt,
        JSON.stringify(invoice.billingAddress),
        invoice.createdAt,
        invoice.updatedAt,
        JSON.stringify(invoice.metadata)
      ]
    );
  }

  private assertValidUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Invalid userId');
    }
  }

  private assertValidPeriod(period: BillingPeriod): void {
    if (!period || !Object.values(BillingPeriodType).includes(period.type)) {
      throw new Error('Invalid billing period type');
    }

    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid billing period dates');
    }

    if (start.getTime() > end.getTime()) {
      throw new Error('Invalid billing period range');
    }
  }
}
