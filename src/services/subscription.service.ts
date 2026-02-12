import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { 
  Subscription, 
  SubscriptionStatus, 
  Plan,
  Credit,
  CreditType
} from '../types/invoice.types';

export class SubscriptionService {
  constructor(private db: Pool) {}

  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId: string,
    trialDays = 0
  ): Promise<Subscription> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const now = new Date();
    const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    const subscription: Subscription = {
      id: randomUUID(),
      userId,
      plan: plan.name,
      status: trialEnd ? SubscriptionStatus.ACTIVE : SubscriptionStatus.ACTIVE,
      currentPeriodStart: trialEnd || now,
      currentPeriodEnd: this.calculatePeriodEnd(trialEnd || now, plan.interval),
      cancelAtPeriodEnd: false,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval as 'month' | 'year',
      intervalCount: 1,
      trialStart: trialEnd ? now : undefined,
      trialEnd: trialEnd ? trialEnd : undefined,
      createdAt: now,
      updatedAt: now,
      metadata: {
        planId,
        paymentMethodId
      }
    };

    await this.saveSubscription(subscription);
    return subscription;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const result = await this.db.query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToSubscription(result.rows[0]);
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    const result = await this.db.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map(row => this.mapRowToSubscription(row));
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      setClause.push(`cancel_at_period_end = $${paramIndex++}`);
      values.push(updates.cancelAtPeriodEnd);
    }
    if (updates.currentPeriodEnd) {
      setClause.push(`current_period_end = $${paramIndex++}`);
      values.push(updates.currentPeriodEnd);
    }

    if (setClause.length === 0) {
      throw new Error('No updates provided');
    }

    setClause.push(`updated_at = NOW()`);
    values.push(subscriptionId);

    await this.db.query(
      `UPDATE subscriptions SET ${setClause.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const updated = await this.getSubscription(subscriptionId);
    if (!updated) {
      throw new Error('Subscription not found after update');
    }
    return updated;
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<void> {
    if (immediate) {
      await this.updateSubscription(subscriptionId, {
        status: SubscriptionStatus.CANCELLED
      });
    } else {
      await this.updateSubscription(subscriptionId, {
        cancelAtPeriodEnd: true
      });
    }
  }

  async renewSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new Error('Subscription is not active');
    }

    const newPeriodEnd = this.calculatePeriodEnd(
      subscription.currentPeriodEnd,
      subscription.interval
    );

    return await this.updateSubscription(subscriptionId, {
      currentPeriodStart: subscription.currentPeriodEnd,
      currentPeriodEnd: newPeriodEnd
    });
  }

  async addCredit(
    userId: string,
    amount: number,
    reason: string,
    type: CreditType,
    expiresAt?: Date,
    invoiceId?: string
  ): Promise<Credit> {
    const credit: Credit = {
      id: randomUUID(),
      userId,
      amount,
      currency: 'EUR',
      reason,
      type,
      expiresAt,
      invoiceId,
      createdAt: new Date(),
      metadata: {}
    };

    await this.saveCredit(credit);
    return credit;
  }

  async useCredit(creditId: string): Promise<void> {
    await this.db.query(
      'UPDATE credits SET used_at = NOW() WHERE id = $1 AND used_at IS NULL',
      [creditId]
    );
  }

  async getUserCredits(userId: string): Promise<Credit[]> {
    const result = await this.db.query(
      `SELECT * FROM credits 
       WHERE user_id = $1 AND (used_at IS NULL OR expires_at > NOW()) 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => this.mapRowToCredit(row));
  }

  async getPlan(planId: string): Promise<Plan | null> {
    const result = await this.db.query(
      'SELECT * FROM plans WHERE id = $1',
      [planId]
    );

    if (result.rows.length === 0) return null;

    return this.mapRowToPlan(result.rows[0]);
  }

  async getAllPlans(): Promise<Plan[]> {
    const result = await this.db.query(
      'SELECT * FROM plans ORDER BY amount ASC'
    );

    return result.rows.map(row => this.mapRowToPlan(row));
  }

  private async saveSubscription(subscription: Subscription): Promise<void> {
    await this.db.query(
      `INSERT INTO subscriptions (
        id, user_id, plan, status, current_period_start, current_period_end,
        cancel_at_period_end, amount, currency, interval, interval_count,
        trial_start, trial_end, created_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        subscription.id,
        subscription.userId,
        subscription.plan,
        subscription.status,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        subscription.cancelAtPeriodEnd,
        subscription.amount,
        subscription.currency,
        subscription.interval,
        subscription.intervalCount,
        subscription.trialStart,
        subscription.trialEnd,
        subscription.createdAt,
        subscription.updatedAt,
        JSON.stringify(subscription.metadata)
      ]
    );
  }

  private async saveCredit(credit: Credit): Promise<void> {
    await this.db.query(
      `INSERT INTO credits (
        id, user_id, amount, currency, reason, type, expires_at, 
        invoice_id, created_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        credit.id,
        credit.userId,
        credit.amount,
        credit.currency,
        credit.reason,
        credit.type,
        credit.expiresAt,
        credit.invoiceId,
        credit.createdAt,
        JSON.stringify(credit.metadata)
      ]
    );
  }

  private calculatePeriodEnd(startDate: Date, interval: 'month' | 'year'): Date {
    const end = new Date(startDate);
    if (interval === 'month') {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  private mapRowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      plan: row.plan,
      status: row.status as SubscriptionStatus,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      amount: parseFloat(row.amount),
      currency: row.currency,
      interval: row.interval as 'month' | 'year',
      intervalCount: row.interval_count,
      trialStart: row.trial_start,
      trialEnd: row.trial_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToCredit(row: any): Credit {
    return {
      id: row.id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      reason: row.reason,
      type: row.type as CreditType,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      invoiceId: row.invoice_id,
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToPlan(row: any): Plan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      interval: row.interval as 'month' | 'year',
      features: row.features,
      limits: JSON.parse(row.limits),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata)
    };
  }
}
