import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AuditService } from './security/audit.service';

export interface Credit {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  balance: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'expired' | 'used';
  source: 'refund' | 'promotion' | 'manual' | 'compensation';
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreditTransaction {
  id: string;
  creditId: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  balanceBefore: number;
  balanceAfter: number;
  invoiceId?: string;
  description: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface CreditWallet {
  userId: string;
  totalBalance: number;
  currency: string;
  activeCredits: Credit[];
  expiringCredits: Credit[];
}

export class CreditService {
  private defaultCurrency: string;
  private defaultExpiryDays: number;

  constructor(
    private db: Pool,
    private auditService: AuditService
  ) {
    this.defaultCurrency = process.env.DEFAULT_CURRENCY || 'EUR';
    this.defaultExpiryDays = Number.parseInt(process.env.CREDIT_EXPIRY_DAYS || '365', 10);
  }

  async createCredit(
    userId: string,
    amount: number,
    options: {
      currency?: string;
      expiryDays?: number;
      source?: Credit['source'];
      description?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Credit> {
    const creditId = randomUUID();
    const currency = options.currency || this.defaultCurrency;
    const expiryDays = options.expiryDays ?? this.defaultExpiryDays;
    const expiresAt = expiryDays > 0 
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const credit: Credit = {
      id: creditId,
      userId,
      amount,
      currency,
      balance: amount,
      expiresAt: expiresAt || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      source: options.source || 'manual',
      description: options.description,
      metadata: options.metadata,
    };

    await this.db.query(
      `INSERT INTO credits (
        id, user_id, amount, currency, balance, expires_at, 
        status, source, description, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        credit.id,
        credit.userId,
        credit.amount,
        credit.currency,
        credit.balance,
        credit.expiresAt,
        credit.status,
        credit.source,
        credit.description,
        JSON.stringify(credit.metadata || {}),
        credit.createdAt,
        credit.updatedAt,
      ]
    );

    await this.createTransaction({
      creditId: credit.id,
      userId,
      amount,
      type: 'credit',
      balanceBefore: 0,
      balanceAfter: amount,
      description: options.description || `Credit added: ${options.source}`,
      metadata: options.metadata,
    });

    await this.auditService.logAccess(
      userId,
      'credit',
      creditId,
      'create',
      { amount, currency, source: options.source }
    );

    return credit;
  }

  async applyCreditsToInvoice(
    userId: string,
    invoiceId: string,
    invoiceAmount: number,
    currency: string
  ): Promise<{
    appliedAmount: number;
    remainingAmount: number;
    creditsUsed: Array<{ creditId: string; amount: number }>;
  }> {
    const wallet = await this.getWallet(userId);
    
    if (wallet.currency !== currency) {
      throw new Error(`Currency mismatch: wallet is ${wallet.currency}, invoice is ${currency}`);
    }

    const availableCredits = wallet.activeCredits
      .filter(c => c.balance > 0)
      .sort((a, b) => {
        if (a.expiresAt && b.expiresAt) {
          return a.expiresAt.getTime() - b.expiresAt.getTime();
        }
        if (a.expiresAt) return -1;
        if (b.expiresAt) return 1;
        return 0;
      });

    let remainingAmount = invoiceAmount;
    const creditsUsed: Array<{ creditId: string; amount: number }> = [];

    for (const credit of availableCredits) {
      if (remainingAmount <= 0) break;

      const amountToUse = Math.min(credit.balance, remainingAmount);
      
      await this.debitCredit(credit.id, amountToUse, {
        invoiceId,
        description: `Applied to invoice ${invoiceId}`,
      });

      creditsUsed.push({
        creditId: credit.id,
        amount: amountToUse,
      });

      remainingAmount -= amountToUse;
    }

    const appliedAmount = invoiceAmount - remainingAmount;

    await this.auditService.logAccess(
      userId,
      'credit',
      invoiceId,
      'apply_to_invoice',
      { appliedAmount, creditsUsed: creditsUsed.length }
    );

    return {
      appliedAmount,
      remainingAmount,
      creditsUsed,
    };
  }

  async debitCredit(
    creditId: string,
    amount: number,
    options: {
      invoiceId?: string;
      description?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const result = await this.db.query(
      'SELECT * FROM credits WHERE id = $1',
      [creditId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credit not found');
    }

    const credit = this.mapRowToCredit(result.rows[0]);

    if (credit.balance < amount) {
      throw new Error('Insufficient credit balance');
    }

    if (credit.status !== 'active') {
      throw new Error('Credit is not active');
    }

    const newBalance = credit.balance - amount;
    const newStatus = newBalance === 0 ? 'used' : 'active';

    await this.db.query(
      'UPDATE credits SET balance = $1, status = $2, updated_at = $3 WHERE id = $4',
      [newBalance, newStatus, new Date(), creditId]
    );

    await this.createTransaction({
      creditId,
      userId: credit.userId,
      amount,
      type: 'debit',
      balanceBefore: credit.balance,
      balanceAfter: newBalance,
      invoiceId: options.invoiceId,
      description: options.description || 'Credit used',
      metadata: options.metadata,
    });
  }

  async getWallet(userId: string): Promise<CreditWallet> {
    const result = await this.db.query(
      `SELECT * FROM credits 
       WHERE user_id = $1 AND status = 'active' AND balance > 0
       ORDER BY expires_at ASC NULLS LAST`,
      [userId]
    );

    const activeCredits = result.rows.map(row => this.mapRowToCredit(row));
    const totalBalance = activeCredits.reduce((sum, c) => sum + c.balance, 0);

    const expiringCredits = activeCredits.filter(c => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry = (c.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });

    return {
      userId,
      totalBalance,
      currency: this.defaultCurrency,
      activeCredits,
      expiringCredits,
    };
  }

  async getCreditHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    transactions: CreditTransaction[];
    total: number;
  }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let query = 'SELECT * FROM credit_transactions WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    const countResult = await this.db.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      transactions: result.rows.map(row => this.mapRowToTransaction(row)),
      total: Number.parseInt(countResult.rows[0].count, 10),
    };
  }

  async expireCredits(): Promise<number> {
    const result = await this.db.query(
      `UPDATE credits 
       SET status = 'expired', updated_at = $1
       WHERE status = 'active' 
       AND expires_at IS NOT NULL 
       AND expires_at < $1
       RETURNING id, user_id`,
      [new Date()]
    );

    for (const row of result.rows) {
      await this.auditService.logAccess(
        row.user_id,
        'credit',
        row.id,
        'expire',
        { reason: 'automatic_expiry' }
      );
    }

    return result.rowCount || 0;
  }

  async transferCredit(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description?: string
  ): Promise<void> {
    const fromWallet = await this.getWallet(fromUserId);

    if (fromWallet.totalBalance < amount) {
      throw new Error('Insufficient credit balance for transfer');
    }

    await this.db.query('BEGIN');

    try {
      const creditsUsed: Array<{ creditId: string; amount: number }> = [];
      let remainingAmount = amount;

      for (const credit of fromWallet.activeCredits) {
        if (remainingAmount <= 0) break;

        const amountToUse = Math.min(credit.balance, remainingAmount);
        
        await this.debitCredit(credit.id, amountToUse, {
          description: `Transfer to user ${toUserId}`,
        });

        creditsUsed.push({ creditId: credit.id, amount: amountToUse });
        remainingAmount -= amountToUse;
      }

      await this.createCredit(toUserId, amount, {
        source: 'manual',
        description: description || `Transfer from user ${fromUserId}`,
        metadata: { transferFrom: fromUserId },
      });

      await this.db.query('COMMIT');

      await this.auditService.logAccess(
        fromUserId,
        'credit',
        'transfer',
        'transfer_out',
        { toUserId, amount }
      );

      await this.auditService.logAccess(
        toUserId,
        'credit',
        'transfer',
        'transfer_in',
        { fromUserId, amount }
      );
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  private async createTransaction(data: {
    creditId: string;
    userId: string;
    amount: number;
    type: 'credit' | 'debit';
    balanceBefore: number;
    balanceAfter: number;
    invoiceId?: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<CreditTransaction> {
    const transaction: CreditTransaction = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
    };

    await this.db.query(
      `INSERT INTO credit_transactions (
        id, credit_id, user_id, amount, type, balance_before, 
        balance_after, invoice_id, description, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        transaction.id,
        transaction.creditId,
        transaction.userId,
        transaction.amount,
        transaction.type,
        transaction.balanceBefore,
        transaction.balanceAfter,
        transaction.invoiceId,
        transaction.description,
        JSON.stringify(transaction.metadata || {}),
        transaction.createdAt,
      ]
    );

    return transaction;
  }

  private mapRowToCredit(row: any): Credit {
    return {
      id: row.id,
      userId: row.user_id,
      amount: Number.parseFloat(row.amount),
      currency: row.currency,
      balance: Number.parseFloat(row.balance),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status,
      source: row.source,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private mapRowToTransaction(row: any): CreditTransaction {
    return {
      id: row.id,
      creditId: row.credit_id,
      userId: row.user_id,
      amount: Number.parseFloat(row.amount),
      type: row.type,
      balanceBefore: Number.parseFloat(row.balance_before),
      balanceAfter: Number.parseFloat(row.balance_after),
      invoiceId: row.invoice_id,
      description: row.description,
      createdAt: new Date(row.created_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
