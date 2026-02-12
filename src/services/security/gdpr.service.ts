import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';

export class GDPRService {
  constructor(
    private db: Pool,
    private encryptionService: EncryptionService,
    private auditService: AuditService
  ) {}

  async recordConsent(userId: string, consentData: ConsentData): Promise<void> {
    const consent: UserConsent = {
      id: randomUUID(),
      userId,
      consents: consentData.consents,
      ipAddress: this.anonymizeIP(consentData.ipAddress),
      userAgent: consentData.userAgent,
      timestamp: new Date(),
      version: '1.0',
      legalBasis: consentData.legalBasis,
      retentionPeriod: this.calculateRetentionPeriod(consentData.consents)
    };

    await this.db.query(`
      INSERT INTO user_consents (
        id, user_id, consents, ip_address, user_agent,
        timestamp, version, legal_basis, retention_period
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      consent.id,
      consent.userId,
      JSON.stringify(consent.consents),
      consent.ipAddress,
      consent.userAgent,
      consent.timestamp,
      consent.version,
      consent.legalBasis,
      consent.retentionPeriod
    ]);

    await this.auditService.logAccess(
      userId,
      'consent',
      consent.id,
      'record_consent',
      consentData.ipAddress,
      consentData.userAgent
    );
  }

  async anonymizeUser(userId: string, reason: string, requestorId: string): Promise<void> {
    await this.auditService.logSecurityEvent(
      'data_anonymization',
      'high',
      `User data anonymization requested for user ${userId}`,
      requestorId
    );

    await this.anonymizeUserData(userId);
    await this.deleteSensitiveData(userId);
    await this.preserveNecessaryData(userId);
    await this.recordDataDeletionRequest(userId, reason);
  }

  async exportUserData(userId: string, requestorId: string): Promise<UserDataExport> {
    await this.auditService.logAccess(
      requestorId,
      'user_data',
      userId,
      'export_request',
      'system',
      'GDPR export'
    );

    const userData = await this.collectUserData(userId);
    
    return {
      personalData: this.maskForExport(userData.personalData),
      invoices: userData.invoices.map((invoice: any) => ({
        ...invoice,
        billingAddress: this.maskForExport(invoice.billingAddress)
      })),
      preferences: userData.preferences,
      usageData: this.anonymizeUsageData(userData.usageData),
      exportDate: new Date(),
      format: 'json',
      version: '1.0'
    };
  }

  async processDataAccessRequest(userId: string): Promise<DataAccessReport> {
    const userData = await this.collectUserData(userId);
    const processingActivities = await this.getProcessingActivities(userId);
    
    return {
      requestId: randomUUID(),
      userId,
      dataCollected: this.categorizeData(userData),
      processingPurposes: this.getProcessingPurposes(),
      dataRecipients: this.getDataRecipients(userId),
      retentionPeriod: this.getRetentionPeriods(),
      rights: this.getUserRights(),
      automatedDecisionMaking: this.getAutomatedDecisions(userId),
      timestamp: new Date()
    };
  }

  private async anonymizeUserData(userId: string): Promise<void> {
    const pseudonym = this.generatePseudonym();
    
    await this.db.query(`
      UPDATE user_profiles SET
        first_name = 'User',
        last_name = $1,
        email = $2,
        phone = NULL,
        address = NULL,
        city = NULL,
        state = NULL,
        country = NULL,
        postal_code = NULL,
        updated_at = NOW()
      WHERE user_id = $3
    `, [
      pseudonym,
      `${pseudonym}@anonymized.twinme.ai`,
      userId
    ]);
  }

  private async deleteSensitiveData(userId: string): Promise<void> {
    const sensitiveTables = [
      'user_sessions',
      'user_analytics',
      'stream_connections',
      'stream_chunks'
    ];

    for (const table of sensitiveTables) {
      await this.db.query(`
        DELETE FROM ${table} WHERE user_id = $1
      `, [userId]);
    }
  }

  private async preserveNecessaryData(userId: string): Promise<void> {
    await this.db.query(`
      UPDATE invoices SET
        user_id = 'anon_' || $1,
        billing_address = $2,
        updated_at = NOW()
      WHERE user_id = $1
    `, [
      userId,
      JSON.stringify({
        anonymized: true,
        originalUserId: this.generatePseudonym()
      })
    ]);
  }

  private async recordDataDeletionRequest(userId: string, reason: string): Promise<void> {
    await this.db.query(`
      INSERT INTO data_deletion_requests (
        id, user_id, reason, status, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      randomUUID(),
      userId,
      reason,
      'completed'
    ]);
  }

