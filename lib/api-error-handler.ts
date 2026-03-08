/**
 * Shared API error response handler.
 * Converts TwinMCPError (and unknown errors) into consistent NextResponse JSON.
 *
 * Usage in route handlers:
 *   } catch (error) {
 *     return handleApiError(error, 'ContextLabel');
 *   }
 */

import { NextResponse } from 'next/server';
import { TwinMCPError, toTwinMCPError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export function handleApiError(error: unknown, context?: string): NextResponse {
  const twinError = toTwinMCPError(error);

  // Log 5xx errors as error, 4xx as warn
  if (twinError.statusCode >= 500) {
    logger.error(`[${context ?? 'API'}] ${twinError.code}:`, error);
  } else {
    logger.warn(`[${context ?? 'API'}] ${twinError.code}: ${twinError.message}`);
  }

  return NextResponse.json(
    {
      success: false,
      error: twinError.statusCode >= 500 ? 'Internal server error' : twinError.message,
      code: twinError.code,
    },
    { status: twinError.statusCode }
  );
}
