import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { TwinMCPError } from '@/lib/errors';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiValidationError(error: ZodError): NextResponse<ApiResponse> {
  const errors = error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  return NextResponse.json(
    { success: false, error: 'Validation échouée', errors },
    { status: 400 }
  );
}

export async function parseAndValidate<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse<ApiResponse> }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: apiError('Corps de requête JSON invalide', 400) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: apiValidationError(result.error) };
  }

  return { data: result.data };
}

export function handleApiError(error: unknown, context: string): NextResponse<ApiResponse> {
  if (error instanceof TwinMCPError) {
    console.warn(`[API] ${context}: ${error.code} — ${error.message}`);
    return apiError(error.message, error.statusCode);
  }
  console.error(`[API] ${context}:`, error);
  return apiError('Une erreur interne est survenue', 500);
}
