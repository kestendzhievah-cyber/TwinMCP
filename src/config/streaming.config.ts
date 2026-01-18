import { StreamConfig } from '../types/streaming.types';

export const STREAMING_CONFIG: StreamConfig = {
  maxConnections: 10000,
  connectionTimeout: 300000, // 5 minutes
  heartbeatInterval: 30000, // 30 seconds
  bufferSize: 1024 * 8, // 8KB
  flushInterval: 100, // 100ms
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },
  encryption: {
    enabled: false,
    algorithm: 'aes-256-gcm',
    keyRotation: 86400000 // 24 hours
  },
  monitoring: {
    metricsInterval: 60000, // 1 minute
    logLevel: 'info',
    alertThresholds: {
      errorRate: 0.05, // 5%
      latency: 5000, // 5 seconds
      connectionDrops: 100 // per hour
    }
  },
  fallback: {
    enabled: true,
    providers: ['anthropic', 'google'],
    retryAttempts: 3,
    retryDelay: 1000
  }
};

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Cache-Control, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Accel-Buffering': 'no' // Désactiver le buffering nginx
};

export const STREAM_BILLING_CONFIGS: Record<string, any> = {
  openai: {
    'gpt-3.5-turbo': {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      pricing: {
        streaming: {
          perSecond: 0.0001, // $0.0001 par seconde
          perMegabyte: 0.01, // $0.01 par MB
          peakBandwidthPremium: 0.00001 // $0.00001 par KB/s au-dessus de 1MB/s
        },
        tokens: {
          input: 0.001, // $0.001 per 1K input tokens
          output: 0.002 // $0.002 per 1K output tokens
        },
        infrastructure: {
          baseCost: 0.001, // $0.001 par connexion
          perConnectionHour: 0.01 // $0.01 par heure de connexion
        }
      },
      billingCycle: 'monthly',
      currency: 'USD',
      taxRate: 0.2, // 20% TVA
      discounts: [
        {
          volumeThreshold: 1000000, // 1M tokens
          discountPercentage: 0.1 // 10% discount
        },
        {
          volumeThreshold: 10000000, // 10M tokens
          discountPercentage: 0.2 // 20% discount
        }
      ],
      sla: {
        uptimeGuarantee: 0.99, // 99% uptime
        latencyGuarantee: 500, // 500ms max latency
        bandwidthGuarantee: 1048576, // 1MB/s minimum bandwidth
        penaltyRate: 0.1 // 10% credit pour SLA non respecté
      }
    },
    'gpt-4': {
      provider: 'openai',
      model: 'gpt-4',
      pricing: {
        streaming: {
          perSecond: 0.0002,
          perMegabyte: 0.02,
          peakBandwidthPremium: 0.00002
        },
        tokens: {
          input: 0.03, // $0.03 per 1K input tokens
          output: 0.06 // $0.06 per 1K output tokens
        },
        infrastructure: {
          baseCost: 0.002,
          perConnectionHour: 0.02
        }
      },
      billingCycle: 'monthly',
      currency: 'USD',
      taxRate: 0.2,
      discounts: [
        {
          volumeThreshold: 500000,
          discountPercentage: 0.05
        },
        {
          volumeThreshold: 5000000,
          discountPercentage: 0.15
        }
      ],
      sla: {
        uptimeGuarantee: 0.995,
        latencyGuarantee: 300,
        bandwidthGuarantee: 2097152, // 2MB/s
        penaltyRate: 0.15
      }
    }
  },
  anthropic: {
    'claude-3-sonnet': {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      pricing: {
        streaming: {
          perSecond: 0.00015,
          perMegabyte: 0.015,
          peakBandwidthPremium: 0.000015
        },
        tokens: {
          input: 0.003, // $0.003 per 1K input tokens
          output: 0.015 // $0.015 per 1K output tokens
        },
        infrastructure: {
          baseCost: 0.0015,
          perConnectionHour: 0.015
        }
      },
      billingCycle: 'monthly',
      currency: 'USD',
      taxRate: 0.2,
      discounts: [
        {
          volumeThreshold: 800000,
          discountPercentage: 0.08
        },
        {
          volumeThreshold: 8000000,
          discountPercentage: 0.18
        }
      ],
      sla: {
        uptimeGuarantee: 0.99,
        latencyGuarantee: 400,
        bandwidthGuarantee: 1572864, // 1.5MB/s
        penaltyRate: 0.12
      }
    }
  },
  google: {
    'gemini-pro': {
      provider: 'google',
      model: 'gemini-pro',
      pricing: {
        streaming: {
          perSecond: 0.00008,
          perMegabyte: 0.008,
          peakBandwidthPremium: 0.000008
        },
        tokens: {
          input: 0.0005, // $0.0005 per 1K input tokens
          output: 0.0015 // $0.0015 per 1K output tokens
        },
        infrastructure: {
          baseCost: 0.0008,
          perConnectionHour: 0.008
        }
      },
      billingCycle: 'monthly',
      currency: 'USD',
      taxRate: 0.2,
      discounts: [
        {
          volumeThreshold: 2000000,
          discountPercentage: 0.12
        },
        {
          volumeThreshold: 20000000,
          discountPercentage: 0.25
        }
      ],
      sla: {
        uptimeGuarantee: 0.98,
        latencyGuarantee: 600,
        bandwidthGuarantee: 1048576, // 1MB/s
        penaltyRate: 0.08
      }
    }
  }
};
