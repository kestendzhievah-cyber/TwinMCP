export interface Permission {
  resource: string;
  actions: string[];
}

export interface User {
  id: string;
  email: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  user: User;
  permissions: Permission[];
  timestamp: number;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  permissions: Permission[];
  quotaRequestsPerMinute: number;
  quotaRequestsPerDay: number;
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INVALID_API_KEY' | 'EXPIRED_TOKEN';
  message: string;
  details?: any;
}
