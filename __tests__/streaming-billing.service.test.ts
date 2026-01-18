import { StreamingBillingService } from '../src/services/streaming-billing.service';
import { StreamBillingRecord, StreamBillingConfig, StreamUsageReport } from '../src/types/streaming.types';
import { Pool } from 'pg';

// Mocks
const mockDb = {
  query: jest.fn(),
} as unknown as Pool;

describe('StreamingBillingService', () => {
  let service: StreamingBillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StreamingBillingService(mockDb);
  });

  describe('calculateStreamingCost', () => {
    it('should calculate streaming cost correctly', async () => {
      const record: StreamBillingRecord = {
        id: 'test-record-1',
        connectionId: 'conn-1',
        userId: 'user-1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        period: '2025-01',
        usage: {
          totalDuration: 3600, // 1 hour
          totalChunks: 100,
          totalBytes: 1048576, // 1MB
          totalTokens: { input: 1000, output: 500 },
          peakBandwidth: 1048576,
          averageLatency: 100
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

      const config: StreamBillingConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        pricing: {
          streaming: {
            perSecond: 0.0001,
            perMegabyte: 0.01,
            peakBandwidthPremium: 0.00001
          },
          tokens: {
            input: 0.001,
            output: 0.002
          },
          infrastructure: {
            baseCost: 0.001,
            perConnectionHour: 0.01
          }
        },
        billingCycle: 'monthly',
        currency: 'USD',
        taxRate: 0.2
      };

      const cost = await service.calculateStreamingCost(record, config);

      // Expected calculations:
      // Streaming: 3600 * 0.0001 = 0.36
      // Bandwidth: 1MB * 0.01 = 0.01
      // Tokens: (1000/1000 * 0.001) + (500/1000 * 0.002) = 0.001 + 0.001 = 0.002
      // Infrastructure: 0.001 + (3600/3600 * 0.01) = 0.011
      // Subtotal: 0.36 + 0.01 + 0.002 + 0.011 = 0.383
      // With tax: 0.383 * 1.2 = 0.4596

      expect(cost).toBeCloseTo(0.4596, 4);
    });

    it('should apply peak bandwidth premium', async () => {
      const record: StreamBillingRecord = {
        id: 'test-record-2',
        connectionId: 'conn-2',
        userId: 'user-2',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        period: '2025-01',
        usage: {
          totalDuration: 1800, // 30 minutes
          totalChunks: 50,
          totalBytes: 2097152, // 2MB
          totalTokens: { input: 500, output: 250 },
          peakBandwidth: 2097152, // 2MB/s (> 1MB/s)
          averageLatency: 150
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

      const config: StreamBillingConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        pricing: {
          streaming: {
            perSecond: 0.0001,
            perMegabyte: 0.01,
            peakBandwidthPremium: 0.00001
          },
          tokens: {
            input: 0.001,
            output: 0.002
          },
          infrastructure: {
            baseCost: 0.001,
            perConnectionHour: 0.01
          }
        },
        billingCycle: 'monthly',
        currency: 'USD',
        taxRate: 0
      };

      const cost = await service.calculateStreamingCost(record, config);

      // Expected calculations:
      // Streaming: 1800 * 0.0001 = 0.18
      // Bandwidth: 2MB * 0.01 = 0.02
      // Peak bandwidth premium: (2MB - 1MB) * 0.00001 = 1024KB * 0.00001 = 0.01024
      // Tokens: (500/1000 * 0.001) + (250/1000 * 0.002) = 0.0005 + 0.0005 = 0.001
      // Infrastructure: 0.001 + (1800/3600 * 0.01) = 0.001 + 0.005 = 0.006
      // Total: 0.18 + 0.02 + 0.01024 + 0.001 + 0.006 = 0.21724

      expect(cost).toBeCloseTo(0.21724, 4);
    });

    it('should handle simple token count (number)', async () => {
      const record: StreamBillingRecord = {
        id: 'test-record-3',
        connectionId: 'conn-3',
        userId: 'user-3',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        period: '2025-01',
        usage: {
          totalDuration: 600, // 10 minutes
          totalChunks: 20,
          totalBytes: 524288, // 0.5MB
          totalTokens: 1500, // Simple number
          peakBandwidth: 524288,
          averageLatency: 80
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

      const config: StreamBillingConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        pricing: {
          streaming: {
            perSecond: 0.0001,
            perMegabyte: 0.01,
            peakBandwidthPremium: 0.00001
          },
          tokens: {
            input: 0.001,
            output: 0.002
          },
          infrastructure: {
            baseCost: 0.001,
            perConnectionHour: 0.01
          }
        },
        billingCycle: 'monthly',
        currency: 'USD',
        taxRate: 0
      };

      const cost = await service.calculateStreamingCost(record, config);

      // With simple token count, token cost should be 0 (no input/output breakdown)
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('applyDiscounts', () => {
    it('should apply volume discounts correctly', () => {
      const cost = 100;
      const usage = { input: 1000000, output: 500000 }; // 1.5M total tokens
      const discounts = [
        { volumeThreshold: 1000000, discountPercentage: 0.1 }, // 10% for 1M tokens
        { volumeThreshold: 2000000, discountPercentage: 0.2 }  // 20% for 2M tokens
      ];

      const discountedCost = (service as any).applyDiscounts(cost, usage, discounts);

      // Should apply 10% discount (1.5M >= 1M but < 2M)
      expect(discountedCost).toBe(90); // 100 * (1 - 0.1)
    });

    it('should apply highest applicable discount', () => {
      const cost = 100;
      const usage = { input: 2000000, output: 1000000 }; // 3M total tokens
      const discounts = [
        { volumeThreshold: 1000000, discountPercentage: 0.1 }, // 10% for 1M tokens
        { volumeThreshold: 2000000, discountPercentage: 0.2 }  // 20% for 2M tokens
      ];

      const discountedCost = (service as any).applyDiscounts(cost, usage, discounts);

      // Should apply 20% discount (3M >= 2M)
      expect(discountedCost).toBe(80); // 100 * (1 - 0.2)
    });

    it('should handle simple token usage (number)', () => {
      const cost = 100;
      const usage = 1500000; // Simple number
      const discounts = [
        { volumeThreshold: 1000000, discountPercentage: 0.1 },
        { volumeThreshold: 2000000, discountPercentage: 0.2 }
      ];

      const discountedCost = (service as any).applyDiscounts(cost, usage, discounts);

      // Should apply 10% discount (1.5M >= 1M but < 2M)
      expect(discountedCost).toBe(90);
    });

    it('should not apply discount if threshold not met', () => {
      const cost = 100;
      const usage = { input: 500000, output: 250000 }; // 750K total tokens
      const discounts = [
        { volumeThreshold: 1000000, discountPercentage: 0.1 },
        { volumeThreshold: 2000000, discountPercentage: 0.2 }
      ];

      const discountedCost = (service as any).applyDiscounts(cost, usage, discounts);

      // No discount applied
      expect(discountedCost).toBe(100);
    });
  });

  describe('generateBillingReport', () => {
    it('should generate comprehensive billing report', async () => {
      const userId = 'test-user';
      const period = '2025-01';

      const mockRecords: StreamBillingRecord[] = [
        {
          id: 'record-1',
          connectionId: 'conn-1',
          userId,
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          period,
          usage: {
            totalDuration: 3600,
            totalChunks: 100,
            totalBytes: 1048576,
            totalTokens: { input: 1000, output: 500 },
            peakBandwidth: 1048576,
            averageLatency: 100
          },
          cost: {
            streamingCost: 0.36,
            tokenCost: 0.002,
            infrastructureCost: 0.011,
            totalCost: 0.4596
          },
          billingStatus: 'processed',
          createdAt: new Date()
        },
        {
          id: 'record-2',
          connectionId: 'conn-2',
          userId,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          period,
          usage: {
            totalDuration: 1800,
            totalChunks: 50,
            totalBytes: 524288,
            totalTokens: { input: 500, output: 250 },
            peakBandwidth: 524288,
            averageLatency: 150
          },
          cost: {
            streamingCost: 0.27,
            tokenCost: 0.006,
            infrastructureCost: 0.006,
            totalCost: 0.324
          },
          billingStatus: 'processed',
          createdAt: new Date()
        }
      ];

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockRecords }) // getBillingRecords
        .mockResolvedValue({ rows: [] }); // Other queries

      const report = await service.generateBillingReport(userId, period);

      expect(report.userId).toBe(userId);
      expect(report.period).toBe(period);
      expect(report.totalUsage.connections).toBe(2);
      expect(report.totalUsage.duration).toBe(5400); // 3600 + 1800
      expect(report.totalUsage.cost).toBeCloseTo(0.7836, 4); // 0.4596 + 0.324
      expect(report.byProvider).toHaveProperty('openai');
      expect(report.byProvider).toHaveProperty('anthropic');
      expect(report.performance).toBeDefined();
      expect(report.trends).toBeDefined();
    });
  });

  describe('getBillingConfig', () => {
    it('should retrieve billing config from database', async () => {
      const provider = 'openai';
      const model = 'gpt-3.5-turbo';

      const mockConfig = {
        provider,
        model,
        pricing: {
          streaming: { perSecond: 0.0001, perMegabyte: 0.01, peakBandwidthPremium: 0.00001 },
          tokens: { input: 0.001, output: 0.002 },
          infrastructure: { baseCost: 0.001, perConnectionHour: 0.01 }
        },
        billing_cycle: 'monthly',
        currency: 'USD',
        tax_rate: '0.2000',
        discounts: [{ volumeThreshold: 1000000, discountPercentage: 0.1 }],
        sla: { uptimeGuarantee: 0.99, latencyGuarantee: 500 }
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [mockConfig] });

      const config = await service.getBillingConfig(provider, model);

      expect(config).not.toBeNull();
      expect(config?.provider).toBe(provider);
      expect(config?.model).toBe(model);
      expect(config?.billingCycle).toBe('monthly');
      expect(config?.taxRate).toBe(0.2);
    });

    it('should return null if config not found', async () => {
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const config = await service.getBillingConfig('nonexistent', 'model');

      expect(config).toBeNull();
    });
  });

  describe('createBillingRecord', () => {
    it('should create billing record from connection', async () => {
      const connectionId = 'test-connection';
      const userId = 'test-user';
      const provider = 'openai';
      const model = 'gpt-3.5-turbo';

      const mockConnection = {
        id: connectionId,
        metadata: {
          connectedAt: new Date(Date.now() - 3600000), // 1 hour ago
          chunksReceived: 50,
          bytesReceived: 524288,
          averageLatency: 120
        }
      };

      const mockMetrics = {
        performance: {
          bytesPerSecond: 1048576
        }
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockConnection] }) // getConnection
        .mockResolvedValueOnce({ rows: [mockMetrics] }) // getConnectionMetrics
        .mockResolvedValueOnce({ rows: [] }); // saveBillingRecord

      const record = await service.createBillingRecord(connectionId, userId, provider, model);

      expect(record.connectionId).toBe(connectionId);
      expect(record.userId).toBe(userId);
      expect(record.provider).toBe(provider);
      expect(record.model).toBe(model);
      expect(record.usage.totalDuration).toBeCloseTo(3600, 0); // 1 hour
      expect(record.usage.totalChunks).toBe(50);
      expect(record.usage.totalBytes).toBe(524288);
      expect(record.billingStatus).toBe('pending');
    });

    it('should throw error if connection or metrics missing', async () => {
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getConnection not found
        .mockResolvedValueOnce({ rows: [] }); // getConnectionMetrics not found

      await expect(
        service.createBillingRecord('nonexistent', 'user', 'openai', 'gpt-3.5-turbo')
      ).rejects.toThrow('Cannot create billing record: missing metrics or connection');
    });
  });

  describe('processBilling', () => {
    it('should process billing records successfully', async () => {
      const record: StreamBillingRecord = {
        id: 'test-record-process',
        connectionId: 'conn-1',
        userId: 'user-1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        period: '2025-01',
        usage: {
          totalDuration: 1800,
          totalChunks: 50,
          totalBytes: 524288,
          totalTokens: { input: 500, output: 250 },
          peakBandwidth: 524288,
          averageLatency: 100
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

      const mockConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        pricing: {
          streaming: { perSecond: 0.0001, perMegabyte: 0.01, peakBandwidthPremium: 0.00001 },
          tokens: { input: 0.001, output: 0.002 },
          infrastructure: { baseCost: 0.001, perConnectionHour: 0.01 }
        },
        billingCycle: 'monthly',
        currency: 'USD',
        taxRate: 0.1,
        discounts: [],
        sla: null
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockConfig] }) // getBillingConfig
        .mockResolvedValue({ rows: [] }); // saveBillingRecord, updateUsageReport

      await service.processBilling([record]);

      expect(record.billingStatus).toBe('processed');
      expect(record.cost.totalCost).toBeGreaterThan(0);
      expect(record.processedAt).toBeDefined();
    });

    it('should handle billing errors gracefully', async () => {
      const record: StreamBillingRecord = {
        id: 'test-record-error',
        connectionId: 'conn-1',
        userId: 'user-1',
        provider: 'nonexistent',
        model: 'nonexistent-model',
        period: '2025-01',
        usage: {
          totalDuration: 1800,
          totalChunks: 50,
          totalBytes: 524288,
          totalTokens: { input: 500, output: 250 },
          peakBandwidth: 524288,
          averageLatency: 100
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

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getBillingConfig returns null
        .mockResolvedValue({ rows: [] }); // saveBillingRecord

      await service.processBilling([record]);

      expect(record.billingStatus).toBe('failed');
    });
  });
});
