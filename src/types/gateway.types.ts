export interface APIGatewayConfig {
  server: {
    host: string;
    port: number;
    trustProxy: boolean;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
    requestLogging: boolean;
  };
  endpoints: {
    mcp: string;
    oauth: string;
    health: string;
    metrics: string;
  };
  rateLimit: {
    enabled: boolean;
    globalLimit: number;
    windowMs: number;
  };
}

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
  details?: any;
  lastChecked: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export interface LoggingContext {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  apiKey?: string;
}
