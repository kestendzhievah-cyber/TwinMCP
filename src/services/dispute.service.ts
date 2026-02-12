import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AuditService } from './security/audit.service';
import { BillingNotificationService } from './billing-notification.service';

export interface Dispute {
  id: string;
  paymentId: string;
  userId: string;
  type: 'chargeback' | 'inquiry' | 'fraud' | 'product_issue' | 'billing_error';
  amount: number;
  currency: string;
  reason: string;
  status: 'open' | 'investigating' | 'evidence_submitted' | 'won' | 'lost' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  provider: 'stripe' | 'paypal' | 'wise';
  providerDisputeId?: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  metadata?: Record<string, any>;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  type: 'invoice' | 'receipt' | 'communication' | 'shipping' | 'refund' | 'other';
  description: string;
  fileUrl?: string;
  submittedAt: Date;
  submittedBy: string;
}

export interface DisputeActivity {
  id: string;
  disputeId: string;
  action: string;
  description: string;
  performedBy: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface DisputeWorkflow {
  id: string;
  name: string;
  steps: DisputeWorkflowStep[];
  autoAssign: boolean;
  notificationRules: NotificationRule[];
}

export interface DisputeWorkflowStep {
  id: string;
  name: string;
  description: string;
  assignedTo?: string;
  dueInHours: number;
  requiredActions: string[];
  autoComplete: boolean;
}

export interface NotificationRule {
  event: 'created' | 'updated' | 'escalated' | 'resolved';
  recipients: string[];
  channels: ('email' | 'slack' | 'sms')[];
  template: string;
}

export class DisputeService {
  constructor(
    private db: Pool,
    private auditService: AuditService,
    private notificationService: BillingNotificationService
  ) {}

