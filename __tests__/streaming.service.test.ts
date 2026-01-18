import { StreamingService } from '../src/services/streaming.service';
import { LLMService } from '../src/services/llm.service';
import { GzipCompressionService } from '../src/services/compression.service';
import { AESEncryptionService } from '../src/services/encryption.service';
import { StreamRequest, StreamConfig } from '../src/types/streaming.types';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

// Mocks
const mockDb = {
  query: jest.fn(),
} as unknown as Pool;

const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
} as unknown as Redis;

const mockLLMService = {
  generateStream: jest.fn(),
} as unknown as LLMService;

const mockCompressionService = new GzipCompressionService();
const mockEncryptionService = new AESEncryptionService();

describe('StreamingService', () => {
  let service: StreamingService;
  let mockConfig: StreamConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      maxConnections: 100,
      connectionTimeout: 300000,
      heartbeatInterval: 30000,
      bufferSize: 8192,
      flushInterval: 100,
      compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 6
      },
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm',
        keyRotation: 86400000
      },
      monitoring: {
        metricsInterval: 60000,
        logLevel: 'info',
        alertThresholds: {
          errorRate: 0.05,
          latency: 5000,
          connectionDrops: 100
        }
      },
      fallback: {
        enabled: true,
        providers: ['anthropic', 'google'],
        retryAttempts: 3,
        retryDelay: 1000
      }
    };

    service = new StreamingService(
      mockDb,
      mockRedis,
      mockLLMService,
      mockCompressionService,
      mockEncryptionService,
      mockConfig
    );
  });

  describe('createConnection', () => {
    it('should create a streaming connection successfully', async () => {
      const request: StreamRequest = {
        id: 'test-request-1',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      // Mock database responses
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // saveConnection
        .mockResolvedValueOnce({ rows: [] }); // saveBuffer

      const connection = await service.createConnection(request);

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.clientId).toBe(request.clientId);
      expect(connection.provider).toBe(request.provider);
      expect(connection.model).toBe(request.model);
      expect(connection.status).toBe('connecting');
      expect(connection.options.bufferSize).toBe(mockConfig.bufferSize);
      expect(connection.options.compression).toBe(mockConfig.compression.enabled);
    });

    it('should throw error when max connections reached', async () => {
      // Simuler max connections atteintes
      const privateService = service as any;
      privateService.connectionCount = mockConfig.maxConnections;

      const request: StreamRequest = {
        id: 'test-request-2',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      await expect(service.createConnection(request)).rejects.toThrow('Maximum connections reached');
    });
  });

  describe('startStream', () => {
    it('should start streaming and handle chunks correctly', async () => {
      const connectionId = 'test-connection-id';
      const request: StreamRequest = {
        id: 'test-request-3',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      // Mock connection
      const mockConnection = {
        id: connectionId,
        status: 'connecting',
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          chunksReceived: 0,
          bytesReceived: 0,
          averageLatency: 0
        },
        updatedAt: new Date()
      };

      // Mock stream chunks
      const mockChunks = [
        { content: 'Hello', delta: 'Hello' },
        { content: 'Hello world', delta: ' world' },
        { content: 'Hello world!', delta: '!', finishReason: 'stop' }
      ];

      // Setup mocks
      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // updateConnection
        .mockResolvedValueOnce({ rows: [] }) // saveChunks
        .mockResolvedValueOnce({ rows: [] }); // updateConnection

      // Mock LLM stream
      const mockStream = (async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      })();

      (mockLLMService.generateStream as jest.Mock).mockResolvedValue(mockStream);

      // Listen for events
      const events: any[] = [];
      service.on('stream_event', (event) => events.push(event));

      await service.startStream(connectionId, request);

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event.type).toBe('start');
      expect(events.some(e => e.event.type === 'chunk')).toBe(true);
      expect(events.some(e => e.event.type === 'complete')).toBe(true);
    });

    it('should handle stream errors correctly', async () => {
      const connectionId = 'test-connection-error';
      const request: StreamRequest = {
        id: 'test-request-error',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      const mockConnection = {
        id: connectionId,
        status: 'connecting',
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          chunksReceived: 0,
          bytesReceived: 0,
          averageLatency: 0
        },
        updatedAt: new Date()
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // updateConnection
        .mockResolvedValueOnce({ rows: [] }); // updateConnection (error)

      // Mock LLM service to throw error
      (mockLLMService.generateStream as jest.Mock).mockRejectedValue(new Error('Stream failed'));

      const events: any[] = [];
      service.on('stream_event', (event) => events.push(event));

      await service.startStream(connectionId, request);

      // Verify error event was emitted
      expect(events.some(e => e.event.type === 'error')).toBe(true);
    });
  });

  describe('closeConnection', () => {
    it('should close connection and cleanup resources', async () => {
      const connectionId = 'test-connection-close';
      const mockConnection = {
        id: connectionId,
        status: 'streaming',
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          chunksReceived: 10,
          bytesReceived: 1024,
          averageLatency: 100
        },
        updatedAt: new Date()
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);
      privateService.buffers.set(connectionId, { chunks: [] });
      privateService.connectionCount = 1;

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // updateConnection
        .mockResolvedValueOnce({ rows: [] }); // flushBuffer

      await service.closeConnection(connectionId);

      expect(privateService.connections.has(connectionId)).toBe(false);
      expect(privateService.buffers.has(connectionId)).toBe(false);
      expect(privateService.connectionCount).toBe(0);
    });
  });

  describe('getConnection', () => {
    it('should return connection from memory', async () => {
      const connectionId = 'test-connection-memory';
      const mockConnection = {
        id: connectionId,
        status: 'connected',
        metadata: { connectedAt: new Date() }
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);

      const result = await service.getConnection(connectionId);

      expect(result).toBe(mockConnection);
    });

    it('should return connection from database if not in memory', async () => {
      const connectionId = 'test-connection-db';
      const mockDbConnection = {
        id: connectionId,
        status: 'connected',
        metadata: { connectedAt: new Date() }
      };

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockDbConnection]
      });

      const result = await service.getConnection(connectionId);

      expect(result).toBe(mockDbConnection);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM stream_connections WHERE id = $1',
        [connectionId]
      );
    });

    it('should return null if connection not found', async () => {
      const connectionId = 'non-existent-connection';

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getConnection(connectionId);

      expect(result).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should calculate metrics for connection', async () => {
      const connectionId = 'test-connection-metrics';
      const period = { start: new Date('2025-01-01'), end: new Date('2025-01-31') };
      
      const mockConnection = {
        id: connectionId,
        status: 'completed',
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          chunksReceived: 100,
          bytesReceived: 10240,
          averageLatency: 150
        }
      };

      const mockMetricsData = {
        total_chunks: '100',
        total_bytes: '10240',
        avg_latency: '150',
        p95_latency: '200',
        p99_latency: '300'
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);

      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [mockMetricsData]
      });

      // Mock private methods
      jest.spyOn(privateService, 'calculateChunksPerSecond').mockReturnValue(2);
      jest.spyOn(privateService, 'calculateBytesPerSecond').mockReturnValue(204.8);
      jest.spyOn(privateService, 'calculateErrorRate').mockResolvedValue(0.01);
      jest.spyOn(privateService, 'calculateReconnectionRate').mockResolvedValue(0.02);
      jest.spyOn(privateService, 'calculateCompletionRate').mockResolvedValue(0.97);
      jest.spyOn(privateService, 'calculateAverageDuration').mockResolvedValue(300);
      jest.spyOn(privateService, 'calculateConnectionDrops').mockResolvedValue(1);

      const metrics = await service.getMetrics(connectionId, period);

      expect(metrics.connectionId).toBe(connectionId);
      expect(metrics.period).toBe(period);
      expect(metrics.performance.totalChunks).toBe(100);
      expect(metrics.performance.totalBytes).toBe(10240);
      expect(metrics.performance.latency.average).toBe(150);
      expect(metrics.quality.errorRate).toBe(0.01);
      expect(metrics.quality.completionRate).toBe(0.97);
    });

    it('should throw error if connection not found', async () => {
      const connectionId = 'non-existent-connection';
      const period = { start: new Date(), end: new Date() };

      await expect(service.getMetrics(connectionId, period)).rejects.toThrow(
        `Connection ${connectionId} not found`
      );
    });
  });

  describe('event emission', () => {
    it('should emit connection_created event', async () => {
      const request: StreamRequest = {
        id: 'test-request-events',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      let eventEmitted = false;
      service.on('connection_created', () => {
        eventEmitted = true;
      });

      await service.createConnection(request);

      expect(eventEmitted).toBe(true);
    });

    it('should emit stream_completed event', async () => {
      const connectionId = 'test-connection-completed';
      const mockConnection = {
        id: connectionId,
        status: 'streaming',
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          chunksReceived: 5,
          bytesReceived: 512,
          averageLatency: 100
        },
        updatedAt: new Date()
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, mockConnection);
      privateService.buffers.set(connectionId, { chunks: [] });

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      let eventEmitted = false;
      let eventData: any = null;
      service.on('stream_completed', (data) => {
        eventEmitted = true;
        eventData = data;
      });

      await privateService.completeStream(connectionId, 'stop');

      expect(eventEmitted).toBe(true);
      expect(eventData.connectionId).toBe(connectionId);
      expect(eventData.finishReason).toBe('stop');
    });
  });

  describe('buffer management', () => {
    it('should flush buffer when threshold reached', async () => {
      const connectionId = 'test-connection-buffer';
      const mockBuffer = {
        connectionId,
        chunks: [
          { id: '1', size: 4096, data: 'test1' },
          { id: '2', size: 4096, data: 'test2' }
        ],
        maxSize: 8192,
        flushThreshold: 6554,
        lastFlush: new Date(),
        compressionEnabled: true
      };

      const privateService = service as any;
      privateService.buffers.set(connectionId, mockBuffer);

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await privateService.addToBuffer(connectionId, {
        id: '3',
        size: 4096,
        data: 'test3'
      });

      // Buffer should be flushed due to size threshold
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('cleanup and maintenance', () => {
    it('should cleanup expired connections', async () => {
      const connectionId = 'test-connection-expired';
      const oldConnection = {
        id: connectionId,
        status: 'streaming',
        metadata: {
          connectedAt: new Date(Date.now() - 400000), // 400 seconds ago
          lastActivity: new Date(Date.now() - 400000),
          chunksReceived: 0,
          bytesReceived: 0,
          averageLatency: 0
        },
        updatedAt: new Date()
      };

      const privateService = service as any;
      privateService.connections.set(connectionId, oldConnection);
      privateService.buffers.set(connectionId, { chunks: [] });
      privateService.connectionCount = 1;

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await privateService.cleanupExpiredConnections();

      expect(privateService.connections.has(connectionId)).toBe(false);
      expect(privateService.connectionCount).toBe(0);
    });
  });
});
