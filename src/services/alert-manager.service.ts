import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import {
  Alert,
  AlertRule,
  AlertThreshold,
  AlertAnnotation,
  NotificationChannel,
  EscalationPolicy,
  MonitoringConfig
} from '../types/monitoring.types';

export class AlertManager extends EventEmitter {
  private activeAlerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private alertHistory: Map<string, Date[]> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private config: MonitoringConfig['alerts']
  ) {
    super();
    this.initializeAlertManager();
  }

  private async initializeAlertManager(): Promise<void> {
    // Load existing alert rules
    await this.loadAlertRules();
    
    // Load notification channels
    await this.loadNotificationChannels();
    
    // Load escalation policies
    await this.loadEscalationPolicies();
    
    // Load active alerts
    await this.loadActiveAlerts();
    
    // Start cleanup interval
    setInterval(() => {
      this.cleanupOldAlerts().catch(console.error);
    }, 60000); // Every minute
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const fullRule: AlertRule = {
      ...rule,
      id: crypto.randomUUID()
    };

    await this.saveAlertRule(fullRule);
    this.alertRules.set(fullRule.id, fullRule);

    this.emit('alert_rule_created', fullRule);
    return fullRule;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const rule = this.alertRules.get(id);
    if (!rule) {
      throw new Error(`Alert rule ${id} not found`);
    }

    const updatedRule = { ...rule, ...updates };
    await this.saveAlertRule(updatedRule);
    this.alertRules.set(id, updatedRule);

    this.emit('alert_rule_updated', updatedRule);
    return updatedRule;
  }

  async deleteAlertRule(id: string): Promise<void> {
    const rule = this.alertRules.get(id);
    if (!rule) {
      throw new Error(`Alert rule ${id} not found`);
    }

    await this.db.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    this.alertRules.delete(id);

    this.emit('alert_rule_deleted', { id });
  }

  async evaluateRules(metrics: any): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(rule, metrics);
        
        if (shouldAlert) {
          const alert = await this.createAlertFromRule(rule, metrics);
          triggeredAlerts.push(alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }

    return triggeredAlerts;
  }

  private async evaluateRule(rule: AlertRule, metrics: any): Promise<boolean> {
    const value = this.getMetricValue(metrics, rule.metric);
    const threshold = rule.threshold;
    
    let conditionMet = false;
    
    switch (threshold.operator) {
      case 'gt':
        conditionMet = value > threshold.value;
        break;
      case 'gte':
        conditionMet = value >= threshold.value;
        break;
      case 'lt':
        conditionMet = value < threshold.value;
        break;
      case 'lte':
        conditionMet = value <= threshold.value;
        break;
      case 'eq':
        conditionMet = value === threshold.value;
        break;
      case 'ne':
        conditionMet = value !== threshold.value;
        break;
    }

    if (!conditionMet) return false;

    // Check cooldown period
    const now = new Date();
    const history = this.alertHistory.get(rule.id) || [];
    const recentAlerts = history.filter(timestamp => 
      (now.getTime() - timestamp.getTime()) < rule.cooldown * 1000
    );

    if (recentAlerts.length > 0) {
      return false; // Still in cooldown
    }

    return true;
  }

  private getMetricValue(metrics: any, metricPath: string): number {
    const parts = metricPath.split('.');
    let value = metrics;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private async createAlertFromRule(rule: AlertRule, metrics: any): Promise<Alert> {
    const value = this.getMetricValue(metrics, rule.metric);
    
    const alert: Alert = {
      id: crypto.randomUUID(),
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: 'active',
      source: rule.source,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: value,
      timestamp: new Date(),
      tags: rule.tags,
      annotations: []
    };

    await this.saveAlert(alert);
    this.activeAlerts.set(alert.id, alert);

    // Update alert history
    const history = this.alertHistory.get(rule.id) || [];
    history.push(alert.timestamp);
    this.alertHistory.set(rule.id, history);

    // Send notifications
    await this.sendNotifications(alert);

    this.emit('alert_created', alert);
    return alert;
  }

  async acknowledgeAlert(alertId: string, userId: string, message?: string): Promise<Alert> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    if (message) {
      alert.annotations.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        author: userId,
        message,
        type: 'note'
      });
    }

    await this.updateAlert(alert);
    this.activeAlerts.set(alertId, alert);

    this.emit('alert_acknowledged', alert);
    return alert;
  }

  async resolveAlert(alertId: string, userId: string, resolution?: string): Promise<Alert> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;

    if (resolution) {
      alert.annotations.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        author: userId,
        message: resolution,
        type: 'resolution'
      });
    }

    await this.updateAlert(alert);
    this.activeAlerts.delete(alertId);

    this.emit('alert_resolved', alert);
    return alert;
  }

  async addAlertAnnotation(alertId: string, annotation: Omit<AlertAnnotation, 'id' | 'timestamp'>): Promise<Alert> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const fullAnnotation: AlertAnnotation = {
      ...annotation,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    alert.annotations.push(fullAnnotation);
    await this.updateAlert(alert);
    this.activeAlerts.set(alertId, alert);

    this.emit('alert_annotated', { alertId, annotation: fullAnnotation });
    return alert;
  }

  async getActiveAlerts(filters?: {
    severity?: Alert['severity'];
    source?: string;
    tags?: string[];
  }): Promise<Alert[]> {
    let alerts = Array.from(this.activeAlerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.source) {
        alerts = alerts.filter(a => a.source === filters.source);
      }
      if (filters.tags) {
        alerts = alerts.filter(a => 
          filters.tags!.some(tag => a.tags.includes(tag))
        );
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createNotificationChannel(channel: Omit<NotificationChannel, 'id'>): Promise<NotificationChannel> {
    const fullChannel: NotificationChannel = {
      ...channel,
      id: crypto.randomUUID()
    };

    await this.saveNotificationChannel(fullChannel);
    this.notificationChannels.set(fullChannel.id, fullChannel);

    this.emit('notification_channel_created', fullChannel);
    return fullChannel;
  }

  async createEscalationPolicy(policy: Omit<EscalationPolicy, 'id'>): Promise<EscalationPolicy> {
    const fullPolicy: EscalationPolicy = {
      ...policy,
      id: crypto.randomUUID()
    };

    await this.saveEscalationPolicy(fullPolicy);
    this.escalationPolicies.set(fullPolicy.id, fullPolicy);

    this.emit('escalation_policy_created', fullPolicy);
    return fullPolicy;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    if (!this.config.enabled) return;

    const channels = Array.from(this.notificationChannels.values())
      .filter(channel => channel.enabled);

    const notifications = channels.map(channel => 
      this.sendNotification(channel, alert).catch(error => {
        console.error(`Failed to send notification via ${channel.name}:`, error);
      })
    );

    await Promise.allSettled(notifications);

    // Check escalation policies
    await this.checkEscalation(alert);
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(channel, alert);
        break;
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Placeholder implementation
    console.log(`Email notification sent to ${channel.config.recipients}: ${alert.name}`);
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const webhook = channel.config.webhook;
    const payload = {
      text: `🚨 Alert: ${alert.name}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Description', value: alert.description, short: false },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Current Value', value: alert.currentValue.toString(), short: true },
          { title: 'Threshold', value: `${alert.threshold.operator} ${alert.threshold.value}`, short: true }
        ],
        timestamp: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };

    // Send to Slack webhook
    console.log(`Slack notification sent to ${webhook}:`, payload);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const url = channel.config.url;
    const payload = {
      alert,
      timestamp: new Date().toISOString()
    };

    // Send to webhook
    console.log(`Webhook notification sent to ${url}:`, payload);
  }

  private async sendSMSNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Placeholder implementation
    console.log(`SMS notification sent to ${channel.config.phoneNumber}: ${alert.name}`);
  }

  private getSeverityColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'info': return 'good';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      case 'critical': return '#ff0000';
      default: return 'good';
    }
  }

  private async checkEscalation(alert: Alert): Promise<void> {
    for (const policy of this.escalationPolicies.values()) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        const shouldEscalate = await this.shouldEscalate(alert, rule);
        
        if (shouldEscalate) {
          const channel = this.notificationChannels.get(rule.channel);
          if (channel && channel.enabled) {
            await this.sendNotification(channel, alert);
          }
        }
      }
    }
  }

  private async shouldEscalate(alert: Alert, rule: any): Promise<boolean> {
    const now = new Date();
    const alertAge = (now.getTime() - alert.timestamp.getTime()) / (1000 * 60); // in minutes

    if (alertAge < rule.delay) return false;

    if (rule.conditions.severity && !rule.conditions.severity.includes(alert.severity)) {
      return false;
    }

    if (rule.conditions.duration && alertAge < rule.conditions.duration) {
      return false;
    }

    return true;
  }

  // Database operations
  private async loadAlertRules(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM alert_rules');
      for (const row of result.rows) {
        const rule: AlertRule = {
          id: row.id,
          name: row.name,
          description: row.description,
          metric: row.metric,
          threshold: JSON.parse(row.threshold),
          severity: row.severity,
          source: row.source,
          tags: JSON.parse(row.tags),
          enabled: row.enabled,
          cooldown: row.cooldown
        };
        this.alertRules.set(rule.id, rule);
      }
    } catch (error) {
      console.error('Error loading alert rules:', error);
    }
  }

  private async loadNotificationChannels(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM notification_channels');
      for (const row of result.rows) {
        const channel: NotificationChannel = {
          id: row.id,
          name: row.name,
          type: row.type,
          config: JSON.parse(row.config),
          enabled: row.enabled
        };
        this.notificationChannels.set(channel.id, channel);
      }
    } catch (error) {
      console.error('Error loading notification channels:', error);
    }
  }

  private async loadEscalationPolicies(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM escalation_policies');
      for (const row of result.rows) {
        const policy: EscalationPolicy = {
          id: row.id,
          name: row.name,
          rules: JSON.parse(row.rules),
          enabled: row.enabled
        };
        this.escalationPolicies.set(policy.id, policy);
      }
    } catch (error) {
      console.error('Error loading escalation policies:', error);
    }
  }

  private async loadActiveAlerts(): Promise<void> {
    try {
      const result = await this.db.query(
        'SELECT * FROM alerts WHERE status IN ($1, $2)',
        ['active', 'acknowledged']
      );
      
      for (const row of result.rows) {
        const alert: Alert = {
          id: row.id,
          name: row.name,
          description: row.description,
          severity: row.severity,
          status: row.status,
          source: row.source,
          metric: row.metric,
          threshold: JSON.parse(row.threshold),
          currentValue: row.current_value,
          timestamp: row.created_at,
          acknowledgedAt: row.acknowledged_at,
          resolvedAt: row.resolved_at,
          acknowledgedBy: row.acknowledged_by,
          resolvedBy: row.resolved_by,
          tags: JSON.parse(row.tags),
          annotations: JSON.parse(row.annotations || '[]')
        };
        this.activeAlerts.set(alert.id, alert);
      }
    } catch (error) {
      console.error('Error loading active alerts:', error);
    }
  }

  private async saveAlertRule(rule: AlertRule): Promise<void> {
    await this.db.query(`
      INSERT INTO alert_rules (
        id, name, description, metric, threshold, severity, source, tags, enabled, cooldown
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        metric = EXCLUDED.metric,
        threshold = EXCLUDED.threshold,
        severity = EXCLUDED.severity,
        source = EXCLUDED.source,
        tags = EXCLUDED.tags,
        enabled = EXCLUDED.enabled,
        cooldown = EXCLUDED.cooldown
    `, [
      rule.id,
      rule.name,
      rule.description,
      rule.metric,
      JSON.stringify(rule.threshold),
      rule.severity,
      rule.source,
      JSON.stringify(rule.tags),
      rule.enabled,
      rule.cooldown
    ]);
  }

  private async saveNotificationChannel(channel: NotificationChannel): Promise<void> {
    await this.db.query(`
      INSERT INTO notification_channels (
        id, name, type, config, enabled
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        config = EXCLUDED.config,
        enabled = EXCLUDED.enabled
    `, [
      channel.id,
      channel.name,
      channel.type,
      JSON.stringify(channel.config),
      channel.enabled
    ]);
  }

  private async saveEscalationPolicy(policy: EscalationPolicy): Promise<void> {
    await this.db.query(`
      INSERT INTO escalation_policies (
        id, name, rules, enabled
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        rules = EXCLUDED.rules,
        enabled = EXCLUDED.enabled
    `, [
      policy.id,
      policy.name,
      JSON.stringify(policy.rules),
      policy.enabled
    ]);
  }

  private async saveAlert(alert: Alert): Promise<void> {
    await this.db.query(`
      INSERT INTO alerts (
        id, name, description, severity, status, source, metric,
        threshold, current_value, created_at, tags, annotations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        acknowledged_at = EXCLUDED.acknowledged_at,
        acknowledged_by = EXCLUDED.acknowledged_by,
        resolved_at = EXCLUDED.resolved_at,
        resolved_by = EXCLUDED.resolved_by,
        annotations = EXCLUDED.annotations
    `, [
      alert.id,
      alert.name,
      alert.description,
      alert.severity,
      alert.status,
      alert.source,
      alert.metric,
      JSON.stringify(alert.threshold),
      alert.currentValue,
      alert.timestamp,
      JSON.stringify(alert.tags),
      JSON.stringify(alert.annotations)
    ]);
  }

  private async updateAlert(alert: Alert): Promise<void> {
    await this.db.query(`
      UPDATE alerts SET
        status = $1,
        acknowledged_at = $2,
        acknowledged_by = $3,
        resolved_at = $4,
        resolved_by = $5,
        annotations = $6
      WHERE id = $7
    `, [
      alert.status,
      alert.acknowledgedAt,
      alert.acknowledgedBy,
      alert.resolvedAt,
      alert.resolvedBy,
      JSON.stringify(alert.annotations),
      alert.id
    ]);
  }

  private async cleanupOldAlerts(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await this.db.query(
      'DELETE FROM alerts WHERE status = $1 AND resolved_at < $2',
      ['resolved', thirtyDaysAgo]
    );
  }
}
