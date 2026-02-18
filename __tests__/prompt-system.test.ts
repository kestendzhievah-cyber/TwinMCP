// @ts-nocheck
import { PromptManagementService } from '../src/services/prompt-management.service';
import { PromptRenderer } from '../src/services/prompt-renderer.service';
import { PromptOptimizer } from '../src/services/prompt-optimizer.service';
import { PromptTester } from '../src/services/prompt-tester.service';
import { PromptTemplate } from '../src/types/prompt-system.types';

// Mocks pour les tests
const mockDb = {
  query: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockRenderer = new PromptRenderer();
const mockOptimizer = new PromptOptimizer();
const mockTester = new PromptTester();

describe('PromptManagementService', () => {
  let service: PromptManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptManagementService(
      mockDb as any,
      mockRedis as any,
      mockRenderer,
      mockOptimizer,
      mockTester
    );
  });

  describe('createTemplate', () => {
    it('should create a valid prompt template', async () => {
      const template = {
        name: 'Test Template',
        description: 'A test template',
        category: 'chat',
        version: '1.0.0',
        status: 'draft' as const,
        template: 'Hello {{name}}, how are you?',
        variables: [
          {
            name: 'name',
            type: 'string' as const,
            description: 'User name',
            required: true,
            examples: ['John', 'Jane']
          }
        ],
        examples: [],
        metadata: {
          author: 'test',
          tags: ['test'],
          optimizedFor: ['gpt-4'],
          language: 'en',
          complexity: 'basic' as const,
          estimatedTokens: 10,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: ['name'],
          forbiddenPatterns: [],
          allowedModels: ['gpt-4', 'gpt-3.5-turbo']
        },
        optimization: {
          autoOptimize: true,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        }
      };

      mockDb.query.mockResolvedValue({ rows: [] });

      const templateId = await service.createTemplate(template);

      expect(templateId).toBeDefined();
      expect(typeof templateId).toBe('string');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should throw error for invalid template', async () => {
      const invalidTemplate = {
        name: '',
        description: 'Invalid template',
        category: 'chat',
        version: '1.0.0',
        status: 'draft' as const,
        template: '',
        variables: [],
        examples: [],
        metadata: {
          author: 'test',
          tags: [],
          optimizedFor: [],
          language: 'en',
          complexity: 'basic' as const,
          estimatedTokens: 0,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: [],
          forbiddenPatterns: [],
          allowedModels: []
        },
        optimization: {
          autoOptimize: false,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        }
      };

      await expect(service.createTemplate(invalidTemplate)).rejects.toThrow('Template name and content are required');
    });
  });

  describe('renderPrompt', () => {
    it('should render prompt with variables', async () => {
      const templateId = 'test-template';
      const template: PromptTemplate = {
        id: templateId,
        name: 'Test',
        description: 'Test template',
        category: 'chat',
        version: '1.0.0',
        status: 'active',
        template: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'string',
            description: 'Name',
            required: true,
            examples: []
          }
        ],
        examples: [],
        metadata: {
          author: 'test',
          tags: [],
          optimizedFor: [],
          language: 'en',
          complexity: 'basic',
          estimatedTokens: 10,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: ['name'],
          forbiddenPatterns: [],
          allowedModels: []
        },
        optimization: {
          autoOptimize: false,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [template] });

      const result = await service.renderPrompt(templateId, { name: 'World' });

      expect(result.rendered).toBe('Hello World!');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.metadata.variablesReplaced).toContain('name');
    });

    it('should throw error for missing template', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(service.renderPrompt('non-existent', {})).rejects.toThrow('Template non-existent not found');
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics for template', async () => {
      const templateId = 'test-template';
      const period = { start: new Date('2023-01-01'), end: new Date('2023-12-31') };
      
      const mockStats = {
        total_executions: '100',
        unique_users: '50',
        avg_latency: '150',
        success_rate: '0.95',
        avg_tokens: '200',
        avg_cost: '0.05',
        avg_relevance: '4.5',
        avg_coherence: '4.2',
        avg_completeness: '4.3',
        avg_rating: '4.4',
        usage_trend: 0,
        quality_trend: 0,
        cost_trend: 0
      };

      mockDb.query.mockResolvedValue({ rows: [mockStats] });

      const analytics = await service.getAnalytics(templateId, period);

      expect(analytics.templateId).toBe(templateId);
      expect(analytics.usage.totalExecutions).toBe(100);
      expect(analytics.usage.successRate).toBe(0.95);
      expect(analytics.performance.qualityScore).toBeCloseTo(4.33, 2);
    });
  });
});

