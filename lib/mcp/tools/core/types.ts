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

export interface QueueJob {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  retries: number;
  maxRetries: number;
  result?: any;
  error?: string;
}
