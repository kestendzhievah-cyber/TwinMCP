import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { 
  StreamBillingRecord, 
  StreamBillingConfig, 
  StreamUsageReport,
  StreamMetrics,
  BillingService
} from '../types/streaming.types';

export class StreamingBillingService implements BillingService {
  constructor(private db: Pool) {}

  async calculateStreamingCost(record: StreamBillingRecord, config: StreamBillingConfig): Promise<number> {
    const { usage } = record;
    const { pricing } = config;
    let totalCost = 0;

    // Coût de streaming (durée + bande passante)
    let streamingCost = 
      (usage.totalDuration * pricing.streaming.perSecond) +
      ((usage.totalBytes / (1024 * 1024)) * pricing.streaming.perMegabyte);

    // Prime pour haute bande passante
    if (usage.peakBandwidth > 1048576) { // > 1MB/s
      const excessBandwidth = usage.peakBandwidth - 1048576;
      streamingCost += (excessBandwidth / 1024) * pricing.streaming.peakBandwidthPremium;
    }

    // Coût des tokens
    const tokenCost = 
      ((typeof usage.totalTokens === 'object' && usage.totalTokens.input) ? (usage.totalTokens.input / 1000) * pricing.tokens.input : 0) +
      ((typeof usage.totalTokens === 'object' && usage.totalTokens.output) ? (usage.totalTokens.output / 1000) * pricing.tokens.output : 0);

    // Coût d'infrastructure
    const infrastructureCost = 
      pricing.infrastructure.baseCost +
      ((usage.totalDuration / 3600) * pricing.infrastructure.perConnectionHour);

    totalCost = streamingCost + tokenCost + infrastructureCost;

    // Application des taxes
    if (config.taxRate) {
      totalCost *= (1 + config.taxRate);
    }

    return Math.round(totalCost * 10000) / 10000; // 4 décimales
  }

  async generateBillingReport(userId: string, period: string): Promise<StreamUsageReport> {
    // Récupération des enregistrements de facturation pour la période
    const billingRecords = await this.getBillingRecords(userId, period);
    
    // Calcul de l'utilisation totale
    const totalUsage = this.calculateTotalUsage(billingRecords);
    
    // Agrégation par provider
    const byProvider = this.aggregateByProvider(billingRecords);
    
    // Agrégation par purpose
    const byPurpose = this.aggregateByPurpose(billingRecords);
    
    // Métriques de performance
    const performance = this.calculatePerformanceMetrics(billingRecords);
    
    // Tendances
    const trends = await this.calculateTrends(userId, period);

    return {
      userId,
      period,
      totalUsage,
      byProvider,
      byPurpose,
      performance,
      trends
    };
  }

  async processBilling(records: StreamBillingRecord[]): Promise<void> {
    for (const record of records) {
      try {
        // Récupération de la configuration de facturation
        const config = await this.getBillingConfig(record.provider, record.model);
        
        if (!config) {
          logger.error(`No billing config found for ${record.provider}/${record.model}`);
          record.billingStatus = 'failed';
          continue;
        }

        // Calcul du coût
        const baseCost = await this.calculateStreamingCost(record, config);
        
        // Application des discounts
        const discountedCost = this.applyDiscounts(baseCost, record.usage.totalTokens, config.discounts || []);
        
        // Vérification des SLA et pénalités
        const slaPenalty = await this.calculateSLAPenalty(record, config.sla);
        
        const finalCost = Math.max(0, discountedCost - slaPenalty);

        // Mise à jour de l'enregistrement
        record.cost.totalCost = finalCost;
        record.billingStatus = 'processed';
        record.processedAt = new Date();

        // Sauvegarde en base
        await this.saveBillingRecord(record);

        // Mise à jour du rapport d'utilisation
        await this.updateUsageReport(record);

      } catch (error) {
        logger.error(`Error processing billing record ${record.id}:`, error);
        record.billingStatus = 'failed';
        await this.saveBillingRecord(record);
      }
    }
  }

