// Types et interfaces pour le système de streaming

export interface StreamConnection {
  id: string;
  clientId: string;
  userId?: string;
  sessionId?: string;
  requestId: string;
  status: 'connecting' | 'connected' | 'streaming' | 'completed' | 'error' | 'disconnected';
  provider: string;
  model: string;
  metadata: {
    userAgent: string;
    ip: string;
    connectedAt: Date;
    lastActivity: Date;
    bytesReceived: number;
    chunksReceived: number;
    averageLatency: number;
  };
  options: {
    bufferSize: number;
    flushInterval: number;
    compression: boolean;
    encryption: boolean;
    heartbeatInterval: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  id: string;
  connectionId: string;
  sequence: number;
  type: 'content' | 'metadata' | 'error' | 'control' | 'heartbeat';
  data: any;
  timestamp: Date;
  size: number;
  checksum?: string;
}

export interface StreamEvent {
  type: 'start' | 'chunk' | 'metadata' | 'error' | 'complete' | 'heartbeat' | 'reconnect';
  data: any;
  timestamp: Date;
  eventId: string;
}

export interface StreamBuffer {
  connectionId: string;
  chunks: StreamChunk[];
  maxSize: number;
  flushThreshold: number;
  lastFlush: Date;
  compressionEnabled: boolean;
}

export interface StreamMetrics {
  connectionId: string;
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    totalChunks: number;
    totalBytes: number;
    averageChunkSize: number;
    chunksPerSecond: number;
    bytesPerSecond: number;
    latency: {
      min: number;
      max: number;
      average: number;
      p95: number;
      p99: number;
    };
  };
  quality: {
    errorRate: number;
    reconnectionRate: number;
    completionRate: number;
    averageStreamDuration: number;
  };
  network: {
    packetsLost: number;
    retransmissions: number;
    connectionDrops: number;
    averageRTT: number;
  };
}

export interface StreamConfig {
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  bufferSize: number;
  flushInterval: number;
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'deflate' | 'br';
    level: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
    keyRotation: number;
  };
  monitoring: {
    metricsInterval: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    alertThresholds: {
      errorRate: number;
      latency: number;
      connectionDrops: number;
    };
  };
  fallback: {
    enabled: boolean;
    providers: string[];
    retryAttempts: number;
    retryDelay: number;
  };
}

export interface StreamRequest {
  id: string;
  clientId: string;
  provider: string;
  model: string;
  messages: any[];
  context?: any;
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    bufferSize?: number;
    flushInterval?: number;
  };
  metadata: {
    userId?: string;
    sessionId?: string;
    purpose: string;
    priority: 'low' | 'normal' | 'high';
  };
}

export interface StreamResponse {
  id: string;
  requestId: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  content: string;
  metadata: {
    chunks: number;
    tokens: number;
    latency: number;
    provider: string;
    model: string;
  };
  events: StreamEvent[];
  createdAt: Date;
  completedAt?: Date;
}

// Types pour la facturation
export interface StreamBillingRecord {
  id: string;
  connectionId: string;
  userId: string;
  provider: string;
  model: string;
  period: string; // YYYY-MM format
  usage: {
    totalDuration: number; // en secondes
    totalChunks: number;
    totalBytes: number;
    totalTokens: number | { input: number; output: number };
    peakBandwidth: number; // bytes/sec
    averageLatency: number;
  };
  cost: {
    streamingCost: number; // coût basé sur la durée/bandwidth
    tokenCost: number; // coût basé sur les tokens
    infrastructureCost: number; // coût serveur/infrastructure
    totalCost: number;
  };
  billingStatus: 'pending' | 'processed' | 'failed' | 'refunded';
  createdAt: Date;
  processedAt?: Date;
}

export interface StreamBillingConfig {
  provider: string;
  model: string;
  pricing: {
    streaming: {
      perSecond: number; // coût par seconde de streaming
      perMegabyte: number; // coût par MB de données
      peakBandwidthPremium: number; // prime pour haute bande passante
    };
    tokens: {
      input: number; // per 1K tokens
      output: number; // per 1K tokens
    };
    infrastructure: {
      baseCost: number; // coût fixe par connexion
      perConnectionHour: number; // coût horaire par connexion
    };
  };
  billingCycle: 'monthly' | 'daily' | 'hourly';
  currency: string;
  taxRate?: number;
  discounts?: {
    volumeThreshold: number;
    discountPercentage: number;
  }[];
  sla?: {
    uptimeGuarantee: number;
    latencyGuarantee: number;
    bandwidthGuarantee: number;
    penaltyRate: number;
  };
}

export interface StreamUsageReport {
  userId: string;
  period: string;
  totalUsage: {
    connections: number;
    duration: number; // en secondes
    chunks: number;
    bytes: number;
    tokens: number;
    cost: number;
  };
  byProvider: Record<string, {
    connections: number;
    duration: number;
    chunks: number;
    bytes: number;
    tokens: number;
    cost: number;
    models: Record<string, {
      connections: number;
      duration: number;
      chunks: number;
      bytes: number;
      tokens: number;
      cost: number;
    }>;
  }>;
  byPurpose: Record<string, {
    connections: number;
    duration: number;
    chunks: number;
    bytes: number;
    tokens: number;
    cost: number;
  }>;
  performance: {
    averageLatency: number;
    peakBandwidth: number;
    uptime: number;
    errorRate: number;
  };
  trends: {
    dailyUsage: Array<{
      date: string;
      connections: number;
      duration: number;
      chunks: number;
      bytes: number;
      tokens: number;
      cost: number;
    }>;
    growthRate: number;
    costProjection: number;
  };
}

export interface CompressionService {
  compress(data: string | Buffer): Promise<Buffer>;
  decompress(data: Buffer): Promise<string | Buffer>;
  compressChunks(chunks: StreamChunk[]): Promise<StreamChunk[]>;
}

export interface EncryptionService {
  encrypt(data: string | Buffer): Promise<Buffer>;
  decrypt(data: Buffer): Promise<string | Buffer>;
  encryptChunks(chunks: StreamChunk[]): Promise<StreamChunk[]>;
  rotateKey(): Promise<void>;
}

export interface StreamingService {
  createConnection(request: StreamRequest): Promise<StreamConnection>;
  startStream(connectionId: string, request: StreamRequest): Promise<void>;
  closeConnection(connectionId: string): Promise<void>;
  getConnection(connectionId: string): Promise<StreamConnection | null>;
  getMetrics(connectionId: string, period: { start: Date; end: Date }): Promise<StreamMetrics>;
}

export interface BillingService {
  calculateStreamingCost(record: StreamBillingRecord, config: StreamBillingConfig): Promise<number>;
  generateBillingReport(userId: string, period: string): Promise<StreamUsageReport>;
  processBilling(records: StreamBillingRecord[]): Promise<void>;
  applyDiscounts(cost: number, usage: number, discounts: any[]): number;
  calculateSLAPenalty(record: StreamBillingRecord, sla: any): Promise<number>;
}

export interface StreamAnalytics {
  trackConnection(connection: StreamConnection): void;
  trackChunk(chunk: StreamChunk): void;
  trackMetrics(metrics: StreamMetrics): void;
  generateReport(period: { start: Date; end: Date }): Promise<any>;
  getRealTimeStats(): Promise<any>;
}
