// @ts-nocheck
// __tests__/analytics.service.test.ts
import { AnalyticsService } from '../src/services/analytics.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  SessionEvent, 
  EventType, 
  EventCategory, 
  PageContext, 
  UserContext,
  AnalyticsFilter,
  BehaviorPattern
} from '../src/types/analytics.types';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-12345')
}));

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      query: jest.fn(),
    } as any;

    // Mock Redis
    mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      hincrby: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      getex: jest.fn(),
      del: jest.fn(),
    } as any;

    service = new AnalyticsService(mockDb, mockRedis);
  });

  describe('trackEvent', () => {
    it('should track a session event successfully', async () => {
      const event: Omit<SessionEvent, 'id'> = {
        sessionId: 'session-123',
        timestamp: new Date(),
        type: { name: 'message_sent', category: 'conversation', schema: { required: [], optional: [], types: {} } },
        category: { id: 'conversation', name: 'Conversation', description: '', metrics: [] },
        action: 'send',
        label: 'test-message',
        value: 1,
        properties: { model: 'gpt-3.5-turbo' },
        page: { url: '/chat', title: 'Chat', path: '/chat', search: '', hash: '' },
        userContext: {
          userId: 'user-123',
          sessionId: 'session-123',
          isNewUser: false,
          isNewSession: false,
          userProperties: {},
          sessionProperties: {}
        }
      };

      await service.trackEvent(event);

      // Verify event is added to buffer
      expect((service as any).eventBuffer).toHaveLength(1);
      expect((service as any).eventBuffer[0]).toMatchObject({
        sessionId: 'session-123',
        action: 'send',
        label: 'test-message',
        value: 1
      });

      // Verify real-time metrics update
      expect(mockRedis.incr).toHaveBeenCalledWith('realtime:message_sent');
      expect(mockRedis.expire).toHaveBeenCalledWith('realtime:message_sent', 3600);
      expect(mockRedis.hincrby).toHaveBeenCalledWith('user_metrics:user-123', 'events', 1);
      expect(mockRedis.expire).toHaveBeenCalledWith('user_metrics:user-123', 86400);
    });

    it('should flush buffer when it reaches capacity', async () => {
      // Mock the flushEventBuffer method
      const flushSpy = jest.spyOn(service as any, 'flushEventBuffer').mockResolvedValue();

      // Set buffer size to 2 for testing
      (service as any).bufferSize = 2;

      const event: Omit<SessionEvent, 'id'> = {
        sessionId: 'session-123',
        timestamp: new Date(),
        type: { name: 'page_view', category: 'navigation', schema: { required: [], optional: [], types: {} } },
        category: { id: 'navigation', name: 'Navigation', description: '', metrics: [] },
        action: 'view',
        properties: {},
        page: { url: '/dashboard', title: 'Dashboard', path: '/dashboard', search: '', hash: '' },
        userContext: {
          userId: 'user-123',
          sessionId: 'session-123',
          isNewUser: false,
          isNewSession: false,
          userProperties: {},
          sessionProperties: {}
        }
      };

      // Add two events to trigger flush
      await service.trackEvent(event);
      await service.trackEvent(event);

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('getUserAnalytics', () => {
    it('should return user analytics for a given period', async () => {
      const userId = 'user-123';
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };

      // Mock database response
      mockDb.query.mockResolvedValue({
        rows: [{
          total_sessions: 10,
          total_duration: 3600000,
          average_session_duration: 360000,
          last_active_at: new Date('2024-01-30'),
          days_active: 5,
          total_conversations: 8,
          completed_conversations: 7,
          total_messages: 50,
          total_tokens: 10000,
          total_cost: 5.50,
          providers_used: ['openai', 'anthropic'],
          models_used: ['gpt-3.5-turbo', 'claude-3'],
          shares_created: 3,
          exports_generated: 2,
          customizations_made: 5
        }]
      });

      const result = await service.getUserAnalytics(userId, period);

      expect(result).toMatchObject({
        userId,
        period,
        activity: {
          totalSessions: 10,
          totalDuration: 3600000,
          averageSessionDuration: 360000,
          daysActive: 5,
          retentionRate: 0.75 // Default value
        },
        usage: {
          messagesSent: 50,
          messagesReceived: 50,
          conversationsCreated: 8,
          tokensUsed: 10000,
          costIncurred: 5.50,
          providersUsed: ['openai', 'anthropic'],
          modelsUsed: ['gpt-3.5-turbo', 'claude-3']
        },
        engagement: {
          sharesCreated: 3,
          exportsGenerated: 2,
          customizationsMade: 5,
          feedbackGiven: 2, // Default value
          supportTickets: 0 // Default value
        }
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH user_sessions AS'),
        [userId, period.start, period.end]
      );
    });

    it('should handle empty database response', async () => {
      const userId = 'user-123';
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };

      mockDb.query.mockResolvedValue({ rows: [{}] });

      const result = await service.getUserAnalytics(userId, period);

      expect(result.usage.messagesSent).toBe(0);
      expect(result.usage.conversationsCreated).toBe(0);
      expect(result.activity.totalSessions).toBe(0);
    });
  });

  describe('getUsageMetrics', () => {
    it('should return usage metrics with filters', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const filters: AnalyticsFilter = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        country: 'US'
      };

      // Mock database responses
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // getTotalUsers
        .mockResolvedValueOnce({ rows: [{ count: '200' }] }) // getTotalSessions
        .mockResolvedValueOnce({
          rows: [{
            total_active_users: 80,
            total_new_users: 20,
            avg_session_duration: 300000,
            avg_bounce_rate: 0.2,
            total_conversations: 150,
            avg_messages: 5,
            avg_tokens: 1000,
            avg_cost: 0.50,
            completion_rate: 0.9
          }]
        });

      const result = await service.getUsageMetrics(period, filters);

      expect(result).toMatchObject({
        period,
        users: {
          total: 100,
          active: 80,
          new: 20,
          returning: 60,
          churned: 15, // Default value
          retained: 85 // Default value
        },
        sessions: {
          total: 200,
          averageDuration: 300000,
          bounceRate: 0.2,
          pagesPerSession: 3.5 // Default value
        },
        conversations: {
          total: 150,
          averageMessages: 5,
          averageTokens: 1000,
          averageCost: 0.50,
          completionRate: 0.9
        }
      });

      // Verify SQL includes filters
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND provider = $'),
        expect.arrayContaining([period.start, period.end, 'openai', 'gpt-3.5-turbo', 'US'])
      );
    });

    it('should work without filters', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({
          rows: [{
            total_active_users: 40,
            total_new_users: 10,
            avg_session_duration: 250000,
            avg_bounce_rate: 0.15,
            total_conversations: 80,
            avg_messages: 4,
            avg_tokens: 800,
            avg_cost: 0.40,
            completion_rate: 0.85
          }]
        });

      const result = await service.getUsageMetrics(period);

      expect(result.users.total).toBe(50);
      expect(result.sessions.total).toBe(100);
      expect(result.conversations.total).toBe(80);
    });
  });

  describe('detectBehaviorPatterns', () => {
    it('should return detected behavior patterns', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };

      const result = await service.detectBehaviorPatterns(period);

      expect(result).toHaveLength(4); // All 4 patterns should be detected
      expect(result[0]).toMatchObject({
        id: 'churn-risk',
        name: 'Risque de churn',
        type: 'churn',
        impact: 'high'
      });
      expect(result[1]).toMatchObject({
        id: 'power-users',
        name: 'Power users',
        type: 'engagement',
        impact: 'medium'
      });
    });

    it('should filter patterns by confidence threshold', async () => {
      // Mock low confidence patterns
      jest.spyOn(service as any, 'detectChurnRisk').mockResolvedValue({
        confidence: 0.5 // Below threshold
      });

      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const result = await service.detectBehaviorPatterns(period);

      // Should not include churn risk pattern due to low confidence
      expect(result).toHaveLength(3);
      expect(result.find(p => p.id === 'churn-risk')).toBeUndefined();
    });
  });

  describe('generateInsights', () => {
    it('should generate user-specific insights', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const userId = 'user-123';

      // Mock user analytics with low retention
      jest.spyOn(service, 'getUserAnalytics').mockResolvedValue({
        userId,
        period,
        activity: { retentionRate: 0.3 } as any,
        usage: { costIncurred: 150 } as any,
        behavior: {} as any,
        engagement: {} as any
      } as any);

      const result = await service.generateInsights(period, userId);

      expect(result).toHaveLength(2); // Retention warning and cost optimization
      expect(result[0]).toMatchObject({
        type: 'retention_warning',
        title: 'Faible taux de rétention',
        severity: 'medium'
      });
      expect(result[1]).toMatchObject({
        type: 'cost_optimization',
        title: 'Opportunité d\'optimisation des coûts',
        severity: 'low'
      });
    });

    it('should generate global insights', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };

      // Mock usage metrics with high error rate
      jest.spyOn(service, 'getUsageMetrics').mockResolvedValue({
        performance: { errorRate: 0.1 } as any
      } as any);

      const result = await service.generateInsights(period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'performance_alert',
        title: 'Taux d\'erreurs élevé',
        severity: 'high'
      });
    });

    it('should return no insights for healthy metrics', async () => {
      const period = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const userId = 'user-123';

      // Mock healthy metrics
      jest.spyOn(service, 'getUserAnalytics').mockResolvedValue({
        userId,
        period,
        activity: { retentionRate: 0.8 } as any,
        usage: { costIncurred: 50 } as any,
        behavior: {} as any,
        engagement: {} as any
      } as any);

      jest.spyOn(service, 'getUsageMetrics').mockResolvedValue({
        performance: { errorRate: 0.02 } as any
      } as any);

      const result = await service.generateInsights(period, userId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return real-time metrics from Redis', async () => {
      // Mock Redis responses
      mockRedis.get
        .mockResolvedValueOnce('150') // active_users
        .mockResolvedValueOnce('200') // active_sessions
        .mockResolvedValueOnce('5.5') // events_per_second
        .mockResolvedValueOnce('1200') // avg_response_time
        .mockResolvedValueOnce('0.02') // error_rate
        .mockResolvedValueOnce('1000'); // throughput

      const result = await service.getRealTimeMetrics();

      expect(result).toMatchObject({
        activeUsers: 150,
        activeSessions: 200,
        eventsPerSecond: 5.5,
        averageResponseTime: 1200,
        errorRate: 0.02,
        throughput: 1000
      });

      expect(mockRedis.get).toHaveBeenCalledWith('realtime:active_users');
      expect(mockRedis.get).toHaveBeenCalledWith('realtime:active_sessions');
      expect(mockRedis.get).toHaveBeenCalledWith('realtime:events_per_second');
    });

    it('should handle missing Redis values', async () => {
      // Mock Redis to return null/undefined
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getRealTimeMetrics();

      expect(result.activeUsers).toBe(0);
      expect(result.activeSessions).toBe(0);
      expect(result.eventsPerSecond).toBe(0);
    });
  });

  describe('exportData', () => {
    it('should create export job', async () => {
      const query = {
        metrics: ['active_users'],
        timeRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        granularity: 'day' as const
      };
      const format = 'csv';

      const result = await service.exportData(query, format);

      expect(result).toMatchObject({
        id: 'test-uuid-12345',
        format: 'csv',
        status: 'pending',
        query
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'export:test-uuid-12345',
        3600,
        expect.stringContaining('"status":"pending"')
      );
    });
  });

  describe('getExportStatus', () => {
    it('should return export status', async () => {
      const exportId = 'test-uuid-12345';
      const exportData = {
        id: exportId,
        status: 'completed',
        url: '/exports/data.csv'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(exportData));

      const result = await service.getExportStatus(exportId);

      expect(result).toMatchObject(exportData);
      expect(mockRedis.get).toHaveBeenCalledWith(`export:${exportId}`);
    });

    it('should return null for non-existent export', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getExportStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('flushEventBuffer', () => {
    it('should flush events to database', async () => {
      const events = [
        {
          id: 'event-1',
          sessionId: 'session-1',
          timestamp: new Date(),
          type: { name: 'page_view' } as EventType,
          category: { id: 'navigation' } as EventCategory,
          action: 'view',
          properties: {},
          page: { url: '/test' } as PageContext,
          userContext: { userId: 'user-1' } as UserContext
        }
      ];

      // Set up buffer with events
      (service as any).eventBuffer = events;

      mockDb.query.mockResolvedValue({ rows: [] });

      await (service as any).flushEventBuffer();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_events'),
        expect.arrayContaining([
          'event-1', 'session-1', expect.any(Date), 'page_view', 'navigation', 'view'
        ])
      );

      // Buffer should be empty after flush
      expect((service as any).eventBuffer).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const events = [
        {
          id: 'event-1',
          sessionId: 'session-1',
          timestamp: new Date(),
          type: { name: 'page_view' } as EventType,
          category: { id: 'navigation' } as EventCategory,
          action: 'view',
          properties: {},
          page: { url: '/test' } as PageContext,
          userContext: { userId: 'user-1' } as UserContext
        }
      ];

      (service as any).eventBuffer = events;

      // Mock database error
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (service as any).flushEventBuffer();

      expect(consoleSpy).toHaveBeenCalledWith('Error flushing event buffer:', expect.any(Error));
      
      // Events should be put back in buffer
      expect((service as any).eventBuffer).toHaveLength(1);

      consoleSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    it('should calculate preferred provider correctly', () => {
      const providers = ['openai', 'anthropic', 'openai'];
      const result = (service as any).getPreferredProvider(providers);
      expect(result).toBe('openai');
    });

    it('should return default provider for empty list', () => {
      const result = (service as any).getPreferredProvider([]);
      expect(result).toBe('openai');
    });

    it('should calculate preferred model correctly', () => {
      const models = ['gpt-3.5-turbo', 'claude-3', 'gpt-4'];
      const result = (service as any).getPreferredModel(models);
      expect(result).toBe('gpt-3.5-turbo');
    });

    it('should return default model for empty list', () => {
      const result = (service as any).getPreferredModel([]);
      expect(result).toBe('gpt-3.5-turbo');
    });
  });
});