  applyDiscounts(cost: number, usage: number | { input: number; output: number }, discounts: any[]): number {
    let discountedCost = cost;
    const totalUsage = typeof usage === 'object' ? usage.input + usage.output : usage;

    for (const discount of discounts) {
      if (totalUsage >= discount.volumeThreshold) {
        discountedCost *= (1 - discount.discountPercentage);
      }
    }

    return discountedCost;
  }

  async calculateSLAPenalty(record: StreamBillingRecord, sla: any): Promise<number> {
    if (!sla) return 0;

    let penalty = 0;

    // Récupération des métriques pour la connexion
    const metrics = await this.getConnectionMetrics(record.connectionId);
    if (!metrics) return 0;

    // Pénalité pour uptime
    if (metrics.quality.completionRate < sla.uptimeGuarantee) {
      const uptimeViolation = sla.uptimeGuarantee - metrics.quality.completionRate;
      penalty += record.cost.totalCost * uptimeViolation * sla.penaltyRate;
    }

    // Pénalité pour latence
    if (metrics.performance.latency.average > sla.latencyGuarantee) {
      const latencyViolation = metrics.performance.latency.average - sla.latencyGuarantee;
      penalty += record.cost.totalCost * (latencyViolation / sla.latencyGuarantee) * sla.penaltyRate;
    }

    // Pénalité pour bande passante
    if (metrics.network.averageRTT < sla.bandwidthGuarantee) {
      const bandwidthViolation = sla.bandwidthGuarantee - metrics.network.averageRTT;
      penalty += record.cost.totalCost * (bandwidthViolation / sla.bandwidthGuarantee) * sla.penaltyRate;
    }

    return penalty;
  }

  async getBillingConfig(provider: string, model: string): Promise<StreamBillingConfig | null> {
    const result = await this.db.query(
      'SELECT * FROM stream_billing_configs WHERE provider = $1 AND model = $2',
      [provider, model]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      provider: row.provider,
      model: row.model,
      pricing: row.pricing,
      billingCycle: row.billing_cycle,
      currency: row.currency,
      taxRate: parseFloat(row.tax_rate),
      discounts: row.discounts,
      sla: row.sla
    };
  }

  async getBillingRecords(userId: string, period: string): Promise<StreamBillingRecord[]> {
    const result = await this.db.query(
      'SELECT * FROM stream_billing_records WHERE user_id = $1 AND period = $2 ORDER BY created_at DESC',
      [userId, period]
    );

    return result.rows.map(row => ({
      id: row.id,
      connectionId: row.connection_id,
      userId: row.user_id,
      provider: row.provider,
      model: row.model,
      period: row.period,
      usage: row.usage,
      cost: row.cost,
      billingStatus: row.billing_status,
      createdAt: row.created_at,
      processedAt: row.processed_at
    }));
  }

  async createBillingRecord(connectionId: string, userId: string, provider: string, model: string): Promise<StreamBillingRecord> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Récupération des métriques de connexion
    const metrics = await this.getConnectionMetrics(connectionId);
    const connection = await this.getConnection(connectionId);

    if (!metrics || !connection) {
      throw new Error('Cannot create billing record: missing metrics or connection');
    }

    const record: StreamBillingRecord = {
      id: randomUUID(),
      connectionId,
      userId,
      provider,
      model,
      period,
      usage: {
        totalDuration: (Date.now() - new Date(connection.metadata.connectedAt).getTime()) / 1000,
        totalChunks: connection.metadata.chunksReceived || 0,
        totalBytes: connection.metadata.bytesReceived || 0,
        totalTokens: 0, // Sera mis à jour depuis les chunks
        peakBandwidth: this.calculatePeakBandwidth(metrics),
        averageLatency: connection.metadata.averageLatency || 0
      },
      cost: {
        streamingCost: 0,
        tokenCost: 0,
        infrastructureCost: 0,
        totalCost: 0
      },
      billingStatus: 'pending',
      createdAt: new Date()
    };

    // Sauvegarde
    await this.saveBillingRecord(record);

