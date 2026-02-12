// Import + re-export from canonical location to avoid duplication
import type { RateLimitConfig } from '../core/types'
export type { RateLimitConfig } from '../core/types'

export interface AuthContext {
  userId: string
  email?: string
  apiKey?: string
  permissions: Permission[]
  rateLimit: RateLimitConfig
  isAuthenticated: boolean
  authMethod: 'api_key' | 'jwt' | 'none'
}

export interface Permission {
  resource: string // tool ID or 'global'
  actions: string[] // 'read', 'write', 'execute', 'admin'
  conditions?: {
    maxCost?: number
    maxRequests?: number
    allowedCategories?: string[]
  }
}

export interface User {
  id: string
  email: string
  name: string
  permissions: Permission[]
  rateLimit: RateLimitConfig
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
}

export interface ApiKey {
  id: string
  key: string
  userId: string
  name: string
  permissions: Permission[]
  rateLimit: RateLimitConfig
  isActive: boolean
  expiresAt?: Date
  createdAt: Date
  lastUsed?: Date
}

export interface AuthError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'INVALID_API_KEY'
  statusCode: 401 | 403 | 400
}
