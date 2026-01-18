import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { DataMaskingService } from './data-masking.service';

export class AuditService {
  constructor(
    private db: Pool,
    private maskingService: DataMaskingService
  ) {}

  async logAccess(
    userId: string,
    resource: string,
    resourceId: string,
    action: string,
    metadataOrIpAddress?: string | any,
    userAgent?: string,
    metadata?: any
  ): Promise<void> {
    let ipAddress = 'unknown';
    let actualUserAgent = 'unknown';
    let actualMetadata = metadata;

    if (typeof metadataOrIpAddress === 'string') {
      ipAddress = metadataOrIpAddress;
      actualUserAgent = userAgent || 'unknown';
    } else if (typeof metadataOrIpAddress === 'object') {
      actualMetadata = metadataOrIpAddress;
    }
    const auditLog = {
      id: randomUUID(),
      userId,
      resource,
      resourceId,
      action,
      ipAddress: this.maskIpAddress(ipAddress),
      userAgent: this.maskUserAgent(actualUserAgent),
      metadata: actualMetadata ? this.maskingService.maskForLogging(actualMetadata) : null,
      timestamp: new Date()
    };

    await this.db.query(`
      INSERT INTO audit_logs (
        id, user_id, resource, resource_id, action, 
        ip_address, user_agent, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      auditLog.id,
      auditLog.userId,
      auditLog.resource,
      auditLog.resourceId,
      auditLog.action,
      auditLog.ipAddress,
      auditLog.userAgent,
      JSON.stringify(auditLog.metadata),
      auditLog.timestamp
    ]);
  }

  async logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    userId?: string,
    ipAddress?: string,
    metadata?: any
  ): Promise<void> {
    const securityEvent = {
      id: randomUUID(),
      eventType,
      severity,
      description,
      userId: userId || null,
      ipAddress: ipAddress ? this.maskIpAddress(ipAddress) : null,
      metadata: metadata ? this.maskingService.maskForLogging(metadata) : null,
      timestamp: new Date()
    };

    await this.db.query(`
      INSERT INTO security_events (
        id, event_type, severity, description, user_id,
        ip_address, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      securityEvent.id,
      securityEvent.eventType,
      securityEvent.severity,
      securityEvent.description,
      securityEvent.userId,
      securityEvent.ipAddress,
      JSON.stringify(securityEvent.metadata),
      securityEvent.timestamp
    ]);
  }

  async getAccessLogs(
    userId?: string,
    resource?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    let query = `
      SELECT * FROM audit_logs 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (resource) {
      query += ` AND resource = $${paramIndex++}`;
      params.push(resource);
    }

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  async getSecurityEvents(
    eventType?: string,
    severity?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    let query = `
      SELECT * FROM security_events 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      query += ` AND event_type = $${paramIndex++}`;
      params.push(eventType);
    }

    if (severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  private maskIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return '***.***.***.***';
  }

  private maskUserAgent(userAgent: string): string {
    return userAgent.length > 100 ? userAgent.substring(0, 100) + '...' : userAgent;
  }
}