  async createDispute(
    paymentId: string,
    userId: string,
    options: {
      type: Dispute['type'];
      amount: number;
      currency: string;
      reason: string;
      provider: Dispute['provider'];
      providerDisputeId?: string;
      dueDate?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<Dispute> {
    const disputeId = randomUUID();

    const priority = this.calculatePriority(options.amount, options.type);

    const dispute: Dispute = {
      id: disputeId,
      paymentId,
      userId,
      type: options.type,
      amount: options.amount,
      currency: options.currency,
      reason: options.reason,
      status: 'open',
      priority,
      provider: options.provider,
      providerDisputeId: options.providerDisputeId,
      dueDate: options.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata,
    };

    await this.db.query(
      `INSERT INTO disputes (
        id, payment_id, user_id, type, amount, currency, reason, status,
        priority, provider, provider_dispute_id, due_date, created_at, updated_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        dispute.id,
        dispute.paymentId,
        dispute.userId,
        dispute.type,
        dispute.amount,
        dispute.currency,
        dispute.reason,
        dispute.status,
        dispute.priority,
        dispute.provider,
        dispute.providerDisputeId,
        dispute.dueDate,
        dispute.createdAt,
        dispute.updatedAt,
        JSON.stringify(dispute.metadata || {}),
      ]
    );

    await this.logActivity(disputeId, 'created', 'Dispute created', 'system');

    await this.notifyTeam(dispute, 'created');

    await this.auditService.logAccess(
      userId,
      'dispute',
      disputeId,
      'create',
      { type: options.type, amount: options.amount }
    );

    return dispute;
  }

  async submitEvidence(
    disputeId: string,
    evidence: {
      type: DisputeEvidence['type'];
      description: string;
      fileUrl?: string;
      submittedBy: string;
    }
  ): Promise<DisputeEvidence> {
    const evidenceId = randomUUID();

    const disputeEvidence: DisputeEvidence = {
      id: evidenceId,
      disputeId,
      type: evidence.type,
      description: evidence.description,
      fileUrl: evidence.fileUrl,
      submittedAt: new Date(),
      submittedBy: evidence.submittedBy,
    };

    await this.db.query(
      `INSERT INTO dispute_evidence (
        id, dispute_id, type, description, file_url, submitted_at, submitted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        disputeEvidence.id,
        disputeEvidence.disputeId,
        disputeEvidence.type,
        disputeEvidence.description,
        disputeEvidence.fileUrl,
        disputeEvidence.submittedAt,
        disputeEvidence.submittedBy,
      ]
    );

    await this.updateDisputeStatus(disputeId, 'evidence_submitted');

    await this.logActivity(
      disputeId,
      'evidence_submitted',
      `Evidence submitted: ${evidence.type}`,
      evidence.submittedBy
    );

    return disputeEvidence;
  }

  async updateDisputeStatus(
    disputeId: string,
    status: Dispute['status'],
    resolution?: string
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'won' || status === 'lost' || status === 'closed') {
      updates.resolved_at = new Date();
      if (resolution) {
        updates.resolution = resolution;
      }
    }

    const setClauses = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    await this.db.query(
      `UPDATE disputes SET ${setClauses} WHERE id = $${Object.keys(updates).length + 1}`,
      [...Object.values(updates), disputeId]
    );

    await this.logActivity(
      disputeId,
      'status_changed',
      `Status changed to ${status}`,
      'system'
    );

    const dispute = await this.getDispute(disputeId);
    if (dispute) {
      await this.notifyTeam(dispute, 'updated');
    }
  }

  async escalateDispute(
    disputeId: string,
    reason: string,
    escalatedBy: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE disputes 
       SET priority = 'critical', updated_at = $1
       WHERE id = $2`,
      [new Date(), disputeId]
    );

    await this.logActivity(
      disputeId,
      'escalated',
      `Dispute escalated: ${reason}`,
      escalatedBy
    );

    const dispute = await this.getDispute(disputeId);
    if (dispute) {
      await this.notifyTeam(dispute, 'escalated');
    }
  }

  async getDispute(disputeId: string): Promise<Dispute | null> {
    const result = await this.db.query(
      'SELECT * FROM disputes WHERE id = $1',
      [disputeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDispute(result.rows[0]);
  }

  async getDisputesByUser(
    userId: string,
    options: {
      status?: Dispute['status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ disputes: Dispute[]; total: number }> {
    let query = 'SELECT * FROM disputes WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const countResult = await this.db.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options.limit || 50, options.offset || 0);

    const result = await this.db.query(query, params);

    return {
      disputes: result.rows.map(row => this.mapRowToDispute(row)),
      total: Number.parseInt(countResult.rows[0].count, 10),
    };
  }

  async getDisputeActivity(disputeId: string): Promise<DisputeActivity[]> {
    const result = await this.db.query(
      'SELECT * FROM dispute_activities WHERE dispute_id = $1 ORDER BY created_at DESC',
      [disputeId]
    );

    return result.rows.map(row => ({
      id: row.id,
      disputeId: row.dispute_id,
      action: row.action,
      description: row.description,
      performedBy: row.performed_by,
      createdAt: new Date(row.created_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async getDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
    const result = await this.db.query(
      'SELECT * FROM dispute_evidence WHERE dispute_id = $1 ORDER BY submitted_at DESC',
      [disputeId]
    );

    return result.rows.map(row => ({
      id: row.id,
      disputeId: row.dispute_id,
      type: row.type,
      description: row.description,
      fileUrl: row.file_url,
      submittedAt: new Date(row.submitted_at),
      submittedBy: row.submitted_by,
    }));
  }

  async generateDisputeReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDisputes: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    winRate: number;
    averageResolutionTime: number;
    totalAmount: number;
  }> {
    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total,
        type,
        status,
        SUM(amount) as total_amount,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
       FROM disputes
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY type, status`,
      [startDate, endDate]
    );

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalAmount = 0;
    let wonCount = 0;
    let resolvedCount = 0;
    let totalResolutionTime = 0;

    for (const row of result.rows) {
      byType[row.type] = (byType[row.type] || 0) + Number.parseInt(row.total, 10);
      byStatus[row.status] = (byStatus[row.status] || 0) + Number.parseInt(row.total, 10);
      totalAmount += Number.parseFloat(row.total_amount || 0);

      if (row.status === 'won') {
        wonCount += Number.parseInt(row.total, 10);
      }

      if (row.status === 'won' || row.status === 'lost' || row.status === 'closed') {
        resolvedCount += Number.parseInt(row.total, 10);
        totalResolutionTime += Number.parseFloat(row.avg_resolution_hours || 0) * Number.parseInt(row.total, 10);
      }
    }

    const totalDisputes = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    const winRate = resolvedCount > 0 ? (wonCount / resolvedCount) * 100 : 0;
    const averageResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;

    return {
      totalDisputes,
      byType,
      byStatus,
      winRate,
      averageResolutionTime,
      totalAmount,
    };
  }

  private async logActivity(
    disputeId: string,
    action: string,
    description: string,
    performedBy: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO dispute_activities (
        id, dispute_id, action, description, performed_by, created_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        disputeId,
        action,
        description,
        performedBy,
        new Date(),
        JSON.stringify(metadata || {}),
      ]
    );
  }

  private async notifyTeam(
    dispute: Dispute,
    event: 'created' | 'updated' | 'escalated' | 'resolved'
  ): Promise<void> {
    const teamEmails = process.env.DISPUTE_TEAM_EMAILS?.split(',') || [];

    for (const email of teamEmails) {
      try {
        console.log(`Notifying ${email} about dispute ${dispute.id} - ${event}`);
      } catch (error) {
        console.error('Failed to send dispute notification:', error);
      }
    }
  }

  private calculatePriority(amount: number, type: Dispute['type']): Dispute['priority'] {
    if (type === 'fraud' || amount > 10000) {
      return 'critical';
    }
    if (amount > 1000) {
      return 'high';
    }
    if (amount > 100) {
      return 'medium';
    }
    return 'low';
  }

  private mapRowToDispute(row: any): Dispute {
    return {
      id: row.id,
      paymentId: row.payment_id,
      userId: row.user_id,
      type: row.type,
      amount: Number.parseFloat(row.amount),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      priority: row.priority,
      provider: row.provider,
      providerDisputeId: row.provider_dispute_id,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolution: row.resolution,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