  private async collectUserData(userId: string): Promise<any> {
    const [profile, invoices, preferences, usage] = await Promise.all([
      this.db.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]),
      this.db.query('SELECT * FROM invoices WHERE user_id = $1', [userId]),
      this.db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]),
      this.db.query('SELECT * FROM usage_logs WHERE user_id = $1 LIMIT 1000', [userId])
    ]);

    return {
      personalData: profile.rows[0] || {},
      invoices: invoices.rows,
      preferences: preferences.rows[0] || {},
      usageData: usage.rows
    };
  }

  private generatePseudonym(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private anonymizeIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return '***.***.***.***';
  }

  private maskForExport(data: any): any {
    return {
      ...data,
      email: data.email ? data.email.replace(/(.{2}).*@/, '$1***@') : null,
      phone: data.phone ? data.phone.replace(/(.{3}).*-(.{4})/, '$1****-$2') : null
    };
  }

  private anonymizeUsageData(data: any[]): any[] {
    return data.map(entry => ({
      ...entry,
      user_id: this.generatePseudonym(),
      ip_address: this.anonymizeIP(entry.ip_address || '')
    }));
  }

  private calculateRetentionPeriod(consents: Record<string, boolean>): number {
    return consents.analytics ? 730 : 365;
  }

  private categorizeData(userData: any): any {
    return {
      personal: ['name', 'email', 'phone', 'address'],
      financial: ['invoices', 'billing'],
      usage: ['usage_logs', 'analytics'],
      preferences: ['preferences', 'consents']
    };
  }

  private getProcessingPurposes(): string[] {
    return [
      'service_provision',
      'billing',
      'analytics',
      'support',
      'legal_compliance'
    ];
  }

  private getDataRecipients(userId: string): string[] {
    return [
      'internal_support',
      'payment_processors',
      'analytics_providers'
    ];
  }

  private getRetentionPeriods(): Record<string, number> {
    return {
      personal_data: 365,
      billing_data: 2555,
      analytics_data: 730,
      logs: 90
    };
  }

  private getUserRights(): string[] {
    return [
      'right_to_access',
      'right_to_rectification',
      'right_to_erasure',
      'right_to_portability',
      'right_to_object',
      'right_to_restriction'
    ];
  }

  private async getProcessingActivities(userId: string): Promise<any[]> {
    return [];
  }

  private getAutomatedDecisions(userId: string): any[] {
    return [];
  }
}

interface ConsentData {
  consents: Record<string, boolean>;
  ipAddress: string;
  userAgent: string;
  legalBasis: string;
}

interface UserConsent {
  id: string;
  userId: string;
  consents: Record<string, boolean>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  version: string;
  legalBasis: string;
  retentionPeriod: number;
}

interface UserDataExport {
  personalData: any;
  invoices: any[];
  preferences: any;
  usageData: any[];
  exportDate: Date;
  format: string;
  version: string;
}

interface DataAccessReport {
  requestId: string;
  userId: string;
  dataCollected: any;
  processingPurposes: string[];
  dataRecipients: string[];
  retentionPeriod: Record<string, number>;
  rights: string[];
  automatedDecisionMaking: any[];
  timestamp: Date;
}
