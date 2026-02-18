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
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.015, output: 0.075 },
        performance: { latency: 3000, quality: 10 }
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.003, output: 0.015 },
        performance: { latency: 2000, quality: 9 }
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        capabilities: ['functions', 'vision', 'streaming'],
        pricing: { input: 0.00025, output: 0.00125 },
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
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        contextWindow: 32768,
        maxOutputTokens: 2048,
        capabilities: ['functions', 'streaming'],
        pricing: { input: 0.0005, output: 0.0015 },
        performance: { latency: 1200, quality: 8 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 32768,
      inputCost: 0.0005,
      outputCost: 0.0015
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
    'claude-3-opus': {
      pricing: { input: 0.015, output: 0.075 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'claude-3-sonnet': {
      pricing: { input: 0.003, output: 0.015 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    },
    'claude-3-haiku': {
      pricing: { input: 0.00025, output: 0.00125 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    }
  },
  google: {
    'gemini-pro': {
      pricing: { input: 0.0005, output: 0.0015 },
      billingCycle: 'monthly' as const,
      currency: 'USD'
    }
  }
};
