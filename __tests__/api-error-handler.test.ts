import { handleApiError } from '@/lib/api-error-handler';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  TwinMCPError,
} from '@/lib/errors';

// Mock logger to avoid side effects
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('handleApiError', () => {
  it('should return 401 for AuthenticationError', () => {
    const response = handleApiError(new AuthenticationError());
    expect(response.status).toBe(401);
  });

  it('should return 403 for AuthorizationError', () => {
    const response = handleApiError(new AuthorizationError());
    expect(response.status).toBe(403);
  });

  it('should return 400 for ValidationError', () => {
    const response = handleApiError(new ValidationError('bad input'));
    expect(response.status).toBe(400);
  });

  it('should return 500 for unknown errors', () => {
    const response = handleApiError(new Error('unexpected'));
    expect(response.status).toBe(500);
  });

  it('should hide internal details for 5xx errors', async () => {
    const response = handleApiError(new Error('db connection failed'));
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.success).toBe(false);
  });

  it('should expose message for 4xx errors', async () => {
    const response = handleApiError(new ValidationError('Email is required'));
    const body = await response.json();
    expect(body.error).toBe('Email is required');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should pass context to logger', () => {
    const { logger } = require('@/lib/logger');
    handleApiError(new Error('fail'), 'TestContext');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[TestContext]'),
      expect.anything()
    );
  });

  it('should log 4xx as warn, not error', () => {
    const { logger } = require('@/lib/logger');
    jest.clearAllMocks();
    handleApiError(new AuthenticationError(), 'AuthTest');
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
