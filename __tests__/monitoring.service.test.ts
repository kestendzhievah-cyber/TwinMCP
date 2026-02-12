import { MonitoringService } from '../src/services/monitoring.service';
import { MetricsCollector } from '../src/services/metrics-collector.service';
import { AlertManager } from '../src/services/alert-manager.service';
import { HealthChecker } from '../src/services/health-checker.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;
  let mockAlertManager: jest.Mocked<AlertManager>;
  let mockHealthChecker: jest.Mocked<HealthChecker>;

  beforeEach(() => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    mockRedis = new Redis() as jest.Mocked<Redis>;
    mockMetricsCollector = {
      getSystemMetrics: jest.fn(),
      getApplicationMetrics: jest.fn(),
      getDatabaseMetrics: jest.fn(),
      getNetworkMetrics: jest.fn(),
      getBusinessMetrics: jest.fn()
    } as any;

    mockAlertManager = {
      createAlertFromRule: jest.fn(),
      evaluateRules: jest.fn(),
      acknowledgeAlert: jest.fn(),
      resolveAlert: jest.fn(),
      getActiveAlerts: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockHealthChecker = {
      checkService: jest.fn()
    } as any;

    const config = {
      collection: { interval: 30, retention: 30, batchSize: 100 },
      alerts: { enabled: true, channels: [], escalation: [] },
      dashboards: { refreshInterval: 300, autoSave: true }
    };

    monitoringService = new MonitoringService(
      mockDb,
      mockRedis,
      mockMetricsCollector,
      mockAlertManager,
      mockHealthChecker,
      config
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectMetrics', () => {
    it('should collect all metrics and save them', async () => {
      // Mock metrics
      const mockSystemMetrics = {
        cpu: { usage: 50, cores: 4 },
        memory: { used: 4000, total: 8000 },
        disk: { used: 100, total: 500 },
        network: { interface: 'eth0', bytesIn: 1000, bytesOut: 2000 }
      };

      const mockApplicationMetrics = {
        requests: { total: 100, averageLatency: 150 },
        errors: { total: 2 },
        uptime: 3600
      };

      const mockDatabaseMetrics = {
        connections: { active: 5, total: 10 },
        queries: { total: 1000, averageLatency: 50 }
      };

      const mockNetworkMetrics = {
        interfaces: [
          { name: 'eth0', bytesIn: 1000, bytesOut: 2000, packetsIn: 100, packetsOut: 150 }
        ]
      };

      const mockBusinessMetrics = {
        revenue: 1000,
        users: { active: 50, total: 100 },
        conversions: { total: 10 }
      };

      mockMetricsCollector.getSystemMetrics.mockResolvedValue(mockSystemMetrics);
      mockMetricsCollector.getApplicationMetrics.mockResolvedValue(mockApplicationMetrics);
      mockMetricsCollector.getDatabaseMetrics.mockResolvedValue(mockDatabaseMetrics);
      mockMetricsCollector.getNetworkMetrics.mockResolvedValue(mockNetworkMetrics);
      mockMetricsCollector.getBusinessMetrics.mockResolvedValue(mockBusinessMetrics);

      // Mock database save
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      // Mock alert evaluation
      mockAlertManager.evaluateRules.mockResolvedValue([]);

      // Mock Redis cache
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const metrics = await monitoringService.collectMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.system).toEqual(mockSystemMetrics);
      expect(metrics.application).toEqual(mockApplicationMetrics);
      expect(metrics.database).toEqual(mockDatabaseMetrics);
      expect(metrics.network).toEqual(mockNetworkMetrics);
      expect(metrics.business).toEqual(mockBusinessMetrics);

      expect(mockMetricsCollector.getSystemMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.getApplicationMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.getDatabaseMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.getNetworkMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.getBusinessMetrics).toHaveBeenCalled();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO performance_metrics'),
        expect.any(Array)
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'monitoring:latest_metrics',
        300,
        expect.any(String)
      );
    });

    it('should handle errors during metrics collection', async () => {
      mockMetricsCollector.getSystemMetrics.mockRejectedValue(new Error('Database error'));

      await expect(monitoringService.collectMetrics()).rejects.toThrow('Database error');
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return current metrics when available', async () => {
      const mockMetrics = {
        timestamp: new Date(),
        system: { cpu: { usage: 50 } },
        application: { requests: { total: 100 } },
        database: { connections: { active: 5 } },
        network: { interfaces: [] },
        business: { revenue: 1000 }
      };

      // Set up metrics history
      (monitoringService as any).metricsHistory = [mockMetrics];

      const result = await monitoringService.getCurrentMetrics();

      expect(result).toEqual(mockMetrics);
    });

    it('should collect new metrics when none available', async () => {
      const mockMetrics = {
        timestamp: new Date(),
        system: { cpu: { usage: 50 } },
        application: { requests: { total: 100 } },
        database: { connections: { active: 5 } },
        network: { interfaces: [] },
        business: { revenue: 1000 }
      };

      mockMetricsCollector.getSystemMetrics.mockResolvedValue(mockMetrics.system);
      mockMetricsCollector.getApplicationMetrics.mockResolvedValue(mockMetrics.application);
      mockMetricsCollector.getDatabaseMetrics.mockResolvedValue(mockMetrics.database);
      mockMetricsCollector.getNetworkMetrics.mockResolvedValue(mockMetrics.network);
      mockMetricsCollector.getBusinessMetrics.mockResolvedValue(mockMetrics.business);

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
      mockAlertManager.evaluateRules.mockResolvedValue([]);
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const result = await monitoringService.getCurrentMetrics();

      expect(result).toBeDefined();
      expect(result.system).toEqual(mockMetrics.system);
    });
  });

  describe('createAlert', () => {
    it('should create a new alert', async () => {
      const alertData = {
        name: 'Test Alert',
        description: 'Test alert description',
        severity: 'warning' as const,
        source: 'test',
        metric: 'cpu.usage',
        threshold: { operator: 'gt', value: 80, duration: 300 },
        currentValue: 85,
        tags: ['test'],
        annotations: []
      };

      const mockMetrics = {
        timestamp: new Date(),
        system: { cpu: { usage: 85 } },
        application: { requests: { total: 100 } },
        database: { connections: { active: 5 } },
        network: { interfaces: [] },
        business: { revenue: 1000 }
      };

      mockMetricsCollector.getSystemMetrics.mockResolvedValue(mockMetrics.system);
      mockMetricsCollector.getApplicationMetrics.mockResolvedValue(mockMetrics.application);
      mockMetricsCollector.getDatabaseMetrics.mockResolvedValue(mockMetrics.database);
      mockMetricsCollector.getNetworkMetrics.mockResolvedValue(mockMetrics.network);
      mockMetricsCollector.getBusinessMetrics.mockResolvedValue(mockMetrics.business);

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
      mockAlertManager.evaluateRules.mockResolvedValue([]);
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const result = await monitoringService.createAlert(alertData);

      expect(result).toBeDefined();
      expect(result.name).toBe(alertData.name);
      expect(result.severity).toBe(alertData.severity);
      expect(result.status).toBe('active');
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts with filters', async () => {
      const mockAlerts = [
        {
          id: '1',
          name: 'Alert 1',
          severity: 'critical',
          status: 'active',
          source: 'test',
          metric: 'cpu.usage',
          threshold: { operator: 'gt', value: 80, duration: 300 },
          currentValue: 85,
          tags: ['test'],
          annotations: [],
          timestamp: new Date()
        }
      ];

      mockAlertManager.getActiveAlerts.mockResolvedValue(mockAlerts);

      const result = await monitoringService.getActiveAlerts({ severity: 'critical' });

      expect(result).toEqual(mockAlerts);
      expect(mockAlertManager.getActiveAlerts).toHaveBeenCalledWith({ severity: 'critical' });
    });
  });

  describe('performHealthChecks', () => {
    it('should perform health checks for all services', async () => {
      const mockHealthChecks = [
        {
          service: 'database',
          status: 'healthy',
          timestamp: new Date(),
          responseTime: 50,
          details: { connections: 5 },
          dependencies: []
        },
        {
          service: 'redis',
          status: 'healthy',
          timestamp: new Date(),
          responseTime: 10,
          details: { memory: '100MB' },
          dependencies: []
        }
      ];

      mockHealthChecker.checkService.mockImplementation((service) => {
        return Promise.resolve(mockHealthChecks.find(hc => hc.service === service) || {
          service,
          status: 'healthy',
          timestamp: new Date(),
          responseTime: 0,
          details: {},
          dependencies: []
        });
      });

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await monitoringService.performHealthChecks();

      expect(result).toHaveLength(7); // All services
      expect(mockHealthChecker.checkService).toHaveBeenCalledTimes(7);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should create alert for unhealthy services', async () => {
      const mockHealthChecks = [
        {
          service: 'database',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 5000,
          details: { error: 'Connection failed' },
          dependencies: []
        }
      ];

      mockHealthChecker.checkService.mockResolvedValue(mockHealthChecks[0]);
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      // Mock alert creation
      const mockAlert = {
        id: '1',
        name: 'Service Unhealthy',
        description: '1 service(s) unhealthy: database',
        severity: 'critical',
        status: 'active',
        source: 'health-check',
        metric: 'service.status',
        threshold: { operator: 'eq', value: 0, duration: 0 },
        currentValue: 1,
        tags: ['health', 'service'],
        annotations: [],
        timestamp: new Date()
      };

      const createAlertSpy = jest.spyOn(monitoringService, 'createAlert').mockResolvedValue(mockAlert as any);

      await monitoringService.performHealthChecks();

      expect(createAlertSpy).toHaveBeenCalledWith({
        name: 'Service Unhealthy',
        description: '1 service(s) unhealthy: database',
        severity: 'critical',
        source: 'health-check',
        metric: 'service.status',
        threshold: { operator: 'eq', value: 0, duration: 0 },
        currentValue: 1,
        tags: ['health', 'service'],
        annotations: []
      });
    });
  });

  describe('getSystemHealth', () => {
    it('should return overall system health status', async () => {
      const mockHealthChecks = [
        { service: 'database', status: 'healthy' },
        { service: 'redis', status: 'healthy' },
        { service: 'api-gateway', status: 'degraded' }
      ];

      mockHealthChecker.checkService.mockImplementation((service) => {
        const healthCheck = mockHealthChecks.find(hc => hc.service === service);
        return Promise.resolve(healthCheck || {
          service,
          status: 'healthy',
          timestamp: new Date(),
          responseTime: 0,
          details: {},
          dependencies: []
        });
      });

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await monitoringService.getSystemHealth();

      expect(result.status).toBe('degraded');
      expect(result.services).toHaveLength(7);
    });

    it('should return unhealthy status when any service is unhealthy', async () => {
      const mockHealthChecks = [
        { service: 'database', status: 'unhealthy' }
      ];

      mockHealthChecker.checkService.mockResolvedValue({
        service: 'database',
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: 5000,
        details: {},
        dependencies: []
      });

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      const result = await monitoringService.getSystemHealth();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('getStatus', () => {
    it('should return current monitoring service status', () => {
      (monitoringService as any).isRunning = true;
      (monitoringService as any).activeAlerts = new Map([['1', {}], ['2', {}]]);

      const result = monitoringService.getStatus();

      expect(result.isRunning).toBe(true);
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.alertsCount).toBe(2);
    });

    it('should return zero uptime when not running', () => {
      (monitoringService as any).isRunning = false;

      const result = monitoringService.getStatus();

      expect(result.isRunning).toBe(false);
      expect(result.uptime).toBe(0);
    });
  });

  describe('start and stop', () => {
    it('should start monitoring service', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
      mockAlertManager.getActiveAlerts.mockResolvedValue([]);
      mockAlertManager.on = jest.fn();

      await monitoringService.start();

      expect((monitoringService as any).isRunning).toBe(true);
    });

    it('should stop monitoring service', async () => {
      (monitoringService as any).isRunning = true;
      (monitoringService as any).intervals = [setInterval(() => {}, 1000)];

      await monitoringService.stop();

      expect((monitoringService as any).isRunning).toBe(false);
      expect((monitoringService as any).intervals).toHaveLength(0);
    });
  });
});
