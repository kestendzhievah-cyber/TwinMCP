import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AuditService } from './security/audit.service';
import * as XLSX from 'xlsx';

export interface BankTransaction {
  id: string;
  accountId: string;
  transactionDate: Date;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  type: 'debit' | 'credit';
  status: 'pending' | 'reconciled' | 'discrepancy';
  reconciledAt?: Date;
  matchedPaymentId?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationReport {
  id: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  totalBankTransactions: number;
  totalPayments: number;
  matchedCount: number;
  unmatchedBankTransactions: number;
  unmatchedPayments: number;
  discrepancies: Discrepancy[];
  status: 'in_progress' | 'completed' | 'reviewed';
  createdAt: Date;
  completedAt?: Date;
}

export interface Discrepancy {
  id: string;
  type: 'missing_payment' | 'missing_bank_transaction' | 'amount_mismatch' | 'duplicate';
  bankTransactionId?: string;
  paymentId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'investigating' | 'resolved';
  resolvedAt?: Date;
  resolution?: string;
}

export interface QuickBooksExport {
  invoices: any[];
  payments: any[];
  customers: any[];
  exportDate: Date;
}

export class ReconciliationService {
  constructor(
    private db: Pool,
    private auditService: AuditService
  ) {}

  async importBankTransactions(
    accountId: string,
    transactions: Array<{
      date: Date;
      amount: number;
      description: string;
      reference?: string;
      type: 'debit' | 'credit';
    }>
  ): Promise<BankTransaction[]> {
    const imported: BankTransaction[] = [];

    for (const txn of transactions) {
      const bankTransaction: BankTransaction = {
        id: randomUUID(),
        accountId,
        transactionDate: txn.date,
        amount: Math.abs(txn.amount),
        currency: 'EUR',
        description: txn.description,
        reference: txn.reference,
        type: txn.type,
        status: 'pending',
      };

      await this.db.query(
        `INSERT INTO bank_transactions (
          id, account_id, transaction_date, amount, currency, description,
          reference, type, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bankTransaction.id,
          bankTransaction.accountId,
          bankTransaction.transactionDate,
          bankTransaction.amount,
          bankTransaction.currency,
          bankTransaction.description,
          bankTransaction.reference,
          bankTransaction.type,
          bankTransaction.status,
        ]
      );

      imported.push(bankTransaction);
    }

    await this.auditService.logAccess(
      'system',
      'bank_transactions',
      accountId,
      'import',
      { count: imported.length }
    );

    return imported;
  }

  async reconcile(
    accountId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ReconciliationReport> {
    const reportId = randomUUID();

    const bankTxns = await this.db.query(
      `SELECT * FROM bank_transactions 
       WHERE account_id = $1 
       AND transaction_date >= $2 
       AND transaction_date <= $3
       AND status = 'pending'`,
      [accountId, periodStart, periodEnd]
    );

    const payments = await this.db.query(
      `SELECT * FROM payments 
       WHERE created_at >= $1 
       AND created_at <= $2
       AND status = 'succeeded'`,
      [periodStart, periodEnd]
    );

    const bankTransactions = bankTxns.rows.map(row => this.mapRowToBankTransaction(row));
    const paymentRecords = payments.rows;

    const matches: Array<{ bankTxnId: string; paymentId: string }> = [];
    const discrepancies: Discrepancy[] = [];

    for (const bankTxn of bankTransactions) {
      const matchingPayment = paymentRecords.find(p => {
        const amountMatch = Math.abs(Number.parseFloat(p.amount) - bankTxn.amount) < 0.01;
        const dateMatch = this.isSameDay(new Date(p.created_at), bankTxn.transactionDate);
        return amountMatch && dateMatch && !matches.some(m => m.paymentId === p.id);
      });

      if (matchingPayment) {
        matches.push({
          bankTxnId: bankTxn.id,
          paymentId: matchingPayment.id,
        });

        await this.db.query(
          `UPDATE bank_transactions 
           SET status = 'reconciled', reconciled_at = $1, matched_payment_id = $2
           WHERE id = $3`,
          [new Date(), matchingPayment.id, bankTxn.id]
        );
      } else {
        discrepancies.push({
          id: randomUUID(),
          type: 'missing_payment',
          bankTransactionId: bankTxn.id,
          actualAmount: bankTxn.amount,
          description: `Bank transaction without matching payment: ${bankTxn.description}`,
          severity: bankTxn.amount > 1000 ? 'high' : 'medium',
          status: 'open',
        });
      }
    }

    for (const payment of paymentRecords) {
      if (!matches.some(m => m.paymentId === payment.id)) {
        discrepancies.push({
          id: randomUUID(),
          type: 'missing_bank_transaction',
          paymentId: payment.id,
          expectedAmount: Number.parseFloat(payment.amount),
          description: `Payment without matching bank transaction: ${payment.id}`,
          severity: Number.parseFloat(payment.amount) > 1000 ? 'high' : 'medium',
          status: 'open',
        });
      }
    }

    const report: ReconciliationReport = {
      id: reportId,
      accountId,
      periodStart,
      periodEnd,
      totalBankTransactions: bankTransactions.length,
      totalPayments: paymentRecords.length,
      matchedCount: matches.length,
      unmatchedBankTransactions: bankTransactions.length - matches.length,
      unmatchedPayments: paymentRecords.length - matches.length,
      discrepancies,
      status: discrepancies.length === 0 ? 'completed' : 'in_progress',
      createdAt: new Date(),
      completedAt: discrepancies.length === 0 ? new Date() : undefined,
    };

    await this.db.query(
      `INSERT INTO reconciliation_reports (
        id, account_id, period_start, period_end, total_bank_transactions,
        total_payments, matched_count, unmatched_bank_transactions,
        unmatched_payments, status, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        report.id,
        report.accountId,
        report.periodStart,
        report.periodEnd,
        report.totalBankTransactions,
        report.totalPayments,
        report.matchedCount,
        report.unmatchedBankTransactions,
        report.unmatchedPayments,
        report.status,
        report.createdAt,
        report.completedAt,
      ]
    );

    for (const discrepancy of discrepancies) {
      await this.db.query(
        `INSERT INTO discrepancies (
          id, report_id, type, bank_transaction_id, payment_id,
          expected_amount, actual_amount, description, severity, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          discrepancy.id,
          reportId,
          discrepancy.type,
          discrepancy.bankTransactionId,
          discrepancy.paymentId,
          discrepancy.expectedAmount,
          discrepancy.actualAmount,
          discrepancy.description,
          discrepancy.severity,
          discrepancy.status,
        ]
      );
    }

    await this.auditService.logAccess(
      'system',
      'reconciliation',
      reportId,
      'create',
      { matched: matches.length, discrepancies: discrepancies.length }
    );

    return report;
  }

  async resolveDiscrepancy(
    discrepancyId: string,
    resolution: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE discrepancies 
       SET status = 'resolved', resolved_at = $1, resolution = $2
       WHERE id = $3`,
      [new Date(), resolution, discrepancyId]
    );

    await this.auditService.logAccess(
      'system',
      'discrepancy',
      discrepancyId,
      'resolve',
      { resolution }
    );
  }

  async exportToQuickBooks(
    startDate: Date,
    endDate: Date
  ): Promise<QuickBooksExport> {
    const invoicesResult = await this.db.query(
      `SELECT * FROM invoices 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );

    const paymentsResult = await this.db.query(
      `SELECT * FROM payments 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );

    const customersResult = await this.db.query(
      `SELECT DISTINCT u.* FROM users u
       INNER JOIN invoices i ON i.user_id = u.id
       WHERE i.created_at >= $1 AND i.created_at <= $2`,
      [startDate, endDate]
    );

    const invoices = invoicesResult.rows.map(inv => ({
      TxnID: inv.id,
      CustomerRef: inv.user_id,
      TxnDate: inv.issue_date,
      DueDate: inv.due_date,
      RefNumber: inv.invoice_number,
      TotalAmt: inv.total_amount,
      Balance: inv.status === 'paid' ? 0 : inv.total_amount,
      IsPaid: inv.status === 'paid',
    }));

    const payments = paymentsResult.rows.map(pmt => ({
      TxnID: pmt.id,
      CustomerRef: pmt.user_id,
      TxnDate: pmt.created_at,
      TotalAmt: pmt.amount,
      PaymentMethodRef: pmt.provider,
      DepositToAccountRef: 'Bank Account',
    }));

    const customers = customersResult.rows.map(cust => ({
      ListID: cust.id,
      Name: cust.email,
      CompanyName: cust.company_name,
      Email: cust.email,
      BillAddress: cust.billing_address,
    }));

    return {
      invoices,
      payments,
      customers,
      exportDate: new Date(),
    };
  }

  async exportToXero(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const invoicesResult = await this.db.query(
      `SELECT * FROM invoices 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );

    const invoices = invoicesResult.rows.map(inv => ({
      Type: 'ACCREC',
      Contact: {
        ContactID: inv.user_id,
      },
      Date: inv.issue_date,
      DueDate: inv.due_date,
      InvoiceNumber: inv.invoice_number,
      Reference: inv.id,
      Status: inv.status === 'paid' ? 'PAID' : 'AUTHORISED',
      LineAmountTypes: 'Exclusive',
      LineItems: [{
        Description: 'Services',
        Quantity: 1,
        UnitAmount: inv.subtotal,
        TaxType: 'OUTPUT',
        TaxAmount: inv.tax_amount,
        LineAmount: inv.total_amount,
      }],
      Total: inv.total_amount,
      TotalTax: inv.tax_amount,
      AmountDue: inv.status === 'paid' ? 0 : inv.total_amount,
    }));

    return {
      Invoices: invoices,
      ExportDate: new Date(),
    };
  }

  async generateReconciliationExcel(
    reportId: string
  ): Promise<Buffer> {
    const reportResult = await this.db.query(
      'SELECT * FROM reconciliation_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      throw new Error('Report not found');
    }

    const report = reportResult.rows[0];

    const discrepanciesResult = await this.db.query(
      'SELECT * FROM discrepancies WHERE report_id = $1',
      [reportId]
    );

    const workbook = XLSX.utils.book_new();

    const summaryData = [
      ['Reconciliation Report'],
      ['Period', `${report.period_start} to ${report.period_end}`],
      [''],
      ['Total Bank Transactions', report.total_bank_transactions],
      ['Total Payments', report.total_payments],
      ['Matched', report.matched_count],
      ['Unmatched Bank Transactions', report.unmatched_bank_transactions],
      ['Unmatched Payments', report.unmatched_payments],
      ['Status', report.status],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    if (discrepanciesResult.rows.length > 0) {
      const discrepanciesData = [
        ['ID', 'Type', 'Description', 'Expected Amount', 'Actual Amount', 'Severity', 'Status'],
        ...discrepanciesResult.rows.map(d => [
          d.id,
          d.type,
          d.description,
          d.expected_amount || '',
          d.actual_amount || '',
          d.severity,
          d.status,
        ]),
      ];

      const discrepanciesSheet = XLSX.utils.aoa_to_sheet(discrepanciesData);
      XLSX.utils.book_append_sheet(workbook, discrepanciesSheet, 'Discrepancies');
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async detectDuplicatePayments(): Promise<Discrepancy[]> {
    const result = await this.db.query(
      `SELECT p1.*, p2.id as duplicate_id
       FROM payments p1
       INNER JOIN payments p2 ON p1.amount = p2.amount 
         AND p1.user_id = p2.user_id
         AND p1.id < p2.id
         AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 300
       WHERE p1.status = 'succeeded' AND p2.status = 'succeeded'`
    );

    const discrepancies: Discrepancy[] = result.rows.map(row => ({
      id: randomUUID(),
      type: 'duplicate',
      paymentId: row.id,
      actualAmount: Number.parseFloat(row.amount),
      description: `Potential duplicate payment detected: ${row.id} and ${row.duplicate_id}`,
      severity: 'high',
      status: 'open',
    }));

    return discrepancies;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private mapRowToBankTransaction(row: any): BankTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      transactionDate: new Date(row.transaction_date),
      amount: Number.parseFloat(row.amount),
      currency: row.currency,
      description: row.description,
      reference: row.reference,
      type: row.type,
      status: row.status,
      reconciledAt: row.reconciled_at ? new Date(row.reconciled_at) : undefined,
      matchedPaymentId: row.matched_payment_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
