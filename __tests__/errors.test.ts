import {
  TwinMCPError,
  LibraryNotFoundError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  QuotaExceededError,
  NotFoundError,
  ConflictError,
  toTwinMCPError,
} from '@/lib/errors';

describe('TwinMCPError hierarchy', () => {
  describe('TwinMCPError (base)', () => {
    it('should set code, message, statusCode', () => {
      const err = new TwinMCPError('TEST_CODE', 'test message', 418);
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err.statusCode).toBe(418);
      expect(err.name).toBe('TwinMCPError');
    });

    it('should default statusCode to 500', () => {
      const err = new TwinMCPError('ERR', 'fail');
      expect(err.statusCode).toBe(500);
    });

    it('should be instanceof Error', () => {
      const err = new TwinMCPError('ERR', 'fail');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TwinMCPError);
    });

    it('toJSON() returns structured object', () => {
      const err = new TwinMCPError('CODE', 'msg', 400);
      expect(err.toJSON()).toEqual({
        error: 'msg',
        code: 'CODE',
        statusCode: 400,
      });
    });
  });

  describe('LibraryNotFoundError', () => {
    it('should format library name in message', () => {
      const err = new LibraryNotFoundError('React');
      expect(err.message).toBe("Library 'React' not found");
      expect(err.code).toBe('LIBRARY_NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(TwinMCPError);
    });
  });

  describe('AuthenticationError', () => {
    it('should default message', () => {
      const err = new AuthenticationError();
      expect(err.message).toBe('Authentication required');
      expect(err.code).toBe('UNAUTHENTICATED');
      expect(err.statusCode).toBe(401);
    });

    it('should accept custom message', () => {
      const err = new AuthenticationError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('AuthorizationError', () => {
    it('should default message', () => {
      const err = new AuthorizationError();
      expect(err.message).toBe('Insufficient permissions');
      expect(err.code).toBe('FORBIDDEN');
      expect(err.statusCode).toBe(403);
    });
  });

  describe('ValidationError', () => {
    it('should use provided message', () => {
      const err = new ValidationError('Invalid email');
      expect(err.message).toBe('Invalid email');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.statusCode).toBe(400);
    });
  });

  describe('RateLimitError', () => {
    it('should include retry info when provided', () => {
      const err = new RateLimitError(60);
      expect(err.message).toBe('Rate limit exceeded. Retry after 60s');
      expect(err.statusCode).toBe(429);
    });

    it('should have generic message without retry', () => {
      const err = new RateLimitError();
      expect(err.message).toBe('Rate limit exceeded');
    });
  });

  describe('QuotaExceededError', () => {
    it('should default message', () => {
      const err = new QuotaExceededError();
      expect(err.message).toBe('Quota exceeded');
      expect(err.code).toBe('QUOTA_EXCEEDED');
      expect(err.statusCode).toBe(402);
    });
  });

  describe('NotFoundError', () => {
    it('should format resource name', () => {
      const err = new NotFoundError('User');
      expect(err.message).toBe('User not found');
      expect(err.statusCode).toBe(404);
    });
  });

  describe('ConflictError', () => {
    it('should use provided message', () => {
      const err = new ConflictError('Key already exists');
      expect(err.message).toBe('Key already exists');
      expect(err.code).toBe('CONFLICT');
      expect(err.statusCode).toBe(409);
    });
  });
});

describe('toTwinMCPError()', () => {
  it('should return same error if already TwinMCPError', () => {
    const original = new AuthenticationError();
    const result = toTwinMCPError(original);
    expect(result).toBe(original);
  });

  it('should wrap a standard Error', () => {
    const err = new Error('something broke');
    const result = toTwinMCPError(err);
    expect(result).toBeInstanceOf(TwinMCPError);
    expect(result.message).toBe('something broke');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.statusCode).toBe(500);
  });

  it('should wrap a non-Error value', () => {
    const result = toTwinMCPError('string error');
    expect(result).toBeInstanceOf(TwinMCPError);
    expect(result.message).toBe('Internal server error');
    expect(result.statusCode).toBe(500);
  });

  it('should wrap null/undefined', () => {
    expect(toTwinMCPError(null).statusCode).toBe(500);
    expect(toTwinMCPError(undefined).statusCode).toBe(500);
  });
});
