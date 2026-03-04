import { LLMProvider } from '../types/llm.types';

export const LLM_PROVIDERS: Record<string, LLMProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        capabilities: ['tools', 'vision', 'streaming', 'json_mode'],
        pricing: { input: 0.0025, output: 0.01 },
        performance: { latency: 1000, quality: 9 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        capabilities: ['tools', 'vision', 'streaming', 'json_mode'],
        pricing: { input: 0.00015, output: 0.0006 },
        performance: { latency: 500, quality: 8 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        capabilities: ['tools', 'vision', 'streaming', 'json_mode'],
        pricing: { input: 0.01, output: 0.03 },
        performance: { latency: 1500, quality: 9 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 128000,
      inputCost: 0.0025,
      outputCost: 0.01
    },
    config: {
      apiKey: process.env['OPENAI_API_KEY'] || '',
      baseURL: 'https://api.openai.com/v1',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 5000,
        tokensPerMinute: 800000
      },
      features: {
        streaming: true,
        functions: true,
        images: true,
        caching: true
      }
    }
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'anthropic',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 16384,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.003, output: 0.015 },
        performance: { latency: 2000, quality: 10 }
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.003, output: 0.015 },
        performance: { latency: 1500, quality: 9 }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.0008, output: 0.004 },
        performance: { latency: 500, quality: 8 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 200000,
      inputCost: 0.015,
      outputCost: 0.075
    },
    config: {
      apiKey: process.env['ANTHROPIC_API_KEY'] || '',
      baseURL: 'https://api.anthropic.com',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000
      },
      features: {
        streaming: true,
        functions: true,
        images: true,
        caching: false
      }
    }
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    type: 'google',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        contextWindow: 1048576,
        maxOutputTokens: 8192,
        capabilities: ['functions', 'streaming', 'vision'],
        pricing: { input: 0.0001, output: 0.0004 },
        performance: { latency: 400, quality: 8 }
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        contextWindow: 2097152,
        maxOutputTokens: 8192,
        capabilities: ['functions', 'streaming', 'vision'],
        pricing: { input: 0.00125, output: 0.005 },
        performance: { latency: 1200, quality: 9 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 1048576,
      inputCost: 0.0001,
      outputCost: 0.0004
    },
    config: {
      apiKey: process.env['GOOGLE_API_KEY'] || '',
      baseURL: 'https://generativelanguage.googleapis.com/v1',
      timeout: 60000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 32000
      },
      features: {
        streaming: true,
        functions: true,
        images: false,
        caching: false
      }
    }
  }
};

export const LLM_BILLING_CONFIG = {
  openai: {
    'gpt-4o': {
      pricing: { input: 0.0025, output: 0.01 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'gpt-4o-mini': {
      pricing: { input: 0.00015, output: 0.0006 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'gpt-4-turbo': {
      pricing: { input: 0.01, output: 0.03 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    }
  },
  anthropic: {
    'claude-sonnet-4-20250514': {
      pricing: { input: 0.003, output: 0.015 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'claude-3-5-sonnet-20241022': {
      pricing: { input: 0.003, output: 0.015 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'claude-3-5-haiku-20241022': {
      pricing: { input: 0.0008, output: 0.004 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    }
  },
  google: {
    'gemini-2.0-flash': {
      pricing: { input: 0.0001, output: 0.0004 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'gemini-1.5-pro': {
      pricing: { input: 0.00125, output: 0.005 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    }
  }
};
