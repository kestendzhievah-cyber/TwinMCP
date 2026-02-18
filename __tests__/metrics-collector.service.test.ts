// @ts-nocheck
import { MetricsCollector } from '../src/services/metrics-collector.service';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as os from 'os';
import { exec } from 'child_process';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');
jest.mock('os');
jest.mock('child_process');

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    mockRedis = new Redis() as jest.Mocked<Redis>;

    metricsCollector = new MetricsCollector(mockDb, mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', async () => {
      // Mock os module
      (os.cpus as jest.Mock).mockReturnValue([
        { model: 'Intel i7', speed: 2400, times: { user: 1000, idle: 2000 } }
      ]);
      (os.totalmem as jest.Mock).mockReturnValue(8000000000);
      (os.freemem as jest.Mock).mockReturnValue(4000000000);
      (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.2, 1.0]);
      (os.uptime as jest.Mock).mockReturnValue(3600);

      // Mock exec
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('df')) {
            callback(null, 'Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/sda1 1000000 500000 500000 50% /', '');
          } else if (command.includes('ps')) {
            callback(null, 'PID USER      PR  NI  VIRT  RES  SHR S %CPU %MEM     TIME+ COMMAND\n1234 user      20   0  1000  500  250 S  5.0  0.1   0:01.23 node', '');
          }
        }
        return {} as any;
      });

      const metrics = await metricsCollector.getSystemMetrics();

      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
      expect(metrics).toHaveProperty('processes');
      expect(metrics).toHaveProperty('uptime');

      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('cores');
      expect(metrics.cpu).toHaveProperty('loadAverage');

      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('free');

      expect(metrics.disk).toHaveProperty('total');
      expect(metrics.disk).toHaveProperty('used');
      expect(metrics.disk).toHaveProperty('free');
    });

    it('should handle errors during system metrics collection', async () => {
      (os.cpus as jest.Mock).mockImplementation(() => {
        throw new Error('System error');
      });

      await expect(metricsCollector.getSystemMetrics()).rejects.toThrow('System error');
    });
  });

  describe('getApplicationMetrics', () => {
    it('should return application metrics', async () => {
      // Mock database query for application metrics
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [
          { endpoint: '/api/chat', count: 100, avg_latency: 150 },
          { endpoint: '/api/auth', count: 50, avg_latency: 100 }
        ]
      });

      // Add some request metrics
      metricsCollector['trackRequest'](150, 200);
      metricsCollector['trackRequest'](100, 200);
      metricsCollector['trackRequest'](500, 500); // Error

      const metrics = await metricsCollector.getApplicationMetrics();

      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('throughput');

      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.averageLatency).toBeGreaterThan(0);
      expect(metrics.errors.total).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query = jest.fn().mockRejectedValue(new Error('Database error'));

      const metrics = await metricsCollector.getApplicationMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.requests.total).toBe(0); // Should have default values
    });
  });

  describe('getDatabaseMetrics', () => {
    it('should return database metrics', async () => {
      // Mock database queries
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ active_connections: 5, total_connections: 10 }]
        })
        .mockResolvedValueOnce({
          rows: [{ avg_query_time: 50, total_queries: 1000 }]
        })
        .mockResolvedValueOnce({
          rows: [{ database_size: 1000000 }]
        });

      const metrics = await metricsCollector.getDatabaseMetrics();

      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('queries');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('replication');
      expect(metrics).toHaveProperty('size');

      expect(metrics.connections.active).toBe(5);
      expect(metrics.connections.total).toBe(10);
      expect(metrics.queries.averageLatency).toBe(50);
      expect(metrics.queries.total).toBe(1000);
    });

    it('should handle database connection errors', async () => {
      mockDb.query = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const metrics = await metricsCollector.getDatabaseMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.connections.active).toBe(0);
      expect(metrics.connections.total).toBe(0);
    });
  });

  describe('getNetworkMetrics', () => {
    it('should return network metrics', async () => {
      // Mock exec for network stats
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('cat /proc/net/dev')) {
            callback(null, 'Inter-|   Receive |  Transmit\nface |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\nlo: 1000    10    0    0    0     0          0         0 1000    10    0    0    0     0       0          0\neth0: 1000000    100    0    0    0     0          0         0 2000000    200    0    0    0     0       0          0', '');
          }
        }
        return {} as any;
      });

      const metrics = await metricsCollector.getNetworkMetrics();

      expect(metrics).toHaveProperty('interfaces');
      expect(metrics).toHaveProperty('bandwidth');
      expect(metrics).toHaveProperty('packets');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('latency');

      expect(metrics.interfaces).toHaveLength(2); // lo and eth0
      expect(metrics.interfaces[0].name).toBe('lo');
      expect(metrics.interfaces[1].name).toBe('eth0');
    });

    it('should handle network stats errors', async () => {
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Network stats error'), '', '');
        }
        return {} as any;
      });

      const metrics = await metricsCollector.getNetworkMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.interfaces).toHaveLength(0);
    });
  });

  describe('getBusinessMetrics', () => {
    it('should return business metrics', async () => {
      // Mock database queries for business metrics
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ revenue: 1000 }]
        })
        .mockResolvedValueOnce({
          rows: [{ active_users: 50, total_users: 100 }]
        })
        .mockResolvedValueOnce({
          rows: [{ total_conversations: 200 }]
        })
        .mockResolvedValueOnce({
          rows: [{ feature_usage_count: 25 }]
        });

      const metrics = await metricsCollector.getBusinessMetrics();

      expect(metrics).toHaveProperty('revenue');
      expect(metrics).toHaveProperty('users');
      expect(metrics).toHaveProperty('conversations');
      expect(metrics).toHaveProperty('features');

      expect(metrics.revenue.total).toBe(1000);
      expect(metrics.users.active).toBe(50);
      expect(metrics.users.total).toBe(100);
      expect(metrics.conversations.total).toBe(200);
      expect(metrics.features.used).toBe(25);
    });

    it('should handle business metrics errors', async () => {
      mockDb.query = jest.fn().mockRejectedValue(new Error('Business metrics error'));

      const metrics = await metricsCollector.getBusinessMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.revenue.total).toBe(0);
      expect(metrics.users.active).toBe(0);
      expect(metrics.users.total).toBe(0);
    });
  });

  describe('trackRequest', () => {
    it('should track request metrics', () => {
      const initialCount = metricsCollector['requestMetrics'].length;

      metricsCollector['trackRequest'](150, 200);

      expect(metricsCollector['requestMetrics']).toHaveLength(initialCount + 1);
      expect(metricsCollector['requestMetrics'][initialCount].latency).toBe(150);
      expect(metricsCollector['requestMetrics'][initialCount].status).toBe(200);
    });

    it('should limit request metrics history', () => {
      // Fill up the metrics array
      for (let i = 0; i < 1000; i++) {
        metricsCollector['trackRequest'](100, 200);
      }

      expect(metricsCollector['requestMetrics'].length).toBeLessThanOrEqual(1000);
    });
  });

  describe('trackError', () => {
    it('should track error metrics', () => {
      const errorType = 'ValidationError';
      const initialCount = metricsCollector['errorCounts'].get(errorType) || 0;

      metricsCollector['trackError'](errorType);

      expect(metricsCollector['errorCounts'].get(errorType)).toBe(initialCount + 1);
    });

    it('should initialize error count for new error types', () => {
      const errorType = 'NewError';

      expect(metricsCollector['errorCounts'].get(errorType)).toBeUndefined();

      metricsCollector['trackError'](errorType);

      expect(metricsCollector['errorCounts'].get(errorType)).toBe(1);
    });
  });

  describe('calculateAverageLatency', () => {
    it('should calculate average latency correctly', () => {
      metricsCollector['trackRequest'](100, 200);
      metricsCollector['trackRequest'](200, 200);
      metricsCollector['trackRequest'](300, 200);

      const average = metricsCollector['calculateAverageLatency']();

      expect(average).toBe(200);
    });

    it('should return 0 when no requests tracked', () => {
      const average = metricsCollector['calculateAverageLatency']();

      expect(average).toBe(0);
    });
  });

  describe('calculateErrorRate', () => {
    it('should calculate error rate correctly', () => {
      metricsCollector['trackRequest'](100, 200);
      metricsCollector['trackRequest'](100, 200);
      metricsCollector['trackRequest'](100, 500); // Error
      metricsCollector['trackRequest'](100, 500); // Error

      const errorRate = metricsCollector['calculateErrorRate']();

      expect(errorRate).toBe(50); // 2 errors out of 4 requests = 50%
    });

    it('should return 0 when no requests tracked', () => {
      const errorRate = metricsCollector['calculateErrorRate']();

      expect(errorRate).toBe(0);
    });
  });
});
