// DEPRECATED: This file is kept for backwards compatibility.
// Canonical types are in ./auth-types.ts — import from there instead.
export type {
  AuthContext,
  Permission,
  User,
  ApiKey,
  AuthError,
  RateLimitConfig
} from './auth-types'

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}