    return record;
  }

  private async saveBillingRecord(record: StreamBillingRecord): Promise<void> {
    await this.db.query(`
      INSERT INTO stream_billing_records (
        id, connection_id, user_id, provider, model, period,
        usage, cost, billing_status, created_at, processed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        usage = EXCLUDED.usage,
        cost = EXCLUDED.cost,
        billing_status = EXCLUDED.billing_status,
        processed_at = EXCLUDED.processed_at
    `, [
      record.id,
      record.connectionId,
      record.userId,
      record.provider,
      record.model,
      record.period,
      JSON.stringify(record.usage),
      JSON.stringify(record.cost),
      record.billingStatus,
      record.createdAt,
      record.processedAt
    ]);
  }

  private async updateUsageReport(record: StreamBillingRecord): Promise<void> {
    const existingReport = await this.db.query(
      'SELECT * FROM stream_usage_reports WHERE user_id = $1 AND period = $2',
      [record.userId, record.period]
    );

    if (existingReport.rows.length === 0) {
      // Création d'un nouveau rapport
      await this.db.query(`
        INSERT INTO stream_usage_reports (
          id, user_id, period, total_usage, by_provider, 
          by_purpose, performance, trends, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `, [
        randomUUID(),
        record.userId,
        record.period,
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({})
      ]);
    }

    // Mise à jour du rapport existant
    await this.db.query(`
      UPDATE stream_usage_reports 
      SET updated_at = NOW()
      WHERE user_id = $1 AND period = $2
    `, [record.userId, record.period]);
  }

  private async getConnection(connectionId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM stream_connections WHERE id = $1',
      [connectionId]
    );

    return result.rows[0] || null;
  }

  private async getConnectionMetrics(connectionId: string): Promise<StreamMetrics | null> {
    const result = await this.db.query(
      'SELECT * FROM stream_metrics WHERE connection_id = $1 ORDER BY period_end DESC LIMIT 1',
      [connectionId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      connectionId: row.connection_id,
      period: {
        start: row.period_start,
        end: row.period_end
      },
      performance: row.performance,
      quality: row.quality,
      network: row.network
    };
  }

  private calculateTotalUsage(records: StreamBillingRecord[]): any {
    return records.reduce((total, record) => ({
      connections: total.connections + 1,
      duration: total.duration + record.usage.totalDuration,
      chunks: total.chunks + record.usage.totalChunks,
      bytes: total.bytes + record.usage.totalBytes,
      tokens: total.tokens + (typeof record.usage.totalTokens === 'object' ? 
        record.usage.totalTokens.input + record.usage.totalTokens.output : 
        record.usage.totalTokens),
      cost: total.cost + record.cost.totalCost
    }), {
      connections: 0,
      duration: 0,
      chunks: 0,
      bytes: 0,
      tokens: 0,
      cost: 0
    });
  }

  private aggregateByProvider(records: StreamBillingRecord[]): any {
    const grouped = records.reduce((acc: Record<string, { connections: number; duration: number; chunks: number; bytes: number; tokens: number; cost: number; models: Record<string, { connections: number; duration: number; chunks: number; bytes: number; tokens: number; cost: number }> }>, record) => {
      const key = record.provider;
      if (!acc[key]) {
        acc[key] = {
          connections: 0,
          duration: 0,
          chunks: 0,
          bytes: 0,
          tokens: 0,
          cost: 0,
          models: {}
        };
      }

      acc[key].connections++;
      acc[key].duration += record.usage.totalDuration;
      acc[key].chunks += record.usage.totalChunks;
      acc[key].bytes += record.usage.totalBytes;
      acc[key].tokens += typeof record.usage.totalTokens === 'object' ? 
        record.usage.totalTokens.input + record.usage.totalTokens.output : 
        record.usage.totalTokens;
      acc[key].cost += record.cost.totalCost;

      // Agrégation par modèle
      if (!acc[key].models[record.model]) {
        acc[key].models[record.model] = {
          connections: 0,
          duration: 0,
          chunks: 0,
          bytes: 0,
          tokens: 0,
          cost: 0
        };
      }

      acc[key].models[record.model].connections++;
      acc[key].models[record.model].duration += record.usage.totalDuration;
      acc[key].models[record.model].chunks += record.usage.totalChunks;
      acc[key].models[record.model].bytes += record.usage.totalBytes;
      acc[key].models[record.model].tokens += typeof record.usage.totalTokens === 'object' ? 
        record.usage.totalTokens.input + record.usage.totalTokens.output : 
        record.usage.totalTokens;
      acc[key].models[record.model].cost += record.cost.totalCost;

      return acc;
    }, {});

    return grouped;
  }

  private aggregateByPurpose(records: StreamBillingRecord[]): any {
    // Pour l'instant, retourne une agrégation simple
    // Dans une implémentation réelle, il faudrait récupérer le purpose depuis les connexions
    return {
      chat: {
        connections: records.length,
        duration: records.reduce((sum, r) => sum + r.usage.totalDuration, 0),
        chunks: records.reduce((sum, r) => sum + r.usage.totalChunks, 0),
        bytes: records.reduce((sum, r) => sum + r.usage.totalBytes, 0),
        tokens: records.reduce((sum, r) => sum + (typeof r.usage.totalTokens === 'object' ? 
          r.usage.totalTokens.input + r.usage.totalTokens.output : 
          r.usage.totalTokens), 0),
        cost: records.reduce((sum, r) => sum + r.cost.totalCost, 0)
      }
    };
  }

  private calculatePerformanceMetrics(records: StreamBillingRecord[]): any {
    if (records.length === 0) {
      return {
        averageLatency: 0,
        peakBandwidth: 0,
        uptime: 0,
        errorRate: 0
      };
    }

    const totalDuration = records.reduce((sum, r) => sum + r.usage.totalDuration, 0);
    const totalLatency = records.reduce((sum, r) => sum + r.usage.averageLatency, 0);
    const totalBandwidth = records.reduce((sum, r) => sum + r.usage.peakBandwidth, 0);
    const successfulRecords = records.filter(r => r.billingStatus === 'processed').length;

    return {
      averageLatency: totalLatency / records.length,
      peakBandwidth: totalBandwidth / records.length,
      uptime: successfulRecords / records.length,
      errorRate: (records.length - successfulRecords) / records.length
    };
  }

  private async calculateTrends(userId: string, period: string): Promise<any> {
    // Récupération des données des 30 derniers jours
    const startDate = new Date(period + '-01');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const dailyUsage: any[] = [];
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayPeriod = currentDate.toISOString().slice(0, 10);
      const dayRecords = await this.getBillingRecords(userId, dayPeriod.slice(0, 7));
      
      const dayStats = dayRecords
        .filter(r => new Date(r.createdAt).toDateString() === currentDate.toDateString())
        .reduce((stats: any, record) => ({
          connections: stats.connections + 1,
          duration: stats.duration + record.usage.totalDuration,
          chunks: stats.chunks + record.usage.totalChunks,
          bytes: stats.bytes + record.usage.totalBytes,
          tokens: stats.tokens + record.usage.totalTokens,
          cost: stats.cost + record.cost.totalCost
        }), {
          connections: 0,
          duration: 0,
          chunks: 0,
          bytes: 0,
          tokens: 0,
          cost: 0
        });

      dailyUsage.push({
        date: dayPeriod,
        ...dayStats
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calcul du taux de croissance
    const totalCost = dailyUsage.reduce((sum, day) => sum + day.cost, 0);
    const growthRate = this.calculateGrowthRate(dailyUsage);

    return {
      dailyUsage,
      growthRate,
      costProjection: totalCost * (1 + growthRate) // Projection simple
    };
  }

  private calculateGrowthRate(dailyUsage: any[]): number {
    if (dailyUsage.length < 2) return 0;

    const firstWeek = dailyUsage.slice(0, 7).reduce((sum, day) => sum + day.cost, 0);
    const lastWeek = dailyUsage.slice(-7).reduce((sum, day) => sum + day.cost, 0);

    if (firstWeek === 0) return 0;

    return (lastWeek - firstWeek) / firstWeek;
  }

  private calculatePeakBandwidth(metrics: StreamMetrics): number {
    return metrics.performance.bytesPerSecond || 0;
  }
}
