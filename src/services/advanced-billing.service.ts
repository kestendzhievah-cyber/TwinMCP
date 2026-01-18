import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { Invoice } from '../types/invoice.types';
import { InvoiceService } from './invoice.service';
import { AuditService } from './security/audit.service';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  headerHtml: string;
  footerHtml: string;
  itemsTemplate: string;
  styles: string;
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId?: string;
  metricName: string;
  quantity: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MeteredBillingConfig {
  metricName: string;
  unit: string;
  pricePerUnit: number;
  currency: string;
  billingPeriod: 'hourly' | 'daily' | 'monthly';
  aggregation: 'sum' | 'max' | 'last';
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'draft' | 'issued' | 'applied';
  createdAt: Date;
  appliedAt?: Date;
}

export class AdvancedBillingService {
  constructor(
    private db: Pool,
    private invoiceService: InvoiceService,
    private auditService: AuditService
  ) {}

  async createInvoiceTemplate(
    name: string,
    options: {
      description?: string;
      headerHtml?: string;
      footerHtml?: string;
      itemsTemplate?: string;
      styles?: string;
      logo?: string;
      colors?: {
        primary: string;
        secondary: string;
        text: string;
      };
    } = {}
  ): Promise<InvoiceTemplate> {
    const templateId = randomUUID();

    const template: InvoiceTemplate = {
      id: templateId,
      name,
      description: options.description,
      headerHtml: options.headerHtml || this.getDefaultHeader(),
      footerHtml: options.footerHtml || this.getDefaultFooter(),
      itemsTemplate: options.itemsTemplate || this.getDefaultItemsTemplate(),
      styles: options.styles || this.getDefaultStyles(),
      logo: options.logo,
      colors: options.colors || {
        primary: '#4F46E5',
        secondary: '#10B981',
        text: '#1F2937',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.query(
      `INSERT INTO invoice_templates (
        id, name, description, header_html, footer_html, items_template,
        styles, logo, colors, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        template.id,
        template.name,
        template.description,
        template.headerHtml,
        template.footerHtml,
        template.itemsTemplate,
        template.styles,
        template.logo,
        JSON.stringify(template.colors),
        template.createdAt,
        template.updatedAt,
      ]
    );

    return template;
  }

  async recordUsage(
    userId: string,
    metricName: string,
    quantity: number,
    options: {
      subscriptionId?: string;
      unit?: string;
      timestamp?: Date;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<UsageRecord> {
    const recordId = randomUUID();

    const record: UsageRecord = {
      id: recordId,
      userId,
      subscriptionId: options.subscriptionId,
      metricName,
      quantity,
      unit: options.unit || 'units',
      timestamp: options.timestamp || new Date(),
      metadata: options.metadata,
    };

    await this.db.query(
      `INSERT INTO usage_records (
        id, user_id, subscription_id, metric_name, quantity, unit, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.userId,
        record.subscriptionId,
        record.metricName,
        record.quantity,
        record.unit,
        record.timestamp,
        JSON.stringify(record.metadata || {}),
      ]
    );

    return record;
  }

  async calculateMeteredBilling(
    userId: string,
    config: MeteredBillingConfig,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalQuantity: number;
    totalAmount: number;
    records: UsageRecord[];
  }> {
    const result = await this.db.query(
      `SELECT * FROM usage_records 
       WHERE user_id = $1 
       AND metric_name = $2 
       AND timestamp >= $3 
       AND timestamp <= $4
       ORDER BY timestamp ASC`,
      [userId, config.metricName, startDate, endDate]
    );

    const records = result.rows.map(row => this.mapRowToUsageRecord(row));

    let totalQuantity: number;

    switch (config.aggregation) {
      case 'sum':
        totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
        break;
      case 'max':
        totalQuantity = Math.max(...records.map(r => r.quantity), 0);
        break;
      case 'last':
        totalQuantity = records.length > 0 ? records[records.length - 1].quantity : 0;
        break;
      default:
        totalQuantity = 0;
    }

    const totalAmount = totalQuantity * config.pricePerUnit;

    return {
      totalQuantity,
      totalAmount,
      records,
    };
  }

  async createGroupedInvoice(
    userId: string,
    invoiceIds: string[],
    options: {
      description?: string;
      dueDate?: Date;
    } = {}
  ): Promise<Invoice> {
    const invoices: Invoice[] = [];
    let totalAmount = 0;
    let currency = 'EUR';

    for (const invoiceId of invoiceIds) {
      const result = await this.db.query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [invoiceId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const invoice = result.rows[0];
      invoices.push(invoice);
      totalAmount += Number.parseFloat(invoice.total_amount);
      currency = invoice.currency;
    }

    const groupedInvoice = await this.invoiceService.generateInvoice(
      userId,
      {
        type: 'monthly' as any,
        startDate: new Date(),
        endDate: new Date(),
      },
      {
        forceRegenerate: true,
        sendImmediately: false,
      }
    );

    await this.db.query(
      `INSERT INTO grouped_invoices (id, parent_invoice_id, child_invoice_id)
       VALUES ${invoiceIds.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}`,
      invoiceIds.flatMap(id => [randomUUID(), groupedInvoice.id, id])
    );

    await this.auditService.logAccess(
      userId,
      'invoice',
      groupedInvoice.id,
      'group',
      { childInvoices: invoiceIds.length }
    );

    return groupedInvoice;
  }

  async createCreditNote(
    invoiceId: string,
    userId: string,
    amount: number,
    reason: string
  ): Promise<CreditNote> {
    const creditNoteId = randomUUID();

    const result = await this.db.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    const invoice = result.rows[0];

    if (amount > Number.parseFloat(invoice.total_amount)) {
      throw new Error('Credit note amount cannot exceed invoice amount');
    }

    const creditNote: CreditNote = {
      id: creditNoteId,
      invoiceId,
      userId,
      amount,
      currency: invoice.currency,
      reason,
      status: 'draft',
      createdAt: new Date(),
    };

    await this.db.query(
      `INSERT INTO credit_notes (
        id, invoice_id, user_id, amount, currency, reason, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        creditNote.id,
        creditNote.invoiceId,
        creditNote.userId,
        creditNote.amount,
        creditNote.currency,
        creditNote.reason,
        creditNote.status,
        creditNote.createdAt,
      ]
    );

    await this.auditService.logAccess(
      userId,
      'credit_note',
      creditNoteId,
      'create',
      { invoiceId, amount, reason }
    );

    return creditNote;
  }

  async applyCreditNote(creditNoteId: string): Promise<void> {
    const result = await this.db.query(
      'SELECT * FROM credit_notes WHERE id = $1',
      [creditNoteId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credit note not found');
    }

    const creditNote = result.rows[0];

    if (creditNote.status === 'applied') {
      throw new Error('Credit note already applied');
    }

    await this.db.query('BEGIN');

    try {
      await this.db.query(
        `UPDATE credit_notes 
         SET status = 'applied', applied_at = $1 
         WHERE id = $2`,
        [new Date(), creditNoteId]
      );

      await this.db.query(
        `UPDATE invoices 
         SET total_amount = total_amount - $1, updated_at = $2
         WHERE id = $3`,
        [creditNote.amount, new Date(), creditNote.invoice_id]
      );

      await this.db.query('COMMIT');

      await this.auditService.logAccess(
        creditNote.user_id,
        'credit_note',
        creditNoteId,
        'apply',
        { amount: creditNote.amount }
      );
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rates = await this.getExchangeRates(fromCurrency);
    
    if (!rates[toCurrency]) {
      throw new Error(`Exchange rate not available for ${toCurrency}`);
    }

    return amount * rates[toCurrency];
  }

  private async getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
    const cacheKey = `exchange_rates_${baseCurrency}`;
    const cached = await this.db.query(
      'SELECT rates FROM exchange_rate_cache WHERE base_currency = $1 AND expires_at > $2',
      [baseCurrency, new Date()]
    );

    if (cached.rows.length > 0) {
      return JSON.parse(cached.rows[0].rates);
    }

    const rates: Record<string, number> = {
      EUR: 1.0,
      USD: 1.1,
      GBP: 0.85,
      CAD: 1.45,
      AUD: 1.6,
    };

    await this.db.query(
      `INSERT INTO exchange_rate_cache (base_currency, rates, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (base_currency) DO UPDATE SET rates = $2, expires_at = $3`,
      [baseCurrency, JSON.stringify(rates), new Date(Date.now() + 24 * 60 * 60 * 1000)]
    );

    return rates;
  }

  private getDefaultHeader(): string {
    return `
      <div class="header">
        <img src="{{logo}}" alt="Company Logo" class="logo" />
        <h1>{{companyName}}</h1>
      </div>
    `;
  }

  private getDefaultFooter(): string {
    return `
      <div class="footer">
        <p>{{companyName}} - {{companyAddress}}</p>
        <p>Email: {{companyEmail}} | Phone: {{companyPhone}}</p>
        <p>{{taxInfo}}</p>
      </div>
    `;
  }

  private getDefaultItemsTemplate(): string {
    return `
      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
          <tr>
            <td>{{description}}</td>
            <td>{{quantity}}</td>
            <td>{{unitPrice}}</td>
            <td>{{total}}</td>
          </tr>
          {{/items}}
        </tbody>
      </table>
    `;
  }

  private getDefaultStyles(): string {
    return `
      .header { text-align: center; margin-bottom: 30px; }
      .logo { max-width: 200px; }
      .items { width: 100%; border-collapse: collapse; }
      .items th, .items td { border: 1px solid #ddd; padding: 8px; }
      .items th { background-color: #4F46E5; color: white; }
      .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
    `;
  }

  private mapRowToUsageRecord(row: any): UsageRecord {
    return {
      id: row.id,
      userId: row.user_id,
      subscriptionId: row.subscription_id,
      metricName: row.metric_name,
      quantity: Number.parseFloat(row.quantity),
      unit: row.unit,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
