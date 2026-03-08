/**
 * Custom error hierarchy for TwinMCP platform.
 * Aligns with Architecture/11-Standards-Code.md specification.
 *
 * Usage:
 *   throw new LibraryNotFoundError('MongoDB');
 *   throw new TwinMCPError('RATE_LIMITED', 'Too many requests', 429);
 */

export class TwinMCPError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'TwinMCPError';
    // Ensure prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

export class LibraryNotFoundError extends TwinMCPError {
  constructor(libraryName: string) {
    super('LIBRARY_NOT_FOUND', `Library '${libraryName}' not found`, 404);
    this.name = 'LibraryNotFoundError';
  }
}

export class AuthenticationError extends TwinMCPError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends TwinMCPError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends TwinMCPError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends TwinMCPError {
  constructor(retryAfterSeconds?: number) {
    super(
      'RATE_LIMITED',
      retryAfterSeconds
        ? `Rate limit exceeded. Retry after ${retryAfterSeconds}s`
        : 'Rate limit exceeded',
      429
    );
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends TwinMCPError {
  constructor(message = 'Quota exceeded') {
    super('QUOTA_EXCEEDED', message, 402);
    this.name = 'QuotaExceededError';
  }
}

export class NotFoundError extends TwinMCPError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends TwinMCPError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Helper to safely extract a TwinMCPError from an unknown catch value,
 * or return a generic 500 error.
 */
export function toTwinMCPError(error: unknown): TwinMCPError {
  if (error instanceof TwinMCPError) return error;
  const message = error instanceof Error ? error.message : 'Internal server error';
  return new TwinMCPError('INTERNAL_ERROR', message, 500);
}