describe('PromptRenderer', () => {
  let renderer: PromptRenderer;

  beforeEach(() => {
    renderer = new PromptRenderer();
  });

  describe('render', () => {
    it('should replace variables correctly', async () => {
      const template: PromptTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'chat',
        version: '1.0.0',
        status: 'active',
        template: 'Hello {{name}}, you are {{age}} years old.',
        variables: [],
        examples: [],
        metadata: {
          author: 'test',
          tags: [],
          optimizedFor: [],
          language: 'en',
          complexity: 'basic',
          estimatedTokens: 10,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: [],
          forbiddenPatterns: [],
          allowedModels: []
        },
        optimization: {
          autoOptimize: false,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const variables = { name: 'John', age: 30 };
      const result = await renderer.render(template, variables);

      expect(result.prompt).toBe('Hello John, you are 30 years old.');
      expect(result.metadata.variablesReplaced).toEqual(['name', 'age']);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
    });

    it('should process conditionals', async () => {
      const template: PromptTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'chat',
        version: '1.0.0',
        status: 'active',
        template: '{% if show_greeting %}Hello!{% endif %}World',
        variables: [],
        examples: [],
        metadata: {
          author: 'test',
          tags: [],
          optimizedFor: [],
          language: 'en',
          complexity: 'basic',
          estimatedTokens: 10,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: [],
          forbiddenPatterns: [],
          allowedModels: []
        },
        optimization: {
          autoOptimize: false,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result1 = await renderer.render(template, { show_greeting: true });
      expect(result1.prompt).toBe('Hello!World');

      const result2 = await renderer.render(template, { show_greeting: false });
      expect(result2.prompt).toBe('World');
    });
  });

  describe('validateSyntax', () => {
    it('should validate correct syntax', async () => {
      const template = 'Hello {{name}}!';
      const variables = [
        { name: 'name', type: 'string', description: 'Name', required: true, examples: [] }
      ];

      await expect(renderer.validateSyntax(template, variables)).resolves.not.toThrow();
    });

    it('should throw error for undefined variable', async () => {
      const template = 'Hello {{undefined_var}}!';
      const variables = [
        { name: 'name', type: 'string', description: 'Name', required: true, examples: [] }
      ];

      await expect(renderer.validateSyntax(template, variables)).rejects.toThrow('Undefined variable: undefined_var');
    });

    it('should throw error for mismatched conditionals', async () => {
      const template = '{% if condition %}Content without endif';
      const variables = [];

      await expect(renderer.validateSyntax(template, variables)).rejects.toThrow('Mismatched conditional blocks');
    });
  });
});

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer;

  beforeEach(() => {
    optimizer = new PromptOptimizer();
  });

  describe('optimize', () => {
    it('should create optimization record', async () => {
      const template: PromptTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'chat',
        version: '1.0.0',
        status: 'active',
        template: 'Simple template',
        variables: [],
        examples: [],
        metadata: {
          author: 'test',
          tags: [],
          optimizedFor: [],
          language: 'en',
          complexity: 'basic',
          estimatedTokens: 10,
          lastUpdated: new Date(),
          usageCount: 0,
          successRate: 0,
          averageRating: 0
        },
        constraints: {
          requiredVariables: [],
          forbiddenPatterns: [],
          allowedModels: []
        },
        optimization: {
          autoOptimize: true,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await optimizer.optimize(template);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('type', 'auto');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('metricsBefore');
      expect(result).toHaveProperty('metricsAfter');
    });
  });
});

describe('PromptTester', () => {
  let tester: PromptTester;

  beforeEach(() => {
    tester = new PromptTester();
  });

  describe('evaluateQuality', () => {
    it('should evaluate response quality', async () => {
      const execution: PromptExecution = {
        id: 'test',
        templateId: 'test',
        templateVersion: '1.0.0',
        variables: {},
        renderedPrompt: 'Hello world',
        model: 'gpt-4',
        provider: 'openai',
        response: 'Hello! This is a comprehensive response to your query. It provides detailed information and is well-structured.',
        metrics: {
          promptTokens: 10,
          responseTokens: 25,
          totalTokens: 35,
          latency: 1000,
          cost: 0.001
        },
        quality: {
          relevance: 0,
          coherence: 0,
          completeness: 0
        },
        createdAt: new Date()
      };

      const quality = await tester.evaluateQuality(execution);

      expect(quality).toHaveProperty('relevance');
      expect(quality).toHaveProperty('coherence');
      expect(quality).toHaveProperty('completeness');
      expect(typeof quality.relevance).toBe('number');
      expect(typeof quality.coherence).toBe('number');
      expect(typeof quality.completeness).toBe('number');
    });
  });

  describe('runTests', () => {
    it('should run all tests', async () => {
      const templateId = 'test-template';
      const result = await tester.runTests(templateId);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('results');
      expect(result.total).toBe(4); // 4 tests defined
      expect(result.results).toHaveLength(4);
    });
  });
});
