// DEPRECATED: This file is kept for backwards compatibility.
// Canonical types are in ../../core/types.ts — import from there instead.
export type {
  QueueJob,
  ExecutionResult,
  ValidationResult,
  ToolMetrics,
  MCPTool,
  ToolCapabilities,
  RateLimitConfig,
  CacheConfig
} from '../../core/types'

// Tool-specific types that are unique to this file
export interface ToolContext {
  userId: string;
  requestId: string;
  timestamp: number;
  permissions: string[];
  rateLimit: {
    remaining: number;
    resetTime: Date;
  };
}

export interface ToolRequest {
  id: string;
  name: string;
  parameters: Record<string, any>;
  context: ToolContext;
}

export interface ToolResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    cacheHit: boolean;
    apiCallsCount: number;
    cost?: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  permissions: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}
